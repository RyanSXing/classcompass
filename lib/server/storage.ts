import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import type { Asset } from '@/lib/contracts';
import { curriculum } from '@/lib/curriculum';
import { DomainError } from '@/lib/domain/errors';
import { configuration } from './config';
import type { Actor } from './auth';
import type { Repository } from './repository';

export const MAX_FILE = 5 * 1024 * 1024;
export const uploadSchema = z.object({ purpose: z.enum(['worksheet', 'lesson']), templateId: z.string().optional(), files: z.array(z.object({ name: z.string().min(1).max(200), type: z.enum(['image/png', 'image/jpeg', 'application/pdf', 'application/json']), size: z.number().int().positive().max(MAX_FILE), studentId: z.string().optional() }).strict()).min(1).max(8) }).strict();
export const hashBytes = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
function localPath(key: string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(key) || key.split('/').includes('..')) throw new DomainError('INVALID_PATH', 422, 'Invalid asset path.');
  const base = path.resolve(configuration().localDir, 'assets');
  const target = path.resolve(base, key);
  if (!target.startsWith(base + path.sep)) throw new DomainError('INVALID_PATH', 422, 'Invalid asset path.');
  return target;
}
export async function putObject(actor: Actor, key: string, bytes: Uint8Array, type: string) {
  if (!key.startsWith(actor.id + '/')) throw new DomainError('NOT_FOUND', 404, 'File not found.');
  if (configuration().dataBackend === 'local') {
    const target = localPath(key); await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
      try { await fs.link(temporary, target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const existing = await fs.readFile(target);
        if (!existing.equals(Buffer.from(bytes))) throw new DomainError('OBJECT_IMMUTABLE', 409, 'This evidence is already stored. Prepare a new upload to replace it.');
      }
    } finally { await fs.unlink(temporary).catch(() => {}); }
  } else {
    const { error } = await actor.client!.storage.from('classcompass-evidence').upload(key, bytes, { contentType: type, upsert: false });
    if (error) {
      if (String((error as {statusCode?:string}).statusCode) === '409' || /already exists|duplicate/i.test(error.message)) {
        const existing = await getObject(actor, key);
        if (existing.equals(Buffer.from(bytes))) return;
        throw new DomainError('OBJECT_IMMUTABLE', 409, 'This evidence is already stored. Prepare a new upload to replace it.');
      }
      throw new DomainError('STORAGE_UPLOAD', 503, 'Could not save the worksheet. Retry this file.');
    }
  }
}
export async function getObject(actor: Actor, key: string): Promise<Buffer> {
  if (!key.startsWith(actor.id + '/')) throw new DomainError('NOT_FOUND', 404, 'File not found.');
  if (configuration().dataBackend === 'local') return fs.readFile(localPath(key));
  const { data, error } = await actor.client!.storage.from('classcompass-evidence').download(key);
  if (error || !data) throw new DomainError('STORAGE_READ', 503, 'The evidence preview is unavailable. Retry to refresh it.');
  return Buffer.from(await data.arrayBuffer());
}
export async function boundedBytes(request: Request, limit: number): Promise<Buffer> {
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new DomainError('FILE_TOO_LARGE', 413, 'This file exceeds the upload size limit.');
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new DomainError('FILE_TOO_LARGE', 413, 'This file exceeds the upload size limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function inspect(bytes: Buffer, purpose: Asset['purpose']) {
  if (!bytes.length || bytes.length > MAX_FILE) throw new DomainError('FILE_SIZE', 413, 'Files must be non-empty and no larger than 5 MiB.');
  if (bytes.subarray(0, 5).toString() === '%PDF-') {
    // Inspect document structure, not just the advertised MIME type.
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    try {
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
      const doc = await task.promise;
      const pages = doc.numPages; await task.destroy();
      if (pages > (purpose === 'worksheet' ? 1 : 3)) throw new DomainError('PAGE_COUNT', 422, 'Use one worksheet page per student, or a lesson PDF of at most three pages.');
      return { mimeType: 'application/pdf', pageCount: pages };
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('INVALID_PDF', 415, 'Use an unencrypted, readable PDF.'); }
  }
  if (purpose === 'lesson' && bytes.subarray(0, 50).toString().trimStart().startsWith('{')) {
    try { JSON.parse(bytes.toString()); return { mimeType: 'application/json', pageCount: 1 }; } catch { throw new DomainError('INVALID_JSON', 415, 'The lesson JSON is not valid.'); }
  }
  try {
    const meta = await sharp(bytes, { limitInputPixels: 20000000 }).metadata();
    if (!['png', 'jpeg'].includes(meta.format ?? '') || !meta.width || !meta.height) throw new Error();
    return { mimeType: meta.format === 'png' ? 'image/png' : 'image/jpeg', width: meta.width, height: meta.height, pageCount: 1 };
  } catch { throw new DomainError('INVALID_IMAGE', 415, 'Use a clear PNG/JPEG under 20 megapixels, or a supported PDF.'); }
}
export async function prepareUploads(actor: Actor, repo: Repository, input: unknown, idempotencyKey?: string) {
  const parsed = uploadSchema.parse(input);
  if (parsed.purpose === 'worksheet' && !curriculum.templates.some(t => t.id === parsed.templateId)) throw new DomainError('TEMPLATE_REQUIRED', 422, 'Choose a known worksheet template.');
  const assets = await repo.transact(state => {
    const operation='upload.prepare', requestHash=JSON.stringify(parsed);
    const prior=idempotencyKey && state.mutationKeys.find(key=>key.operation===operation && key.key===idempotencyKey);
    if(prior) {
      if(prior.requestHash!==requestHash) throw new DomainError('IDEMPOTENCY_CONFLICT',409,'This upload request key was already used for different files.');
      return (prior.result as string[]).map(id=>{const asset=state.assets.find(asset=>asset.id===id);if(!asset)throw new DomainError('UPLOAD_MISSING',409,'The prepared upload is no longer available.');return asset;});
    }
    const created=parsed.files.map(file => {
    if (file.studentId && !state.students.some(s => s.id === file.studentId)) throw new DomainError('STUDENT_NOT_FOUND', 404, 'Student not found.');
    const id = randomUUID(); const now = new Date().toISOString();
    const asset: Asset = { id, ownerId: actor.id, createdAt: now, updatedAt: now, revision: 1, purpose: parsed.purpose, name: file.name, status: 'pending', mimeType: file.type, byteCount: file.size, templateId: parsed.templateId, studentId: file.studentId, originalObjectKey: `${actor.id}/${id}/original`, normalizedObjectKey: `${actor.id}/${id}/normalized`, source: 'upload' };
    state.assets.push(asset); return asset;
    });
    if(idempotencyKey) state.mutationKeys.push({id:randomUUID(),ownerId:actor.id,createdAt:new Date().toISOString(),operation,key:idempotencyKey,requestHash,result:created.map(asset=>asset.id)});
    return created;
  });
  return { assets: await Promise.all(assets.map(async asset => {
    const result = { id: asset.id, method: 'PUT', uploadUrl: `/api/uploads/${asset.id}/content?slot=original`, normalizedUploadUrl: `/api/uploads/${asset.id}/content?slot=normalized`, headers: {} };
    if (configuration().dataBackend === 'supabase') {
      const original = await actor.client!.storage.from('classcompass-evidence').createSignedUploadUrl(asset.originalObjectKey);
      const normalized = await actor.client!.storage.from('classcompass-evidence').createSignedUploadUrl(asset.normalizedObjectKey!);
      if (original.error || normalized.error) throw new DomainError('UPLOAD_URL', 503, 'Could not prepare private uploads.');
      result.uploadUrl = original.data.signedUrl; result.normalizedUploadUrl = normalized.data.signedUrl;
    }
    return result;
  })) };
}
export async function finalizeUpload(actor: Actor, repo: Repository, id: string) {
  const state = await repo.read(); const asset = state.assets.find(a => a.id === id);
  if (!asset) throw new DomainError('NOT_FOUND', 404, 'Upload not found.');
  if (asset.status === 'ready') return asset;
  const original = await getObject(actor, asset.originalObjectKey);
  const info = await inspect(original, asset.purpose);
  if (original.byteLength !== asset.byteCount || info.mimeType !== asset.mimeType) throw new DomainError('FILE_MISMATCH', 422, 'The uploaded file does not match its declared size or type.');
  let normalized: Buffer | undefined;
  if (asset.purpose === 'worksheet') {
    if (info.mimeType === 'application/pdf') {
      normalized = await getObject(actor, asset.normalizedObjectKey!);
    } else {
      // Prefer the teacher-previewed derivative, falling back to identical original bytes.
      try { normalized = await getObject(actor, asset.normalizedObjectKey!); } catch { normalized = original; await putObject(actor, asset.normalizedObjectKey!, normalized, info.mimeType); }
    }
    const meta = await inspect(normalized, 'worksheet');
    if (!meta.mimeType.startsWith('image/')) throw new DomainError('NORMALIZED_IMAGE', 422, 'Upload the rendered worksheet image before continuing.');
    Object.assign(info, { width: meta.width, height: meta.height });
  }
  return repo.transact(current => {
    const target = current.assets.find(a => a.id === id)!;
    if (target.status === 'ready') return target;
    Object.assign(target, info, { status: 'ready', sha256: hashBytes(original), normalizedSha256: normalized ? hashBytes(normalized) : undefined, normalizedMimeType: normalized ? (normalized[0] === 137 ? 'image/png' : 'image/jpeg') : undefined, normalizedByteCount: normalized?.length, updatedAt: new Date().toISOString(), revision: target.revision + 1 });
    return target;
  });
}
