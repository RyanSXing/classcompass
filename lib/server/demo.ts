import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import manifest from '@/public/demo/manifest.json';
// Reference student writing stays in this server module, never the public catalog.
import source from '@/docs/fixtures/classroom.json';
import { assignments, getAssignment } from '@/lib/assignments';
import { analyzeBatch, createBatch, createInitialState, ingestExtraction, inputFingerprint } from '@/lib/domain';
import { DomainError } from '@/lib/domain/errors';
import { getTemplate } from '@/lib/curriculum';
import type { AppState, Batch, CandidateFindingDraft, SupportContext } from '@/lib/contracts';
import type { Actor } from './auth';
import type { Repository } from './repository';
import { extractWorksheet } from './ai';
import { prepareUploads, putObject, finalizeUpload, hashBytes } from './storage';

type SampleSubmission = { studentId?: string; recordedSupport: { level: SupportContext['level']; source: SupportContext['source']; note: string } };
const samples = source as unknown as { students: { id: string; baseline: SampleSubmission; followup: SampleSubmission }[]; additionalSubmissions: Record<string, SampleSubmission[]> };
const loadSchema = z.union([
  z.object({ templateId: z.string().min(1) }).strict(),
  z.object({ phase: z.enum(['baseline', 'followup']) }).strict(),
]);
function latestBatch(state: AppState, templateId: string) {
  return state.batches.filter(batch => batch.templateId === templateId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
}
function sampleSupport(templateId: string, studentId: string): SupportContext {
  const student = samples.students.find(student => student.id === studentId);
  const sample = templateId === 'baseline-template-v1' ? student?.baseline : templateId === 'followup-template-v1' ? student?.followup : samples.additionalSubmissions[templateId]?.find(item => item.studentId === studentId);
  if (!sample) throw new DomainError('DEMO_SUPPORT', 503, 'The sample assistance record is missing. Regenerate the sample class.');
  const { level, source: supportSource, note } = sample.recordedSupport;
  return { level, source: supportSource, note };
}

/** Append a sample assignment once. An existing upload/review always wins. */
export async function loadDemo(actor: Actor, repo: Repository, raw: unknown) {
  const request = loadSchema.parse(raw);
  const templateId = 'templateId' in request ? request.templateId : `${request.phase}-template-v1`;
  const assignment = getAssignment(templateId);
  if (!assignment) throw new DomainError('DEMO_ASSIGNMENT', 422, 'Choose one of the five authored sample assignments.');
  const template = getTemplate(templateId);
  const before = await repo.read();
  const existing = latestBatch(before, templateId);
  if (existing) return { batchId: existing.id, existing: true, prepared: canAnalyzePrepared(before, existing) };
  const previousAssignment = assignments.find(item => item.sequence === assignment.sequence - 1);
  const previousBatch = previousAssignment ? latestBatch(before, previousAssignment.templateId) : undefined;
  if (templateId === 'followup-template-v1' && !previousBatch) throw new DomainError('BASELINE_REQUIRED', 422, 'Load the first check before the quick check.');
  const entries = manifest.assets.filter(asset => asset.type === 'fictional-handwritten-scan' && asset.templateId === templateId);
  if (entries.length !== source.students.length) throw new DomainError('DEMO_INTEGRITY', 503, 'The sample assignment is incomplete. Regenerate the sample files.');
  const submissions: { studentId: string; assetId: string; support: SupportContext }[] = [];
  for (const entry of entries) {
    const bytes = await fs.readFile(path.join(process.cwd(), 'public', 'demo', entry.filename));
    if (hashBytes(bytes) !== entry.sha256) throw new DomainError('DEMO_INTEGRITY', 503, 'The prepared worksheet files need to be regenerated.');
    const prepared = await prepareUploads(actor, repo, { purpose: 'worksheet', templateId, files: [{ name: entry.filename, type: 'image/png', size: bytes.length, studentId: entry.studentId }] }, `sample:${templateId}:${entry.studentId}:${entry.sha256}`);
    const id = prepared.assets[0].id;
    const asset = (await repo.read()).assets.find(asset => asset.id === id)!;
    if (asset.status !== 'ready') {
      await putObject(actor, asset.originalObjectKey, bytes, 'image/png');
      await putObject(actor, asset.normalizedObjectKey!, bytes, 'image/png');
      await finalizeUpload(actor, repo, id);
    }
    await repo.transact(state => { state.assets.find(asset => asset.id === id)!.source = 'demo'; });
    submissions.push({ studentId: entry.studentId!, assetId: id, support: sampleSupport(templateId, entry.studentId!) });
  }
  return repo.transact(state => {
    // Recheck under the repository transaction when two sample loads race.
    const current = latestBatch(state, templateId);
    if (current) return { batchId: current.id, existing: true, prepared: canAnalyzePrepared(state, current) };
    const previous = previousAssignment ? latestBatch(state, previousAssignment.templateId) : undefined;
    const plan = state.plans.find(plan => plan.id === assignment.sourceLessonId);
    const batch = createBatch(state, { templateId, kind: assignment.kind, activityDate: template.date, title: assignment.title, submissions, ...(previous ? { previousBatchId: previous.id } : {}), ...(plan ? { sourcePlanVersionId: plan.currentVersionId } : {}) });
    return { batchId: batch.id, existing: false, prepared: true };
  });
}

function sampleEntries(state: AppState, batch: Batch) {
  return batch.submissionIds.map(submissionId => {
    const submission = state.submissions.find(item => item.id === submissionId);
    const asset = state.assets.find(item => item.id === submission?.assetId);
    const entry = manifest.assets.find(item => item.type === 'fictional-handwritten-scan' && item.templateId === batch.templateId && item.studentId === submission?.studentId && item.sha256 === asset?.sha256);
    if (!submission || !asset || asset.status !== 'ready' || asset.source !== 'demo' || !entry) throw new DomainError('DEMO_ONLY', 422, 'Prepared analysis is available only for the unchanged sample worksheet files. Analyze your uploaded work from its assignment.');
    return { submission, asset, entry };
  });
}
function canAnalyzePrepared(state: AppState, batch: Batch): boolean {
  try { return sampleEntries(state, batch).length > 0; }
  catch (error) {
    if (error instanceof DomainError && error.code === 'DEMO_ONLY') return false;
    throw error;
  }
}
function hasCurrentStudentFinding(state: AppState, batch: Batch, submissionId: string) {
    const submission = state.submissions.find(item => item.id === submissionId)!;
    const complete = state.responses.filter(response => response.submissionId === submissionId).length === getTemplate(batch.templateId).questionIds.length;
    return complete && state.findings.some(finding => finding.batchId === batch.id && finding.studentId === submission.studentId && ['candidate', 'confirmed', 'rejected'].includes(finding.status) && finding.evidence.every(ref => state.responses.some(response => response.id === ref.responseId && response.revision === ref.responseRevision)) && finding.supportSnapshots.every(snapshot => state.submissions.some(item => item.id === snapshot.submissionId && item.revision === snapshot.submissionRevision)));
}
function hasCurrentFindings(state: AppState, batch: Batch) {
  return batch.submissionIds.every(submissionId => hasCurrentStudentFinding(state, batch, submissionId));
}

/** Explicit prepared analysis: zero external calls and no teacher confirmations. */
export async function analyzeDemo(actor: Actor, repo: Repository, raw: unknown) {
  const { batchId } = z.object({ batchId: z.string().min(1) }).strict().parse(raw);
  const before = await repo.read();
  const batch = before.batches.find(item => item.id === batchId && item.ownerId === actor.id);
  if (!batch) throw new DomainError('NOT_FOUND', 404, 'Assignment not found.');
  const entries = sampleEntries(before, batch);
  if (hasCurrentFindings(before, batch)) return { batchId, findingsCreated: 0, alreadyAnalyzed: true, mode: 'fixture' as const };
  const prepared: ({ submissionId: string; assetHash: string } & Awaited<ReturnType<typeof extractWorksheet>>)[] = [];
  for (const { submission, asset, entry } of entries) {
    if (before.extractions.some(extraction => extraction.submissionId === submission.id && extraction.assetHash === asset.sha256)) continue;
    const bytes = await fs.readFile(path.join(process.cwd(), 'public', 'demo', entry.filename));
    if (hashBytes(bytes) !== entry.sha256) throw new DomainError('DEMO_INTEGRITY', 503, 'The sample source file changed. Regenerate the sample class.');
    const result = await extractWorksheet({ assetHash: entry.sha256, bytes, mimeType: 'image/png', templateId: batch.templateId, mode: 'fixture' });
    prepared.push({ submissionId: submission.id, assetHash: entry.sha256, ...result });
  }
  return repo.transact(state => {
    const current = state.batches.find(item => item.id === batchId)!;
    sampleEntries(state, current);
    for (const extraction of prepared) ingestExtraction(state, extraction);
    if (hasCurrentFindings(state, current)) return { batchId, findingsCreated: 0, alreadyAnalyzed: true, mode: 'fixture' as const };
    const provenance = { mode: 'fixture' as const, modelId: 'prepared-classroom-v2', promptVersion: 'prepared-analysis-v2', generatedAt: new Date().toISOString(), inputFingerprint: inputFingerprint(state, batchId) };
    const needsAnalysis = new Set(current.submissionIds.filter(submissionId => !hasCurrentStudentFinding(state, current, submissionId)).map(submissionId => state.submissions.find(submission => submission.id === submissionId)!.studentId));
    // Derive on a clone, then save only students whose evidence needs refreshing.
    // Other teachers' edits, confirmations and rejections remain byte-for-byte intact.
    const projected = analyzeBatch(structuredClone(state), { batchId, provenance });
    const drafts: CandidateFindingDraft[] = projected.filter(finding => needsAnalysis.has(finding.studentId)).map(({ studentId, objectiveId, code, claimScope, explanation, evidence, limitations, suggestedNextStep }) => ({ studentId, objectiveId, code, claimScope, explanation, evidence, limitations, suggestedNextStep }));
    const findings = analyzeBatch(state, { batchId, provenance, drafts });
    return { batchId, findingsCreated: findings.length, alreadyAnalyzed: false, mode: 'fixture' as const };
  });
}

/** Explicit local reset also clears additive optional features such as assistant history. */
export function resetDemoState(state: AppState, ownerId: string) {
  const fresh = createInitialState(ownerId);
  for (const key of Object.keys(state)) if (!(key in fresh)) delete (state as unknown as Record<string, unknown>)[key];
  Object.assign(state, fresh);
}
