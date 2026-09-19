import prepared from '../../lib/fixtures/extractions.json';
import { extractionSchema, type AppState, type Provenance, type SupportContext } from '../../lib/contracts';
import { getAssignment } from '../../lib/assignments';
import { createBatch, createInitialState, ingestExtraction } from '../../lib/domain';

export const testProvenance: Provenance = { mode: 'fixture', modelId: 'test-fixture', promptVersion: 'test', generatedAt: '2026-09-19T12:00:00Z', inputFingerprint: 'test' };
export function legacyState(ownerId = 'teacher'): AppState {
  const state=createInitialState(ownerId);
  const preservedIds=new Set(['lesson-2026-09-23','lesson-2026-09-25']);
  state.plans=state.plans.filter(p=>preservedIds.has(p.id));
  state.planVersions=state.planVersions.filter(v=>preservedIds.has(v.lessonId));
  for(const entry of state.calendarEntries)if(entry.lessonId&&!preservedIds.has(entry.lessonId)){delete entry.lessonId;delete entry.planVersionId;}
  delete state.classroom.catalogVersion;
  return state;
}
export function seedAssignment(state: AppState, templateId = 'baseline-template-v1', options: { studentIds?: string[]; extract?: boolean; support?: SupportContext['level'] } = {}) {
  const assignment = getAssignment(templateId)!;
  const entries = Object.entries(prepared).filter(([,entry]) => entry.templateId === templateId && (!options.studentIds || options.studentIds.includes(entry.studentId)));
  const token = crypto.randomUUID();
  for (const [hash,entry] of entries) state.assets.push({ id: `${token}-${entry.studentId}`, ownerId: state.ownerId, createdAt: testProvenance.generatedAt, updatedAt: testProvenance.generatedAt, revision: 1, purpose: 'worksheet', name: 'sample.png', status: 'ready', mimeType: 'image/png', byteCount: 10, originalObjectKey: `${state.ownerId}/${hash}`, sha256: hash, templateId });
  const batch = createBatch(state, { kind: assignment.kind, templateId, activityDate: assignment.date, submissions: entries.map(([,entry]) => ({ studentId: entry.studentId, assetId: `${token}-${entry.studentId}`, support: { level: options.support ?? 'independent', source: 'teacher-recorded', note: 'Test conditions.' } })) });
  if (options.extract !== false) for (const submissionId of batch.submissionIds) {
    const submission = state.submissions.find(s => s.id === submissionId)!;
    const [hash,entry] = entries.find(([,entry]) => entry.studentId === submission.studentId)!;
    ingestExtraction(state, { submissionId, assetHash: hash, draft: extractionSchema.parse({ templateId, responses: entry.responses }), provenance: testProvenance });
  }
  return batch;
}
