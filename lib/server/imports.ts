import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { lessonSchema, type LessonImport, type LessonSnapshot } from '@/lib/contracts';
import { curriculum } from '@/lib/curriculum';
import { validateLesson } from '@/lib/domain';
import { DomainError } from '@/lib/domain/errors';
import type { Actor } from './auth';
import type { Repository } from './repository';
import { getObject } from './storage';

const requestSchema = z.object({ assetId: z.string(), extractedText: z.string().max(30000).optional(), lesson: lessonSchema.optional() }).strict();
export async function importLesson(actor: Actor, repo: Repository, raw: unknown) {
  const input = requestSchema.parse(raw);
  const state = await repo.read(), asset = state.assets.find(a => a.id === input.assetId);
  if (!asset || asset.status !== 'ready' || asset.purpose !== 'lesson') throw new DomainError('IMPORT_ASSET', 422, 'Upload and verify a lesson document first.');
  const bytes = await getObject(actor, asset.originalObjectKey);
  let text = '', draft: LessonSnapshot | null = null;
  const errors: string[] = [];
  try {
    if (asset.mimeType === 'application/json') draft = lessonSchema.parse(JSON.parse(bytes.toString()));
    if (!draft && asset.mimeType === 'application/pdf') {
      // Read the actual uploaded PDF. Client preview text never replaces the source.
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
      try { const doc = await task.promise; text = ''; for (let p = 1; p <= doc.numPages; p++) { const content = await (await doc.getPage(p)).getTextContent(); text += content.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n'; } } finally { await task.destroy(); }
      draft = parseLessonText(text);
    }
    if (draft) validateLesson(state, draft);
    else errors.push('Review the source and enter the lesson in the editable preview. The document could not be mapped confidently to five timed blocks.');
  } catch (error) { errors.push(error instanceof DomainError ? error.message : 'The document needs a manual lesson preview. Use the runtime JSON template or edit all five blocks.'); draft = null; }
  return repo.transact(current => {
    const now = new Date().toISOString();
    const record: LessonImport = { id: randomUUID(), ownerId: actor.id, createdAt: now, updatedAt: now, revision: 1, assetId: asset.id, status: 'draft', draft, errors, extractedText: text };
    current.lessonImports.push(record); return record;
  });
}
function parseLessonText(text: string): LessonSnapshot | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const date = normalized.match(/September\s+(\d{1,2}),?\s+2026/i)?.[1];
  if (!date) return null;
  const lessonDate = `2026-09-${date.padStart(2, '0')}`;
  const known = curriculum.lessons.find(l => l.date === lessonDate);
  if (!known) return null;
  const ranges = [...normalized.matchAll(/(\d{2})\s*[-–]\s*(\d{2})\s*min\s*/g)];
  if (ranges.length !== 5) return null;
  const blocks = ranges.map((range, i) => {
    const start = range.index! + range[0].length;
    const end = ranges[i + 1]?.index ?? normalized.indexOf('Planning note:', start);
    const body = normalized.slice(start, end < 0 ? undefined : end).trim();
    const heading = known.blocks[i].title;
    if (!body.startsWith(heading)) throw new Error('Unknown block heading');
    return { id: known.blocks[i].id, title: body.slice(0, heading.length), minutes: Number(range[2]) - Number(range[1]), instructions: body.slice(heading.length).trim(), mode: 'whole_class' as const };
  });
  // Identity/objective metadata uses the known unit, while all instruction text comes from the source.
  return { schemaVersion: 1, lessonId: known.lessonId, unitId: known.unitId, date: lessonDate, title: known.title, objectiveIds: [...known.objectiveIds], totalMinutes: 45, blocks };
}
