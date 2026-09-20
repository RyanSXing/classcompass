import { describe, expect, it } from 'vitest';
import { getLearningInsights } from '../../lib/learning-insights';
import { analyzeBatch, correctResponse, correctSupport, createInitialState, reviewFindings } from '../../lib/domain';
import { getQuestion } from '../../lib/curriculum';
import type { AppState } from '../../lib/contracts';
import { seedAssignment, testProvenance } from './helpers';

function confirm(state: AppState, batchId: string) {
  const findings = analyzeBatch(state, { batchId, provenance: testProvenance });
  reviewFindings(state, { items: findings.map(f => ({ findingId: f.id, expectedRevision: f.revision, decision: 'confirm' as const })), acknowledgeClearReadings: true });
  return findings;
}

describe('learning development, without overall scores', () => {
  it('keeps missing or unprocessed work as an open question and offers a practical next step', () => {
    const state = createInitialState('teacher');
    const empty = getLearningInsights(state, 'baseline-template-v1');
    expect(empty.trends).toEqual([]);
    expect(empty.summary).toContain('no submitted work');
    expect(empty.lessonDirection?.title).toBe('Collect the missing work');
    expect(empty.lessonDirection?.evidence).toEqual([]);
    seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-01'], extract: false });
    const unread = getLearningInsights(state, 'baseline-template-v1');
    expect(unread.lessonDirection?.title).toBe('Read the uploaded worksheets');
    expect(unread.trends).toEqual([]);
    expect(unread.followUps[0]).toMatchObject({ studentId: 'stu-01', status: 'limited_evidence' });
    expect(unread).not.toHaveProperty('score');
    expect(unread).not.toHaveProperty('correctPercent');
  });

  it('does not let future work, future approvals or future lesson targets leak into an earlier view', () => {
    const state = createInitialState('teacher');
    const baseline = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-01'] });
    confirm(state, baseline.id);
    const before = getLearningInsights(state, baseline.templateId);
    const later = seedAssignment(state, 'independent-check-template-v1', { studentIds: ['stu-01'] });
    confirm(state, later.id);
    const after = getLearningInsights(state, baseline.templateId);
    expect(after).toEqual(before);
    expect(after.lessonDirection?.lessonId).toBe('lesson-2026-09-23');
    expect(after.trends.flatMap(t => t.evidence).every(ref => ref.activityDate <= baseline.activityDate)).toBe(true);
  });

  it('shows a move from supported to independent work on comparable dated tasks without claiming mastery', () => {
    const state = createInitialState('teacher');
    const baseline = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-07'], support: 'supported' });
    confirm(state, baseline.id);
    const followup = seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-07'] });
    confirm(state, followup.id);
    const result = getLearningInsights(state, followup.templateId);
    const trend = result.trends.find(t => t.kind === 'less_help')!;
    expect(trend).toMatchObject({ studentIds: ['stu-07'], status: 'reviewed', dateRange: { from: baseline.activityDate, to: followup.activityDate } });
    expect(new Set(trend.evidence.map(ref => ref.support.level))).toEqual(new Set(['supported', 'independent']));
    expect(trend.comparability).toContain('help conditions changed');
    expect(trend.evidence.every(ref => ref.href.includes(`response=${ref.responseId}`) && ref.href.includes(`revision=${ref.responseRevision}`) && ref.href.endsWith('#answer-inspector'))).toBe(true);
    expect(trend.description).not.toMatch(/mastered|mastery|improved by|%/i);
  });

  it('does not turn unknown help into a claim that less support was needed', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-07'], support: 'unknown' });
    seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-07'] });
    const result = getLearningInsights(state, 'followup-template-v1');
    expect(result.trends.some(t => t.kind === 'less_help')).toBe(false);
    expect(result.trends.find(t => t.kind === 'independence_recorded')?.description).toContain('Earlier independence remains unknown');
  });

  it('records increased assistance as changed conditions, not regression', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-04'] });
    seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-04'], support: 'supported' });
    const trend = getLearningInsights(state, 'followup-template-v1').trends.find(t => t.kind === 'more_help');
    expect(trend?.description).toContain('does not show a loss of skill');
    expect(trend?.status).toBe('suggested');
  });

  it('requires explicit worked patterns on both dates for a recurring difficulty', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-03', 'stu-08'] });
    seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-03', 'stu-08'] });
    const result = getLearningInsights(state, 'followup-template-v1');
    expect(result.trends.find(t => t.kind === 'repeated_difficulty')?.studentIds).toEqual(['stu-03']);
    expect(result.trends.filter(t => t.kind === 'repeated_difficulty').flatMap(t => t.evidence).every(ref => ref.studentId !== 'stu-08')).toBe(true);
    for (const response of state.responses.filter(r => state.submissions.find(s => s.id === r.submissionId)?.studentId === 'stu-03')) response.workingText = '';
    expect(getLearningInsights(state, 'followup-template-v1').trends.some(t => t.kind === 'repeated_difficulty')).toBe(false);
  });

  it('does not compare success on different task demands as like-for-like improvement', () => {
    const state = createInitialState('teacher');
    const baseline = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-05'] });
    const current = seedAssignment(state, 'word-problems-template-v1', { studentIds: ['stu-05'] });
    for (const response of state.responses.filter(r => baseline.submissionIds.includes(r.submissionId) && getQuestion(r.questionId).learningObjectiveIds.includes('obj-explain-fraction-context'))) {
      response.answerText = null; response.workingText = ''; response.legibility = 'blank';
    }
    const result = getLearningInsights(state, current.templateId);
    const consistency = result.trends.filter(t => t.kind === 'independent_consistency');
    for (const trend of consistency) expect(new Set(trend.evidence.map(ref => ref.taskDifficulty)).size).toBe(1);
    const application = result.trends.find(t => t.kind === 'applying_context');
    expect(application?.comparability).toContain('not a like-for-like score comparison');
  });

  it('does not infer independent consistency from correct answers alone or supported work', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-04'], support: 'supported' });
    seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-04'], support: 'supported' });
    expect(getLearningInsights(state, 'followup-template-v1').trends.some(t => t.kind === 'independent_consistency')).toBe(false);
    for (const submission of state.submissions) submission.support.level = 'independent';
    for (const response of state.responses) response.workingText = '';
    const result = getLearningInsights(state, 'followup-template-v1');
    expect(result.trends.some(t => t.kind === 'independent_consistency')).toBe(false);
    expect(result.allFollowUps.find(item => item.studentId === 'stu-04')?.title).toBe('Ask them to explain their method');
  });

  it('preserves historical reading revisions and support snapshots while trends use current valid evidence', () => {
    const state = createInitialState('teacher');
    const baseline = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-07'] });
    confirm(state, baseline.id);
    const originalObservation = state.observations[0];
    const submission = state.submissions.find(s => s.id === baseline.submissionIds[0])!;
    const response = state.responses.find(r => r.submissionId === submission.id)!;
    correctSupport(state, submission.id, { expectedRevision: submission.revision, support: { level: 'supported', source: 'teacher-corrected', note: 'A denominator prompt was given.' }, reason: 'Corrected the assistance record.' });
    correctResponse(state, response.id, { expectedRevision: response.revision, workingText: response.workingText, answerText: response.answerText, legibility: 'clear', readingStatus: 'resolved', reason: 'Checked the original writing.' });
    confirm(state, baseline.id);
    const followup = seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-07'] });
    confirm(state, followup.id);
    const result = getLearningInsights(state, followup.templateId);
    const history = result.reviewedHistory.find(item => item.id === originalObservation.id)!;
    const old = history.evidence.find(ref => ref.responseId === response.id)!;
    expect(history.status).toBe('superseded');
    expect(old).toMatchObject({ responseRevision: 1, submissionRevision: 1, support: { level: 'independent' }, observationId: originalObservation.id });
    expect(old.href).toContain(`observation=${originalObservation.id}`);
    const current = result.trends.flatMap(t => t.evidence).find(ref => ref.responseId === response.id)!;
    expect(current).toMatchObject({ responseRevision: 2, submissionRevision: 2, support: { level: 'supported' } });
    expect(current.observationId).not.toBe(originalObservation.id);
  });

  it('excludes replaced uploads from trends without deleting their reviewed history', () => {
    const state = createInitialState('teacher');
    const baseline = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-03'] });
    confirm(state, baseline.id);
    seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-03'] });
    const replacement = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-03'], extract: false });
    const result = getLearningInsights(state, 'followup-template-v1');
    expect(result.trends.some(t => t.kind === 'repeated_difficulty')).toBe(false);
    expect(result.reviewedHistory).toHaveLength(1);
    expect(result.reviewedHistory[0].status).toBe('superseded');
    expect(result.trends.flatMap(t => t.evidence).some(ref => ref.batchId === baseline.id)).toBe(false);
    expect(replacement.id).not.toBe(baseline.id);
  });

  it('keeps arithmetic slips distinct from a difficulty choosing common units', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'independent-check-template-v1', { studentIds: ['stu-04'] });
    const result = getLearningInsights(state, 'independent-check-template-v1');
    const followUp = result.allFollowUps.find(item => item.studentId === 'stu-04')!;
    expect(followUp.title).toBe('Check the addition after renaming');
    expect(followUp.minutes).toBe(5);
    expect(followUp.evidence.map(ref => ref.questionId)).toEqual(['ic02']);
    expect(followUp.nextStep).toContain('Keep the valid equivalent-fraction steps');
    expect(followUp.successCheck).toContain('numerators accurately');
  });

  it('does not call a changed denominator a numerator arithmetic slip', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'independent-check-template-v1', { studentIds: ['stu-04'] });
    const answer = state.responses.find(response => response.questionId === 'ic02')!;
    answer.workingText = '1/5 = 3/15; 2/3 = 10/15; 3/15 + 10/15 = 13/30';
    answer.answerText = '13/30';
    const result = getLearningInsights(state, 'independent-check-template-v1');
    expect(result.allFollowUps[0].title).not.toBe('Check the addition after renaming');
  });

  it('prioritizes specific checks over extension and includes contextual application in the five-task view', () => {
    const state = createInitialState('teacher');
    for (const templateId of ['baseline-template-v1', 'followup-template-v1', 'fraction-practice-template-v1', 'word-problems-template-v1', 'independent-check-template-v1']) seedAssignment(state, templateId);
    const result = getLearningInsights(state, 'independent-check-template-v1');
    expect(result.followUps.map(item => item.studentId)).toEqual(['stu-04', 'stu-03', 'stu-08']);
    expect(result.trends.some(trend => trend.kind === 'applying_context')).toBe(true);
    expect(new Set(result.trends.map(trend => trend.kind)).size).toBe(result.trends.length);
    expect(result.lessonDirection).toMatchObject({ title: 'Keep the lesson moving with short individual checks', minutes: 9, studentIds: ['stu-04', 'stu-03', 'stu-08'] });
    expect(result.lessonDirection?.reason).toContain('Devon');
    expect(result.lessonDirection?.reason).toContain('Casey, Harper');
    expect(result.lessonDirection?.lessonId).toBe('lesson-2026-10-01');
  });

  it('never uses a flagged response to establish independent consistency', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-04'] });
    const latest = seedAssignment(state, 'followup-template-v1', { studentIds: ['stu-04'] });
    const flagged = state.responses.filter(response => latest.submissionIds.includes(response.submissionId));
    for (const response of flagged) response.legibility = 'uncertain';
    const result = getLearningInsights(state, latest.templateId);
    expect(result.trends.some(trend => ['independent_consistency', 'applying_context'].includes(trend.kind))).toBe(false);
    expect(result.allFollowUps.find(item => item.studentId === 'stu-04')?.status).toBe('needs_reading');
  });

  it('does not describe the rest of the class as ready to continue when a different group needs reteaching', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'independent-check-template-v1');
    const submission = state.submissions.find(item => item.studentId === 'stu-03')!;
    for (const response of state.responses.filter(item => item.submissionId === submission.id).slice(0, 2)) {
      const [a, b] = getQuestion(response.questionId).operands;
      const wrong = `${a.numerator + b.numerator}/${a.denominator + b.denominator}`;
      response.answerText = wrong;
      response.workingText = `${a.numerator}/${a.denominator} + ${b.numerator}/${b.denominator} = ${wrong}`;
    }
    const result = getLearningInsights(state, 'independent-check-template-v1');
    expect(result.lessonDirection?.title).toBe('Reteach equal-sized parts');
    expect(result.lessonDirection?.studentIds).toEqual(['stu-03']);
  });

  it('has stable IDs, defaults to three followups and never mutates its source', () => {
    const state = createInitialState('teacher');
    seedAssignment(state, 'baseline-template-v1');
    const before = JSON.stringify(state);
    const first = getLearningInsights(state, 'baseline-template-v1');
    const second = getLearningInsights(state, 'baseline-template-v1', { followUpLimit: 8 });
    expect(first.followUps).toHaveLength(3);
    expect(second.followUps).toHaveLength(8);
    expect(first.allFollowUps.map(f => f.id)).toEqual(second.allFollowUps.map(f => f.id));
    expect(JSON.stringify(state)).toBe(before);
  });
});
