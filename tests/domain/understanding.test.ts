import { describe, expect, it } from 'vitest';
import { getUnderstandingOverview } from '../../lib/understanding';
import { createInitialState, correctResponse, correctSupport, analyzeBatch, reviewFindings } from '../../lib/domain';
import { getQuestion } from '../../lib/curriculum';
import { assignments } from '../../lib/assignments';
import type { AppState, Batch, Response } from '../../lib/contracts';
import { seedAssignment, testProvenance } from './helpers';

const BASE = 'baseline-template-v1', FOLLOW = 'followup-template-v1', PRACTICE = 'fraction-practice-template-v1', WORDS = 'word-problems-template-v1', LAST = 'independent-check-template-v1';
const EQ = 'obj-equivalent-fractions', ADD = 'obj-add-unlike-fractions', CONTEXT = 'obj-explain-fraction-context';
const cell = (state: AppState, templateId = BASE, skillId = ADD, studentId = 'stu-04') => getUnderstandingOverview(state, templateId).students.find(student => student.studentId === studentId)!.skills.find(skill => skill.skillId === skillId)!.current;
function responses(state: AppState, batch: Batch) { return state.responses.filter(response => batch.submissionIds.includes(response.submissionId)); }
function completed(state: AppState, templateId = BASE, support: 'independent' | 'supported' | 'unknown' = 'independent') {
  const batch = seedAssignment(state, templateId, { studentIds: ['stu-04'], support });
  for (const response of responses(state, batch)) {
    const question = getQuestion(response.questionId);
    response.workingText = question.answerWorking.join('; ');
    response.answerText = `${question.expectedAnswer.canonicalFraction}${question.answerUnit ? ` ${question.answerUnit}` : ''}`;
    response.legibility = 'clear';
  }
  return batch;
}
function blank(response: Response) { response.workingText = ''; response.answerText = null; response.legibility = 'blank'; }

