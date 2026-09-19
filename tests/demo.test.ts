import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assignments } from '../lib/assignments';
import { correctResponse, correctSupport, editFinding, reviewFindings } from '../lib/domain';
import { analyzeDemo, loadDemo } from '../lib/server/demo';
import { LocalRepository } from '../lib/server/repository';

const actor = { id: '11111111-1111-4111-8111-111111111111', name: 'Test teacher' };
let directory: string, repo: LocalRepository;
const network = vi.fn(() => { throw new Error('Prepared sample analysis must never call the network'); });
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'classcompass-samples-'));
  vi.stubEnv('LOCAL_DATA_DIR', directory); vi.stubEnv('DATA_BACKEND', 'local'); vi.stubEnv('AI_MODE', 'live'); vi.stubEnv('APP_DEPLOYMENT', 'local'); vi.stubEnv('VERCEL', '');
  vi.stubGlobal('fetch', network); network.mockClear(); repo = new LocalRepository(directory, actor.id);
});
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await fs.rm(directory, { recursive: true, force: true }); });

describe('prepared sample class', () => {
  it('loads all five assignments with 120 source-linked results, no live calls or approvals, and resumes without duplication', async () => {
    for (const assignment of assignments) {
      const loaded = await loadDemo(actor, repo, { templateId: assignment.templateId });
      expect(loaded.prepared).toBe(true);
      await analyzeDemo(actor, repo, { batchId: loaded.batchId });
    }
    const before = await repo.read();
    expect(before.batches).toHaveLength(5); expect(before.submissions).toHaveLength(40); expect(before.assets).toHaveLength(40);
    expect(before.responses).toHaveLength(120); expect(before.extractions).toHaveLength(40);
    expect(before.observations).toHaveLength(0); expect(before.proposals).toHaveLength(0);
    expect(before.findings.every(finding => finding.status === 'candidate' && finding.provenance?.mode === 'fixture')).toBe(true);
    expect(before.extractions.every(extraction => extraction.provenance.mode === 'fixture')).toBe(true);
    expect(before.responses.filter(response => response.legibility === 'uncertain')).toHaveLength(2);
    expect(before.submissions.filter(submission => submission.support.level === 'supported')).toHaveLength(2);
    expect(before.submissions.filter(submission => submission.support.level === 'unknown')).toHaveLength(1);
    for (const assignment of assignments) {
      const loaded = await loadDemo(actor, repo, { templateId: assignment.templateId });
      expect(loaded.existing).toBe(true);
      expect((await analyzeDemo(actor, repo, { batchId: loaded.batchId })).alreadyAnalyzed).toBe(true);
    }
    const after = await repo.read();
    for (const key of ['batches', 'submissions', 'assets', 'responses', 'extractions', 'findings', 'plans', 'planVersions'] as const) expect(after[key]).toEqual(before[key]);
    expect(network).not.toHaveBeenCalled();
  }, 30000);
  it('keeps teacher readings, edited notes, confirmations and rejections while refreshing only changed evidence', async () => {
    const { batchId } = await loadDemo(actor, repo, { phase: 'baseline' });
    await analyzeDemo(actor, repo, { batchId });
    await repo.transact(state => {
      const avery = state.findings.find(finding => finding.studentId === 'stu-01')!;
      const blake = state.findings.find(finding => finding.studentId === 'stu-02')!;
      const casey = state.findings.find(finding => finding.studentId === 'stu-03')!;
      reviewFindings(state, { items: [{ findingId: avery.id, expectedRevision: avery.revision, decision: 'confirm' }, { findingId: casey.id, expectedRevision: casey.revision, decision: 'reject' }], acknowledgeClearReadings: true });
      editFinding(state, blake.id, { expectedRevision: blake.revision, objectiveId: blake.objectiveId, code: blake.code, claimScope: blake.claimScope, explanation: 'Teacher note retained across repeated sample loading.', evidence: blake.evidence, limitations: blake.limitations, suggestedNextStep: blake.suggestedNextStep, reason: 'Add classroom context.' });
      const submission = state.submissions.find(item => item.studentId === 'stu-06')!;
      const response = state.responses.find(item => item.submissionId === submission.id && item.questionId === 'q-03')!;
      correctResponse(state, response.id, { expectedRevision: response.revision, workingText: '2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2', answerText: '1/2', legibility: 'clear', readingStatus: 'resolved', reason: 'Verified source denominator.' });
      const gray = state.submissions.find(item => item.studentId === 'stu-07')!;
      correctSupport(state, gray.id, { expectedRevision: gray.revision, support: { level: 'supported', source: 'teacher-corrected', note: 'Prompted a common denominator on each question.' }, reason: 'Correct the fictional initial assistance entry.' });
    });
    const edited = await repo.read();
    const preserved = edited.findings.filter(finding => ['stu-01', 'stu-02', 'stu-03'].includes(finding.studentId));
    expect((await loadDemo(actor, repo, { templateId: 'baseline-template-v1' })).batchId).toBe(batchId);
    await analyzeDemo(actor, repo, { batchId });
    const after = await repo.read();
    for (const finding of preserved) expect(after.findings.find(item => item.id === finding.id)).toEqual(finding);
    expect(after.findings.filter(finding => finding.studentId === 'stu-03')).toHaveLength(1);
    expect(after.responseRevisions).toEqual(edited.responseRevisions);
    expect(after.readingReviews).toEqual(edited.readingReviews);
    expect(after.responses).toEqual(edited.responses);
    expect(after.submissions).toEqual(edited.submissions);
    expect(after.observations).toEqual(edited.observations);
    expect(after.findings.some(finding => finding.studentId === 'stu-07' && finding.status === 'candidate' && finding.code === 'correct_with_support')).toBe(true);
    expect(network).not.toHaveBeenCalled();
  }, 30000);
  it('preserves an existing upload and refuses to disguise it as prepared sample analysis', async () => {
    const { batchId } = await loadDemo(actor, repo, { templateId: 'baseline-template-v1' });
    await repo.transact(state => { state.assets[0].source = 'upload'; });
    const uploaded = structuredClone((await repo.read()).batches[0]);
    expect(await loadDemo(actor, repo, { phase: 'baseline' })).toEqual({ batchId, existing: true, prepared: false });
    await expect(analyzeDemo(actor, repo, { batchId })).rejects.toMatchObject({ code: 'DEMO_ONLY' });
    for (const assignment of assignments) {
      const loaded = await loadDemo(actor, repo, { templateId: assignment.templateId });
      if (loaded.prepared) await analyzeDemo(actor, repo, { batchId: loaded.batchId });
    }
    const state = await repo.read(); expect(state.batches).toHaveLength(5);
    expect(state.batches.find(batch => batch.id === batchId)).toEqual(uploaded);
    expect(state.extractions).toHaveLength(32);
    expect(state.responses).toHaveLength(88);
    expect(state.submissions.filter(submission => submission.batchId === batchId).every(submission => !state.extractions.some(extraction => extraction.submissionId === submission.id))).toBe(true);
    expect(network).not.toHaveBeenCalled();
  }, 30000);
});
