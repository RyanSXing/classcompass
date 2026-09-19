import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import manifest from '@/public/demo/manifest.json';
import { createBatch } from '@/lib/domain';
import { DomainError } from '@/lib/domain/errors';
import { getTemplate } from '@/lib/curriculum';
import type { SupportContext } from '@/lib/contracts';
import type { Actor } from './auth';
import type { Repository } from './repository';
import { prepareUploads, putObject, finalizeUpload, hashBytes } from './storage';

export async function loadDemo(actor: Actor, repo: Repository, raw: unknown) {
  const { phase } = z.object({ phase: z.enum(['baseline', 'followup']) }).strict().parse(raw);
  const templateId = `${phase}-template-v1`;
  const template = getTemplate(templateId);
  const before = await repo.read();
  const previousBatch = before.batches.filter(b => b.kind === 'baseline').at(-1);
  if (phase === 'followup' && !previousBatch) throw new DomainError('BASELINE_REQUIRED', 422, 'Load and review the baseline work before the follow-up.');
  const entries = manifest.assets.filter(a => a.type === 'fictional-handwritten-scan' && a.templateId === templateId);
  const submissions: {studentId: string; assetId: string; support: SupportContext}[] = [];
  for (const entry of entries) {
    const bytes = await fs.readFile(path.join(process.cwd(), 'public', 'demo', entry.filename));
    if (hashBytes(bytes) !== entry.sha256) throw new DomainError('DEMO_INTEGRITY', 503, 'The prepared worksheet files need to be regenerated.');
    const prepared = await prepareUploads(actor, repo, { purpose: 'worksheet', templateId, files: [{ name: entry.filename, type: 'image/png', size: bytes.length, studentId: entry.studentId }] });
    const id = prepared.assets[0].id;
    const asset = (await repo.read()).assets.find(a => a.id === id)!;
    await putObject(actor, asset.originalObjectKey, bytes, 'image/png');
    await putObject(actor, asset.normalizedObjectKey!, bytes, 'image/png');
    await finalizeUpload(actor, repo, id);
    await repo.transact(state => { state.assets.find(a => a.id === id)!.source = 'demo'; });
    submissions.push({ studentId: entry.studentId!, assetId: id, support: { level: 'independent' as const, source: 'teacher-recorded' as const, note: phase === 'baseline' ? 'Fictional teacher entry: completed independently. Verify actual assistance during review.' : 'Fictional follow-up: completed independently without hints.' } });
  }
  return repo.transact(state => {
    const plan = state.plans.find(p => p.id === 'lesson-2026-09-23');
    const batch = createBatch(state, { templateId, kind: phase, activityDate: template.date, submissions, ...(phase === 'followup' ? { previousBatchId: previousBatch!.id, sourcePlanVersionId: plan?.currentVersionId } : {}) });
    return { batchId: batch.id };
  });
}