describe('transparent stages of demonstrated understanding', () => {
  it('returns three curriculum skills and dated active-student partitions, with no scores', () => {
    const state = createInitialState('teacher');
    state.students[7].active = false;
    const result = getUnderstandingOverview(state, LAST);
    expect(result.skills.map(skill => skill.id)).toEqual([EQ, ADD, CONTEXT]);
    expect(result.students).toHaveLength(7);
    expect(result.snapshots.map(point => point.date)).toEqual(assignments.map(assignment => assignment.date));
    for (const snapshot of result.snapshots) for (const skill of snapshot.skills) {
      expect(skill.counts.insufficient_evidence).toBe(7);
      expect(Object.values(skill.counts).reduce((a, b) => a + b, 0)).toBe(7);
    }
    expect(result).not.toHaveProperty('score');
    expect(JSON.stringify(result)).not.toMatch(/correctPercent|percentile|percentCorrect/);
  });

  it('requires inspectable working, not a page of correct answers', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    for (const response of responses(state, batch)) response.workingText = '';
    expect(cell(state).stage).toBe('insufficient_evidence');
    expect(cell(state).supportingEvidence).toEqual([]);
    expect(cell(state).reason).toContain('answer alone');
  });

  it('uses repeated current reasoning for independent stages, but one context response is still provisional', () => {
    const state = createInitialState('teacher'); completed(state);
    expect(cell(state, BASE, EQ).stage).toBe('independent');
    expect(cell(state, BASE, ADD).stage).toBe('independent');
    expect(cell(state, BASE, CONTEXT).stage).toBe('developing');
    expect(cell(state, BASE, CONTEXT).reason).toContain('One worked example');
  });

  it('can pair one current demonstration with an earlier same-demand demonstration and exposes both dates', () => {
    const state = createInitialState('teacher'); completed(state); completed(state, FOLLOW);
    const result = cell(state, FOLLOW, CONTEXT);
    expect(result.stage).toBe('independent');
    expect(new Set(result.supportingEvidence.map(ref => ref.activityDate))).toEqual(new Set(['2026-09-22', '2026-09-24']));
    expect(new Set(result.supportingEvidence.map(ref => ref.taskDifficulty))).toEqual(new Set(['core-transfer']));
  });

  it.each(['supported', 'unknown'] as const)('does not infer independence from %s help', support => {
    const state = createInitialState('teacher'); completed(state, BASE, support);
    for (const skillId of [EQ, ADD, CONTEXT]) expect(cell(state, BASE, skillId).stage).toBe('developing');
    completed(state, FOLLOW);
    expect(cell(state, FOLLOW, CONTEXT).stage).toBe('developing');
    expect(cell(state, FOLLOW, CONTEXT).supportingEvidence).toHaveLength(1);
  });

  it('does not carry prior stages into missing or unassessed dates, or treat those gaps as a decline', () => {
    const state = createInitialState('teacher'); completed(state);
    expect(cell(state, FOLLOW).stage).toBe('insufficient_evidence');
    expect(cell(state, FOLLOW).supportingEvidence).toEqual([]);
    expect(cell(state, FOLLOW).nextStep).toContain('missing work is not evidence');
    completed(state, PRACTICE);
    const context = cell(state, PRACTICE, CONTEXT);
    expect(context.stage).toBe('insufficient_evidence');
    expect(context.reason).toBe('This assignment does not assess this skill.');
    expect(context.nextStep).toContain('no change');
  });

  it('keeps future work and confirmations out of an earlier view', () => {
    const state = createInitialState('teacher'); completed(state);
    const before = getUnderstandingOverview(state, BASE);
    const future = completed(state, LAST);
    const findings = analyzeBatch(state, { batchId: future.id, provenance: testProvenance });
    reviewFindings(state, { items: findings.map(finding => ({ findingId: finding.id, expectedRevision: finding.revision, decision: 'confirm' as const })), acknowledgeClearReadings: true });
    expect(getUnderstandingOverview(state, BASE)).toEqual(before);
    expect(before.snapshots).toHaveLength(1);
  });

  it('requires explicitly shown difficulty rather than diagnosing blanks or a wrong answer alone', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    for (const response of responses(state, batch)) { response.workingText = ''; response.answerText = '1/99'; }
    expect(cell(state).stage).toBe('insufficient_evidence');
    expect(cell(state).counterEvidence).toEqual([]);
    for (const response of responses(state, batch)) {
      const [a, b] = getQuestion(response.questionId).operands;
      response.answerText = `${a.numerator + b.numerator}/${a.denominator + b.denominator}`;
      response.workingText = `${a.numerator}/${a.denominator} + ${b.numerator}/${b.denominator} = ${response.answerText}`;
    }
    expect(cell(state, BASE, EQ).stage).toBe('needs_support');
    expect(cell(state).stage).toBe('needs_support');
    expect(cell(state).counterEvidence).toHaveLength(4);
    responses(state, batch).forEach(blank);
    expect(cell(state).stage).toBe('insufficient_evidence');
    expect(cell(state).counterEvidence).toEqual([]);
  });

  it('separates correctly renamed fractions from an explicit arithmetic slip', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    const answers = responses(state, batch);
    answers.forEach(blank);
    Object.assign(answers.find(response => response.questionId === 'q-01')!, { workingText: '1/2 = 3/6; 1/3 = 2/6; 3/6 + 2/6 = 4/6', answerText: '4/6', legibility: 'clear' });
    Object.assign(answers.find(response => response.questionId === 'q-02')!, { workingText: '1/4 = 3/12; 2/3 = 8/12; 3/12 + 8/12 = 10/12', answerText: '10/12', legibility: 'clear' });
    expect(cell(state, BASE, EQ).stage).toBe('independent');
    expect(cell(state, BASE, ADD).stage).toBe('needs_support');
    expect(cell(state, BASE, ADD).nextStep).toContain('Keep the correct renaming');
  });

  it('keeps mixed demonstrated and counter-evidence visible rather than choosing only successes', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    const first = responses(state, batch).find(response => response.questionId === 'q-01')!;
    Object.assign(first, { workingText: '1/2 + 1/3 = 2/5', answerText: '2/5' });
    const result = cell(state);
    expect(result.stage).toBe('developing');
    expect(result.supportingEvidence).toHaveLength(3);
    expect(result.counterEvidence).toHaveLength(1);
  });

  it('does not let an unexplained wrong answer coexist with a claim of independent consistency', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    Object.assign(responses(state, batch)[0], { workingText: '', answerText: '1/99' });
    expect(cell(state).stage).toBe('developing');
    expect(cell(state).reason).toContain('needs an explanation');
  });

  it('never treats unclear, contradictory or unfinished work as positive evidence', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    for (const response of responses(state, batch)) response.legibility = 'uncertain';
    expect(cell(state).stage).toBe('insufficient_evidence');
    expect(cell(state).supportingEvidence).toEqual([]);
    for (const response of responses(state, batch)) { response.legibility = 'clear'; response.answerText = null; }
    expect(cell(state).supportingEvidence).toEqual([]);
    expect(cell(state).stage).toBe('insufficient_evidence');
    for (const response of responses(state, batch)) { response.answerText = '1/99'; response.workingText = '1/2 = 1/3'; }
    expect(cell(state).supportingEvidence).toEqual([]);
    expect(cell(state).counterEvidence).toEqual([]);
  });

  it('blocks independence when a teacher-verified current reading contains a false equality', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    const response = responses(state, batch).find(item => item.questionId === 'q-01')!;
    correctResponse(state, response.id, { expectedRevision: response.revision, workingText: '1/2 = 1/3; 1/3 = 2/6; 3/6 + 2/6 = 5/6', answerText: '5/6', legibility: 'clear', readingStatus: 'resolved', reason: 'Confirmed this is what the student wrote.' });
    for (const skillId of [EQ, ADD]) {
      const result = cell(state, BASE, skillId);
      expect(result.stage).toBe('developing');
      expect(result.counterEvidence[0]).toMatchObject({ responseId: response.id, responseRevision: 2, readingReviewed: true });
      expect(result.supportingEvidence.some(ref => ref.responseId === response.id)).toBe(false);
    }
  });

  it('keeps a verified conflict between renamed fractions from supporting independence now or later', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    const response = responses(state, batch).find(item => item.questionId === 'q-01')!;
    correctResponse(state, response.id, { expectedRevision: response.revision, workingText: '1/2 = 3/6; 1/3 = 2/6; 3/6 = 1/6; 3/6 + 2/6 = 5/6', answerText: '5/6', legibility: 'clear', readingStatus: 'resolved', reason: 'Verified the literal conflicting working.' });
    for (const skillId of [EQ, ADD]) {
      const current = cell(state, BASE, skillId);
      expect(current.stage).toBe('developing');
      expect(current.counterEvidence).toEqual([expect.objectContaining({ responseId: response.id, readingReviewed: true, note: expect.stringContaining('conflicting steps') })]);
      expect(current.nextStep).toContain('check the equality');
    }
    const next = completed(state, FOLLOW);
    blank(responses(state, next)[1]);
    for (const skillId of [EQ, ADD]) {
      const later = cell(state, FOLLOW, skillId);
      expect(later.stage).toBe('developing');
      expect(later.supportingEvidence).toHaveLength(1);
      expect(later.supportingEvidence[0].templateId).toBe(FOLLOW);
    }
  });

  it('does not combine different task demands or skip a newer worked difficulty to establish independence', () => {
    const state = createInitialState('teacher'); completed(state, WORDS);
    const latest = completed(state, LAST);
    for (const response of responses(state, latest).slice(1)) blank(response);
    expect(cell(state, LAST, ADD).stage).toBe('developing');
    expect(cell(state, LAST, ADD).supportingEvidence).toHaveLength(1);
    const second = createInitialState('teacher'); completed(second);
    const followup = completed(second, FOLLOW);
    const context = responses(second, followup).find(response => getQuestion(response.questionId).learningObjectiveIds.includes(CONTEXT))!;
    const [a, b] = getQuestion(context.questionId).operands;
    context.answerText = `${a.numerator + b.numerator}/${a.denominator + b.denominator} meter`;
    context.workingText = `${a.numerator}/${a.denominator} + ${b.numerator}/${b.denominator} = ${context.answerText}`;
    completed(second, LAST);
    expect(cell(second, LAST, CONTEXT).stage).toBe('developing');
    expect(cell(second, LAST, CONTEXT).supportingEvidence).toHaveLength(1);
  });

  it('requires units for application while preserving demonstrated addition', () => {
    const state = createInitialState('teacher'), batch = completed(state, WORDS);
    for (const response of responses(state, batch)) response.answerText = getQuestion(response.questionId).expectedAnswer.canonicalFraction;
    expect(cell(state, WORDS, ADD).stage).toBe('independent');
    expect(cell(state, WORDS, CONTEXT).stage).toBe('developing');
    expect(cell(state, WORDS, CONTEXT).nextStep).toContain('unit');
  });

  it('uses the latest effective upload once and does not preserve a stale positive stage', () => {
    const state = createInitialState('teacher'); completed(state);
    expect(cell(state).stage).toBe('independent');
    const replacement = completed(state);
    responses(state, replacement).forEach(blank);
    const current = cell(state);
    expect(current.stage).toBe('insufficient_evidence');
    expect(current.currentEvidenceCount).toBe(4);
    expect(current.otherEvidence.every(ref => ref.batchId === replacement.id)).toBe(true);
  });

  it('lets newer worked evidence replace earlier concerns without a permanent label', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, BASE, { studentIds: ['stu-01'] });
    expect(cell(state, BASE, ADD, 'stu-01').stage).toBe('needs_support');
    const later = seedAssignment(state, LAST, { studentIds: ['stu-01'] });
    expect(cell(state, LAST, ADD, 'stu-01').stage).toBe('independent');
    expect(cell(state, LAST, ADD, 'stu-01').counterEvidence).toEqual([]);
    expect(cell(state, LAST, ADD, 'stu-01').supportingEvidence.every(ref => ref.batchId === later.id)).toBe(true);
  });

  it('preserves exact revisions and help snapshots in evidence and never mutates state', () => {
    const state = createInitialState('teacher'), batch = completed(state);
    const response = responses(state, batch)[0];
    const original = structuredClone(response);
    correctResponse(state, response.id, { expectedRevision: response.revision, workingText: response.workingText, answerText: response.answerText, legibility: 'clear', readingStatus: 'resolved', reason: 'Checked visible writing.' });
    const submission = state.submissions.find(item => item.id === response.submissionId)!;
    correctSupport(state, submission.id, { expectedRevision: submission.revision, support: { level: 'supported', source: 'teacher-corrected', note: 'Teacher supplied a denominator prompt.' }, reason: 'Record the actual help.' });
    const snapshot = structuredClone(state);
    const result = cell(state);
    const ref = result.supportingEvidence.find(item => item.responseId === response.id)!;
    expect(result.stage).toBe('developing');
    expect(ref).toMatchObject({ responseRevision: 2, submissionRevision: 2, support: { level: 'supported' }, readingReviewed: true });
    expect(ref.href).toContain(`response=${response.id}`);
    expect(ref.href).toContain('revision=2');
    expect(ref.href).toContain('#answer-inspector');
    expect(state).toEqual(snapshot);
    expect(state.responseRevisions[0].before).toEqual(original);
  });
});
