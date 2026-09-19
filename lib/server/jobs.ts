import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppState, Job, JobStep } from '@/lib/contracts';
import { generateProposalSchema } from '@/lib/contracts';
import { analyzeBatch, generateProposal, ingestExtraction, inputFingerprint } from '@/lib/domain';
import { DomainError } from '@/lib/domain/errors';
import { configuration } from './config';
import type { Actor } from './auth';
import type { Repository } from './repository';
import { getObject } from './storage';
import * as ai from './ai';

const terminal = ['completed', 'cancelled', 'failed', 'blocked'];
const stamp = () => new Date().toISOString();
const touch = (job: Job) => { job.revision++; job.updatedAt = stamp(); };
const fingerprint = (state: AppState, job: Pick<Job, 'batchId'>) => inputFingerprint(state, job.batchId);
function getJob(state: AppState, id: string) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) throw new DomainError('NOT_FOUND', 404, 'Processing job not found.');
  return job;
}
export function queueJob(state: AppState, type: Job['type'], id: string, raw: unknown, key?: string): Job {
  const request = type === 'analysis' ? z.object({ expectedRevision: z.number().int().positive() }).strict().parse(raw) : generateProposalSchema.parse(raw);
  const operation = `${type}:${id}`;
  if (key) {
    const prior = state.mutationKeys.find(k => k.operation === operation && k.key === key);
    if (prior) {
      if (prior.requestHash !== JSON.stringify(request)) throw new DomainError('IDEMPOTENCY_CONFLICT', 409, 'This request key was already used for different inputs.');
      return getJob(state, prior.result as string);
    }
  }
  const now = stamp();
  const job: Job = { id: randomUUID(), ownerId: state.ownerId, createdAt: now, updatedAt: now, revision: 1, type, status: 'queued', steps: [], inputFingerprint: '', request };
  if (type === 'analysis') {
    const batch = state.batches.find(b => b.id === id);
    if (!batch) throw new DomainError('NOT_FOUND', 404, 'Batch not found.');
    if (batch.revision !== (request as { expectedRevision: number }).expectedRevision) throw new DomainError('REVISION_CONFLICT', 409, 'The batch changed. Refresh and retry.');
    job.batchId = id;
    for (const submissionId of batch.submissionIds) {
      if (!state.extractions.some(e => e.submissionId === submissionId)) job.steps.push({ id: randomUUID(), kind: 'extract', submissionId, status: 'pending', attempts: 0, inputFingerprint: '' });
    }
    job.steps.push({ id: randomUUID(), kind: 'analyze', status: 'pending', attempts: 0, inputFingerprint: '' });
  } else {
    job.lessonId = id;
    // Validate all preconditions on a throwaway snapshot before spending a model call.
    const copy = structuredClone(state);
    generateProposal(copy, id, { ...generateProposalSchema.parse(request), provenance: { mode: configuration().aiMode, modelId: 'validation', promptVersion: 'validation', generatedAt: now, inputFingerprint: '' } });
    job.steps.push({ id: randomUUID(), kind: 'propose', status: 'pending', attempts: 0, inputFingerprint: '' });
  }
  job.inputFingerprint = fingerprint(state, job);
  const existing = state.jobs.find(j => !terminal.includes(j.status) && j.type === type && j.batchId === job.batchId && j.lessonId === job.lessonId && j.inputFingerprint === job.inputFingerprint);
  const selected = existing || job;
  if (!existing) state.jobs.push(job);
  if (selected.batchId) state.batches.find(batch => batch.id === selected.batchId)!.latestJobId = selected.id;
  if (key) state.mutationKeys.push({ id: randomUUID(), ownerId: state.ownerId, createdAt: now, operation, key, requestHash: JSON.stringify(request), result: selected.id });
  return selected;
}
function cancel(job: Job, code: string, message: string) {
  job.status = 'cancelled'; job.errorCode = code; job.error = message; job.cancelledAt = stamp();
  for (const step of job.steps) if (step.status !== 'completed') { step.status = 'cancelled'; delete step.leaseToken; delete step.leaseExpiresAt; }
  touch(job);
}
export function cancelJob(state: AppState, id: string) { const job = getJob(state, id); if (job.status !== 'completed') cancel(job, 'CANCELLED', 'Processing cancelled. Completed readings remain available.'); return job; }
export function retryJob(state: AppState, id: string) {
  const job = getJob(state, id);
  if (!['failed', 'blocked'].includes(job.status)) throw new DomainError('RETRY_UNAVAILABLE', 409, 'Only a failed or blocked job can be retried.');
  if (fingerprint(state, job) !== job.inputFingerprint) throw new DomainError('STALE_JOB', 409, 'Evidence changed. Start a fresh analysis instead.');
  for (const step of job.steps) if (step.status === 'failed') { step.status = 'pending'; step.attempts = 0; delete step.error; delete step.nextAttemptAt; }
  job.status = 'queued'; delete job.error; delete job.errorCode; delete job.nextAttemptAt; touch(job); return job;
}
export async function runNext(actor: Actor, repo: Repository, id: string, provider = ai) {
  const claim = await repo.transact(state => {
    const job = getJob(state, id);
    if (terminal.includes(job.status)) return { job, waitReason: 'finished' };
    if (fingerprint(state, job) !== job.inputFingerprint) { cancel(job, 'STALE_JOB', 'Evidence changed while processing. Start a fresh analysis using your corrections.'); return { job, waitReason: 'stale' }; }
    const time = Date.now();
    for (const other of state.jobs) for (const step of other.steps) {
      if (step.status !== 'running') continue;
      if (Date.parse(step.leaseExpiresAt || '') > time) return { job, waitReason: 'Another step is processing.' };
      step.status = step.attempts >= configuration().maxAttempts ? 'failed' : 'pending';
      step.error = 'The previous worker stopped before saving. Resume to retry.';
      delete step.leaseToken; delete step.leaseExpiresAt;
      other.status = step.status === 'failed' ? 'failed' : 'queued'; touch(other);
    }
    const step = job.steps.find(s => s.status !== 'completed');
    if (!step || step.status === 'failed') { job.status = step ? 'failed' : 'completed'; touch(job); return { job, waitReason: 'finished' }; }
    if (step.nextAttemptAt && Date.parse(step.nextAttemptAt) > time) return { job, waitReason: 'Waiting before retry.' };
    if (configuration().aiMode === 'live' && state.lastDispatchAt && time - Date.parse(state.lastDispatchAt) < 4000) return { job, waitReason: 'Waiting for the model request interval.' };
    step.status = 'running'; step.attempts++; step.inputFingerprint = job.inputFingerprint;
    step.leaseToken = randomUUID(); step.leaseExpiresAt = new Date(time + 180000).toISOString();
    job.status = 'running'; delete job.error; delete job.nextAttemptAt; touch(job); state.lastDispatchAt = stamp();
    return { job: structuredClone(job), step: structuredClone(step), snapshot: structuredClone(state) };
  });
  if (!claim.step || !claim.snapshot) return claim;
  const { step, snapshot } = claim;
  let output: Awaited<ReturnType<typeof ai.extractWorksheet>> | Awaited<ReturnType<typeof ai.analyzeEvidence>> | Awaited<ReturnType<typeof ai.proposeLesson>>;
  try {
    if (step.kind === 'extract') {
      const submission = snapshot.submissions.find(s => s.id === step.submissionId)!;
      const asset = snapshot.assets.find(a => a.id === submission.assetId)!;
      const batch = snapshot.batches.find(b => b.id === claim.job.batchId)!;
      output = await provider.extractWorksheet({ assetHash: asset.sha256!, bytes: await getObject(actor, asset.normalizedObjectKey || asset.originalObjectKey), mimeType: asset.normalizedMimeType || asset.mimeType, templateId: batch.templateId });
    } else if (step.kind === 'analyze') output = await provider.analyzeEvidence({ state: snapshot, batchId: claim.job.batchId! });
    else output = await provider.proposeLesson({ state: snapshot, lessonId: claim.job.lessonId! });
    return await repo.transact(state => {
      const job = getJob(state, id), current = job.steps.find(s => s.id === step.id)!;
      if (!validLease(state, job, current, step)) { if (job.status !== 'cancelled' && current.leaseToken === step.leaseToken) cancel(job, 'STALE_JOB', 'Inputs changed. The late model response was discarded.'); return { job, discarded: true }; }
      if (step.kind === 'extract' && 'draft' in output) {
        const submission = state.submissions.find(s => s.id === step.submissionId)!;
        const asset = state.assets.find(a => a.id === submission.assetId)!;
        current.outputId = ingestExtraction(state, { submissionId: submission.id, draft: output.draft, provenance: output.provenance, assetHash: asset.sha256! }).id;
      } else if (step.kind === 'analyze' && 'drafts' in output) {
        analyzeBatch(state, { batchId: job.batchId!, drafts: output.drafts, provenance: output.provenance }); job.resultId = job.batchId;
      } else if (step.kind === 'propose' && 'changes' in output) {
        const proposal = generateProposal(state, job.lessonId!, { ...generateProposalSchema.parse(job.request), changes: output.changes, provenance: output.provenance }); current.outputId = proposal.id; job.resultId = proposal.id;
      } else throw new DomainError('PROVIDER_CONTRACT', 502, 'The model returned an unexpected result.');
      current.status = 'completed'; delete current.leaseToken; delete current.leaseExpiresAt; delete current.error;
      job.inputFingerprint = fingerprint(state, job); job.status = job.steps.every(s => s.status === 'completed') ? 'completed' : 'queued'; touch(job);
      return { job };
    });
  } catch (error) {
    return repo.transact(state => {
      const job = getJob(state, id), current = job.steps.find(s => s.id === step.id)!;
      if (!validLease(state, job, current, step)) { if (current.leaseToken === step.leaseToken && job.status !== 'cancelled') cancel(job, 'STALE_JOB', 'Inputs changed. Start a fresh analysis.'); return { job, discarded: true }; }
      const failure = error as Error & { code?: string; retryable?: boolean; retryAfterMs?: number };
      const retryable = failure.retryable === true;
      const message = error instanceof DomainError || error instanceof ai.AIError ? failure.message : 'Processing could not finish. Retry this step.';
      current.error = message; delete current.leaseToken; delete current.leaseExpiresAt;
      job.error = message; job.errorCode = failure.code || 'PROCESSING_FAILED';
      if (retryable && current.attempts < configuration().maxAttempts) {
        current.status = 'waiting_retry'; job.status = 'waiting_retry';
        current.nextAttemptAt = new Date(Date.now() + Math.max(4000, Math.min(failure.retryAfterMs || 4000 * 2 ** current.attempts, 86400000))).toISOString(); job.nextAttemptAt = current.nextAttemptAt;
      } else { current.status = 'failed'; job.status = retryable ? 'failed' : 'blocked'; }
      touch(job); return { job };
    });
  }
}
function validLease(state: AppState, job: Job, current: JobStep, claimed: JobStep) {
  return job.status === 'running' && current.status === 'running' && current.leaseToken === claimed.leaseToken && Date.parse(current.leaseExpiresAt || '') > Date.now() && fingerprint(state, job) === claimed.inputFingerprint;
}
