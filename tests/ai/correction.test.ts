import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateFindingSchema, type AppState, type ProposalChange } from '@/lib/contracts';
import { analyzeBatch, createInitialState, generateProposal, reviewFindings } from '@/lib/domain';
import { analyzeEvidence, buildProposalInput, proposeLesson } from '@/lib/server/ai';
import { seedAssignment, testProvenance } from '../domain/helpers';

beforeEach(() => { vi.stubEnv('AI_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'fake-test-key'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function provider(outputs: unknown[], status = 200) {
  let index = 0;
  const fetcher = vi.fn<typeof fetch>(async () => {
    const output = outputs[Math.min(index++, outputs.length - 1)];
    return new Response(JSON.stringify(status === 200 ? { choices: [{ finish_reason: 'stop', message: { content: typeof output === 'string' ? output : JSON.stringify(output) } }] } : output), { status });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
function confirm(state: AppState, batchId: string) {
  const findings = analyzeBatch(state, { batchId, provenance: testProvenance });
  reviewFindings(state, { items: findings.map(f => ({ findingId: f.id, expectedRevision: f.revision, decision: 'confirm' as const })), acknowledgeClearReadings: true });
  return findings;
}
function followup() {
  const state = createInitialState('test-teacher');
  const baseline = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-04'] });
  confirm(state, baseline.id);
  const batch = seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-04'] });
  const valid = analyzeBatch(structuredClone(state), { batchId: batch.id, provenance: testProvenance }).map(f => candidateFindingSchema.parse(f.originalDraft));
  return { state, batch, valid };
}
function proposalWire(changes: ProposalChange[]) {
  return { changes: changes.map(change => ({
    changeKey: change.id, dependsOnKeys: change.dependsOnChangeIds,
    operation: change.operation, rationale: change.rationale,
    findingIds: change.findingIds, affectedStudentIds: change.affectedStudentIds,
    payload: change.operation === 'schedule_checkpoint' ? change.payload : { block: { ...change.payload.block, lanes: change.payload.block.lanes ?? [], materialIds: change.payload.block.materialIds ?? [] } },
  })) };
}

describe('bounded live output correction', () => {
  it('repairs missing prior citations using exact feedback and keeps the classroom unchanged', async () => {
    const { state, batch, valid } = followup();
    const invalid = structuredClone(valid);
    invalid[0].evidence = invalid[0].evidence.filter(ref => state.responses.some(r => r.id === ref.responseId && batch.submissionIds.includes(r.submissionId)));
    const fetcher = provider([{ findings: invalid }, { findings: valid }]);
    const before = JSON.stringify(state);
    const result = await analyzeEvidence({ state, batchId: batch.id, mode: 'live' });
    expect(result.drafts).toEqual(valid);
    expect(result.provenance).toMatchObject({ mode: 'live', modelId: 'deepseek-flash', promptVersion: 'analyze-v6' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const second = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    const feedback = JSON.parse(second.messages.at(-1).content);
    expect(feedback.validationFeedback).toContain('stu-04');
    expect(feedback.validationFeedback).toContain('confirmed earlier extension evidence');
    expect(feedback.rejectedOutput.findings[0].evidence).toHaveLength(2);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('does not accept repeated invalid evidence or start blind automatic retries after correction fails', async () => {
    const { state, batch, valid } = followup();
    valid[0].evidence[0].responseId = 'invented-evidence';
    const fetcher = provider([{ findings: valid }]);
    const before = JSON.stringify(state);
    await expect(analyzeEvidence({ state, batchId: batch.id, mode: 'live' })).rejects.toMatchObject({ code: 'AI_INVALID_EVIDENCE', retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps upstream errors in the normal job backoff path without a correction request', async () => {
    const { state, batch } = followup();
    const fetcher = provider([{ error: { message: 'rate limit' } }], 429);
    await expect(analyzeEvidence({ state, batchId: batch.id, mode: 'live' })).rejects.toMatchObject({ code: 'AI_RATE_LIMIT', retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('requests fresh valid JSON after malformed planning output and never applies it automatically', async () => {
    const state = createInitialState('test-teacher');
    const batch = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-01'] });
    confirm(state, batch.id);
    const plan = state.plans.find(p => p.id === 'lesson-2026-09-23')!;
    const generated = generateProposal(structuredClone(state), plan.id, { basePlanVersionId: plan.currentVersionId, expectedEvidenceRevision: state.classroom.evidenceRevision, expectedCalendarRevision: state.classroom.calendarRevision, provenance: testProvenance });
    const fetcher = provider(['{"changes":[}', proposalWire(generated.changes)]);
    const before = JSON.stringify(state);
    const result = await proposeLesson({ state, lessonId: plan.id, mode: 'live' });
    expect(result.changes).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(state)).toBe(before);
    const body = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    expect(JSON.parse(body.messages.at(-1).content).validationCode).toBe('AI_INVALID_JSON');
  });

  it('supplies allowed placements from confirmed evidence, not from the prior saved plan', () => {
    const state = createInitialState('test-teacher');
    const batch = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-01'] });
    const findings = confirm(state, batch.id);
    const context = buildProposalInput(state, 'lesson-2026-09-23');
    expect(context.studentPlacementConstraints.find(s => s.studentId === 'stu-01')).toMatchObject({ allowedLaneIds: ['independent', 'targeted'], targetedFindingIds: [findings[0].id] });
    expect(context.studentPlacementConstraints.find(s => s.studentId === 'stu-02')).toMatchObject({ allowedLaneIds: ['independent'], targetedFindingIds: [], extensionFindingIds: [], requiresEntryCheck: true });
  });

  it('rejects an older lesson before paying for a model request when newer reviewed work exists', async () => {
    const { state, batch } = followup();
    confirm(state, batch.id);
    const fetcher = provider([]);
    await expect(proposeLesson({ state, lessonId: 'lesson-2026-09-23', mode: 'live' })).rejects.toMatchObject({ code: 'TARGET_LESSON' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
