import type { AppState, Batch, Finding, MathCheck, Response, Submission, SupportContext } from './contracts';
import { assignments, getAssignment, type Assignment } from './assignments';
import { getQuestion, getTemplate, type Question } from './curriculum';
import { checkMath, equalFractions, parseFraction } from './domain/math';

export type ResultBucket = 'correct' | 'incorrect' | 'flagged' | 'unanswered' | 'unprocessed' | 'not_received';
export type AnalyticsFilters = { studentId?: string; questionId?: string; result?: ResultBucket | 'all'; support?: SupportContext['level'] | 'all'; objectiveId?: string; difficulty?: string; reviewed?: boolean };
export type ResultCounts = Record<ResultBucket, number> & { total: number; usable: number; correctPercent: number | null };
export type AnswerSlot = {
  id: string; assignmentId: string; templateId: string; studentId: string; questionId: string;
  batchId?: string; submissionId?: string; responseId?: string; responseRevision?: number;
  bucket: ResultBucket; numericResult: 'correct' | 'incorrect' | 'unknown';
  supportLevel: SupportContext['level']; teacherReviewed: boolean; reviewReasons: string[];
  facets: { unitStatus: MathCheck['unitStatus']; reasoning: 'demonstrated' | 'not_established' | 'contradictory'; hasWorking: boolean; partialWork: boolean; contradictions: string[] };
  question: Question; response?: Response; submission?: Submission; batch?: Batch; attemptCount: number;
};
export type AssignmentAnalytics = { assignment: Assignment; slots: AnswerSlot[]; allSlots: AnswerSlot[]; counts: ResultCounts; expectedStudents: number; submittedStudents: number; totalAttempts: number };

/** Current answers are selected once per assignment/student, never once per upload. */
export function selectEffectiveSubmissions(state: AppState, templateId: string): Submission[] {
  const batches = new Set(state.batches.filter(b => b.templateId === templateId).map(b => b.id));
  const attempts = state.submissions.filter(s => batches.has(s.batchId));
  const superseded = new Set(attempts.map(s => s.supersedesSubmissionId).filter(Boolean));
  const current = new Map<string, Submission>();
  // The persisted append order breaks timestamp ties and preserves a deterministic
  // legacy policy for uploads saved before explicit replacement links existed.
  for (const submission of attempts) {
    if (superseded.has(submission.id)) continue;
    const previous = current.get(submission.studentId);
    if (!previous || submission.createdAt >= previous.createdAt) current.set(submission.studentId, submission);
  }
  return [...current.values()];
}

/** Resolve the evidence revision requested by an observation without relabeling it. */
export function selectResponseRevision(state: AppState, responseId: string, revision?: number): Response | undefined {
  const current = state.responses.find(r => r.id === responseId);
  if (revision === undefined || current?.revision === revision) return current;
  for (const record of state.responseRevisions) {
    if (record.responseId !== responseId) continue;
    if (record.before.revision === revision) return record.before;
    if (record.after.revision === revision) return record.after;
  }
  return undefined;
}

export function isReadingVerified(state: AppState, response: Response): boolean {
  return state.readingReviews.some(review => review.responseId === response.id && review.responseRevision === response.revision);
}

/** Recalculate display facets without altering the saved mathematical check/history. */
export function classifyResponse(state: AppState, response: Response, question = getQuestion(response.questionId)) {
  const teacherReviewed = isReadingVerified(state, response);
  const hasWorking = !!response.workingText.trim();
  const hasAnswer = !!response.answerText?.trim();
  const checked = checkMath(question, response.workingText, response.answerText, teacherReviewed && response.legibility === 'uncertain' ? 'clear' : response.legibility);
  const parsed = parseFraction(response.answerText);
  const numericResult = parsed ? equalFractions(parsed, checked.expected) ? 'correct' : 'incorrect' : 'unknown';
  const reviewReasons: string[] = [];
  if (response.legibility === 'uncertain' && !teacherReviewed) reviewReasons.push('Verify the unclear reading.');
  if (response.legibility === 'blank' && (hasWorking || hasAnswer)) reviewReasons.push('The blank label conflicts with the recorded writing.');
  if (hasAnswer && !parsed) reviewReasons.push('This answer format needs a teacher check.');
  const blocksNumericResult = reviewReasons.length > 0 || (!teacherReviewed && checked.contradictions.length > 0);
  reviewReasons.push(...checked.contradictions);
  // No final answer is a missing response, not a mathematical mistake. Keep
  // partial working and any reading issues accessible as secondary facets.
  const bucket: ResultBucket = !hasAnswer ? 'unanswered' : blocksNumericResult ? 'flagged' : numericResult === 'correct' ? 'correct' : 'incorrect';
  return {
    bucket, numericResult: numericResult as AnswerSlot['numericResult'], teacherReviewed, reviewReasons,
    facets: { unitStatus: checked.unitStatus, reasoning: checked.contradictions.length ? 'contradictory' as const : checked.equivalentReasoning ? 'demonstrated' as const : 'not_established' as const, hasWorking, partialWork: hasWorking && !hasAnswer, contradictions: checked.contradictions },
  };
}

export function countResults(slots: readonly Pick<AnswerSlot, 'bucket'>[]): ResultCounts {
  const counts: ResultCounts = { correct: 0, incorrect: 0, flagged: 0, unanswered: 0, unprocessed: 0, not_received: 0, total: slots.length, usable: 0, correctPercent: null };
  for (const slot of slots) counts[slot.bucket]++;
  counts.usable = counts.correct + counts.incorrect;
  counts.correctPercent = counts.usable ? counts.correct / counts.usable * 100 : null;
  return counts;
}

export function getAssignmentAnalytics(state: AppState, templateId: string, filters: AnalyticsFilters = {}): AssignmentAnalytics {
  const assignment = getAssignment(templateId);
  if (!assignment) throw new Error(`Unknown assignment: ${templateId}`);
  const template = getTemplate(templateId), effective = selectEffectiveSubmissions(state, templateId);
  const assignmentBatchIds = new Set(state.batches.filter(b => b.templateId === templateId).map(b => b.id));
  const allSlots = state.students.filter(s => s.active).flatMap(student => {
    const submission = effective.find(s => s.studentId === student.id), batch = state.batches.find(b => b.id === submission?.batchId);
    const attemptCount = state.submissions.filter(s => s.studentId === student.id && assignmentBatchIds.has(s.batchId)).length;
    return template.questionIds.map(questionId => {
      const question = getQuestion(questionId), response = state.responses.find(r => r.submissionId === submission?.id && r.questionId === questionId);
      const classified = response ? classifyResponse(state, response, question) : {
        bucket: submission ? 'unprocessed' as const : 'not_received' as const, numericResult: 'unknown' as const, teacherReviewed: false, reviewReasons: [],
        facets: { unitStatus: question.answerUnit ? 'unresolved' as const : 'not_required' as const, reasoning: 'not_established' as const, hasWorking: false, partialWork: false, contradictions: [] },
      };
      return { id: `${assignment.id}:${student.id}:${questionId}`, assignmentId: assignment.id, templateId, studentId: student.id, questionId, batchId: batch?.id, submissionId: submission?.id, responseId: response?.id, responseRevision: response?.revision, ...classified, supportLevel: submission?.support.level ?? 'unknown', question, response, submission, batch, attemptCount } satisfies AnswerSlot;
    });
  });
  const slots = allSlots.filter(slot => (!filters.studentId || slot.studentId === filters.studentId) && (!filters.questionId || slot.questionId === filters.questionId) && (!filters.result || filters.result === 'all' || slot.bucket === filters.result) && (!filters.support || filters.support === 'all' || slot.supportLevel === filters.support) && (!filters.objectiveId || slot.question.learningObjectiveIds.includes(filters.objectiveId)) && (!filters.difficulty || slot.question.taskDifficulty === filters.difficulty) && (filters.reviewed === undefined || slot.teacherReviewed === filters.reviewed));
  const selectedStudents = state.students.filter(s => s.active && (!filters.studentId || s.id === filters.studentId));
  return { assignment, allSlots, slots, counts: countResults(slots), expectedStudents: selectedStudents.length, submittedStudents: selectedStudents.filter(s => effective.some(e => e.studentId === s.id)).length, totalAttempts: state.submissions.filter(s => assignmentBatchIds.has(s.batchId) && (!filters.studentId || s.studentId === filters.studentId)).length };
}

function currentEvidence(state: AppState, finding: Finding): boolean {
  return finding.evidence.every(ref => state.responses.some(r => r.id === ref.responseId && r.revision === ref.responseRevision)) && finding.supportSnapshots.every(snapshot => state.submissions.some(s => s.id === snapshot.submissionId && s.revision === snapshot.submissionRevision));
}

/** Teacher notes for the effective attempts, including a stale note needing refresh. */
export function currentAssignmentFindings(state: AppState, templateId: string): Finding[] {
  const effective = selectEffectiveSubmissions(state, templateId);
  return state.findings.filter((finding, index) => {
    if (finding.status === 'rejected' || !effective.some(s => s.studentId === finding.studentId && s.batchId === finding.batchId)) return false;
    if (finding.status !== 'stale') return currentEvidence(state, finding);
    return !state.findings.slice(index + 1).some(next => next.batchId === finding.batchId && next.studentId === finding.studentId && next.objectiveId === finding.objectiveId && ['candidate', 'confirmed'].includes(next.status) && currentEvidence(state, next));
  });
}

/** Latest submitted assignment wins per student and objective, even before review. */
export function getCurrentSkillFindings(state: AppState, options: { studentId?: string; objectiveId?: string; beforeDate?: string } = {}): Finding[] {
  const latest = new Map<string, { assignment: Assignment; submission: Submission; date: string }>();
  for (const assignment of assignments) {
    const template = getTemplate(assignment.templateId);
    const objectives = new Set(template.questionIds.flatMap(id => getQuestion(id).learningObjectiveIds));
    for (const submission of selectEffectiveSubmissions(state, assignment.templateId)) {
      if (options.studentId && submission.studentId !== options.studentId) continue;
      const date = state.batches.find(batch => batch.id === submission.batchId)!.activityDate;
      if (options.beforeDate && date >= options.beforeDate) continue;
      for (const objectiveId of objectives) if (!options.objectiveId || objectiveId === options.objectiveId) {
        const key = `${submission.studentId}:${objectiveId}`, previous = latest.get(key);
        if (!previous || date > previous.date || (date === previous.date && assignment.sequence >= previous.assignment.sequence)) latest.set(key, { assignment, submission, date });
      }
    }
  }
  return state.findings.filter(finding => {
    const current = latest.get(`${finding.studentId}:${finding.objectiveId}`);
    return finding.status === 'confirmed' && current?.submission.batchId === finding.batchId && currentEvidence(state, finding);
  });
}
