import type { AppState, Rational } from './contracts';
import { assignments, getAssignment, type Assignment } from './assignments';
import { getAssignmentAnalytics, isReadingVerified, type AnswerSlot } from './analytics';
import { curriculum, getTemplate } from './curriculum';
import { addFractions, checkMath, equalFractions, parseFraction } from './domain/math';
import type { LearningEvidence } from './learning-insights';

export type UnderstandingStage = 'needs_support' | 'developing' | 'independent' | 'insufficient_evidence';
export type UnderstandingEvidence = LearningEvidence & {
  role: 'supporting' | 'counter' | 'context';
  note: string;
};
export type UnderstandingCell = {
  id: string;
  studentId: string;
  skillId: string;
  templateId: string;
  assignmentId: string;
  date: string;
  stage: UnderstandingStage;
  reason: string;
  nextStep: string;
  supportingEvidence: UnderstandingEvidence[];
  counterEvidence: UnderstandingEvidence[];
  otherEvidence: UnderstandingEvidence[];
  currentEvidenceCount: number;
  comparison: 'same_demand' | 'changed_demand' | 'not_comparable';
  reviewStatus: 'reviewed' | 'partly_reviewed' | 'unreviewed';
};
export type SkillClassSnapshot = {
  templateId: string;
  assignmentId: string;
  title: string;
  date: string;
  skillId: string;
  counts: Record<UnderstandingStage, number>;
  studentIds: Record<UnderstandingStage, string[]>;
};
export type UnderstandingOverview = {
  assignment: Assignment;
  throughDate: string;
  skills: Array<{
    id: string;
    label: string;
    description: string;
    criteria: string[];
    current: SkillClassSnapshot;
    snapshots: SkillClassSnapshot[];
    nextStep: string;
  }>;
  snapshots: Array<{
    templateId: string;
    assignmentId: string;
    title: string;
    date: string;
    skills: SkillClassSnapshot[];
  }>;
  students: Array<{
    studentId: string;
    name: string;
    skills: Array<{ skillId: string; label: string; current: UnderstandingCell; cells: UnderstandingCell[] }>;
  }>;
  legend: Array<{ stage: UnderstandingStage; label: string; description: string }>;
  rules: string[];
  limitations: string[];
};

const EQUIVALENCE = 'obj-equivalent-fractions';
const ADDITION = 'obj-add-unlike-fractions';
const CONTEXT = 'obj-explain-fraction-context';
const skillDefinitions = [
  { id: EQUIVALENCE, label: 'Equivalent fractions', criteria: ['Rename the task’s addends without changing their values.', 'Represent both addends in the same fractional unit.'], nextStep: 'Use equal-length fraction strips; ask the student to rename both addends and explain why their values stay the same.' },
  { id: ADDITION, label: 'Adding fractions', criteria: ['Show the task’s addends in a common fractional unit.', 'Add the numerators accurately and keep the common unit.'], nextStep: 'Ask the student to rename the addends, add the numerators and check that the denominator still names the same-sized parts.' },
  { id: CONTEXT, label: 'Explaining and applying', criteria: ['Show a valid calculation for the word problem.', 'Interpret the total using the stated unit.'], nextStep: 'Ask the student to explain a fresh word problem, show the addition and finish with what the total measures.' },
];
const legend: UnderstandingOverview['legend'] = [
  { stage: 'needs_support', label: 'Needs support', description: 'This work shows a specific difficulty, with no complete worked example showing this skill yet.' },
  { stage: 'developing', label: 'Getting there', description: 'Some of the method is shown, help was given, or another independent example is needed. Check the mixed work.' },
  { stage: 'independent', label: 'Works independently', description: 'Two worked examples show this skill without help, including current work. Current mistakes still need checking.' },
  { stage: 'insufficient_evidence', label: 'Not enough evidence', description: 'Missing, unread, unclear or answer-only work cannot establish the skill. This is a gap, not a lower stage.' },
];
const rules = [
  'Stages describe the work shown on these tasks. They are suggestions for teacher review, not grades or permanent labels.',
  'Works independently requires two different worked responses completed without help. At least one must be current. Earlier work must be a similar task, with no more recent worked mistake for this skill.',
  'A correct answer alone does not show the method. Unclear or unfinished responses cannot establish the skill.',
  'Current worked mistakes need checking before calling the skill independent. Earlier mistakes do not override newer successful work.',
  'No stage is carried into a date with no fresh work to interpret. Not enough evidence is a gap, not a lower stage.',
];
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const unique = <T>(values: T[]) => [...new Set(values)];

/** A point represents current corrected readings of work from that date, not
 * a reconstruction of what the teacher knew at that moment. */
function stateThrough(state: AppState, assignment: Assignment): AppState {
  const allowed = new Set(assignments.filter(item => item.sequence <= assignment.sequence && item.date <= assignment.date).map(item => item.templateId));
  const batches = state.batches.filter(batch => allowed.has(batch.templateId) && batch.activityDate <= assignment.date);
  const batchIds = new Set(batches.map(batch => batch.id));
  const submissions = state.submissions.filter(item => batchIds.has(item.batchId));
  const submissionIds = new Set(submissions.map(item => item.id));
  return { ...state, batches, submissions, responses: state.responses.filter(item => submissionIds.has(item.submissionId)) };
}

function evidenceFor(state: AppState, slot: AnswerSlot, role: UnderstandingEvidence['role'], note: string): UnderstandingEvidence | undefined {
  if (!slot.response || !slot.submission || !slot.batch) return undefined;
  const response = slot.response, submission = slot.submission, batch = slot.batch;
  const observation = state.observations.find(item => !item.superseded && item.studentId === slot.studentId && item.evidence.some(ref => ref.responseId === response.id && ref.responseRevision === response.revision) && item.supportSnapshots.some(snapshot => snapshot.submissionId === submission.id && snapshot.submissionRevision === submission.revision));
  const params = new URLSearchParams({ student: slot.studentId, question: slot.questionId, response: response.id, revision: String(response.revision) });
  if (observation) params.set('observation', observation.id);
  return {
    id: `${response.id}:${response.revision}:${submission.revision}`,
    responseId: response.id, responseRevision: response.revision, submissionId: submission.id, submissionRevision: submission.revision,
    batchId: batch.id, studentId: slot.studentId, templateId: batch.templateId, questionId: slot.questionId,
    questionNumber: getTemplate(batch.templateId).questionIds.indexOf(slot.questionId) + 1,
    activityDate: batch.activityDate, dateLabel: dateLabel(batch.activityDate), taskDifficulty: slot.question.taskDifficulty,
    objectiveIds: [...slot.question.learningObjectiveIds], support: { ...submission.support }, readingReviewed: isReadingVerified(state, response),
    href: `/review/${batch.id}?${params.toString()}#answer-inspector`, role, note,
    ...(observation ? { observationId: observation.id, findingId: observation.findingId, findingRevision: observation.findingRevision } : {}),
  };
}

type WorkedMethod = { commonUnits: boolean; completeAddition: boolean; wrongAddition: boolean; invalidRename: boolean; partialRename: boolean; denominatorAddition: boolean };
/** Deliberately narrow symbolic checks. Unrecognized prose/models remain a
 * teacher-check request instead of being interpreted as missing understanding. */
function inspectMethod(slot: AnswerSlot): WorkedMethod {
  const response = slot.response!;
  const operands = slot.question.operands;
  const written = response.workingText;
  const renames: Array<{ from: Rational; to: Rational }> = [];
  let invalidRename = false;
  for (const match of written.matchAll(/(?=(\b\d+\s*\/\s*\d+)\s*=\s*(\d+\s*\/\s*\d+)(?![\d]|\s*\+))/g)) {
    // In a+b=c, b=c is not an asserted equivalence. Do not diagnose a
    // perfectly valid sum as an invalid renaming of the second addend.
    if (written.slice(0, match.index).trimEnd().endsWith('+')) continue;
    const from = parseFraction(match[1]), to = parseFraction(match[2]);
    if (!from || !to || !operands.some(operand => operand.numerator === from.numerator && operand.denominator === from.denominator)) continue;
    if (!equalFractions(from, to)) invalidRename = true;
    else if (from.denominator !== to.denominator) renames.push({ from, to });
  }
  const sharedRenames = renames.some(rename => operands.every(operand => operand.denominator === rename.to.denominator || renames.some(other => equalFractions(other.from, operand) && other.to.denominator === rename.to.denominator)));
  let commonUnits = sharedRenames, completeAddition = false, wrongAddition = false;
  for (const match of written.matchAll(/(?=(\d+\s*\/\s*\d+)\s*\+\s*(\d+\s*\/\s*\d+)\s*=\s*(\d+\s*\/\s*\d+))/g)) {
    const left = parseFraction(match[1]), right = parseFraction(match[2]), result = parseFraction(match[3]);
    if (!left || !right || !result || left.denominator !== right.denominator) continue;
    if (!((equalFractions(left, operands[0]) && equalFractions(right, operands[1])) || (equalFractions(right, operands[0]) && equalFractions(left, operands[1])))) continue;
    commonUnits = true;
    if (equalFractions(addFractions(left, right), result)) completeAddition = true;
    else wrongAddition = true;
  }
  const checked = checkMath(slot.question, written, response.answerText, 'clear');
  return { commonUnits, completeAddition, wrongAddition, invalidRename, partialRename: renames.length > 0, denominatorAddition: checked.denominatorAddition };
}

type EvidenceResult = { kind: 'supporting' | 'counter' | 'partial' | 'unavailable'; note: string; nextStep?: string };
function interpret(slot: AnswerSlot, skillId: string): EvidenceResult {
  if (slot.bucket === 'not_received') return { kind: 'unavailable', note: 'No worksheet has been received.' };
  if (slot.bucket === 'unprocessed') return { kind: 'unavailable', note: 'The uploaded work has not been read yet.' };
  if (slot.bucket === 'flagged') return { kind: 'unavailable', note: 'Check this reading before interpreting the skill.' };
  if (slot.bucket === 'unanswered') return { kind: 'unavailable', note: slot.facets.partialWork ? 'The response is unfinished; inspect its partial working.' : 'No response is recorded for this question.' };
  const method = inspectMethod(slot);
  const hasContradiction = slot.facets.reasoning === 'contradictory';
  // A verified literal reading can still contain false or conflicting maths.
  // Keep that as current evidence needing a check, even when the final answer
  // is right. Unverified conflicting readings return as flagged above.
  if (hasContradiction && slot.teacherReviewed) return {
    kind: 'counter',
    note: 'The checked reading contains conflicting steps, even though the final answer may be correct.',
    nextStep: 'Ask the student to explain which step they intended and check the equality together.',
  };
  if (skillId === EQUIVALENCE) {
    if (method.invalidRename || method.denominatorAddition) return { kind: 'counter', note: method.invalidRename ? 'The written renaming changes an addend’s value.' : 'The working adds denominators instead of making equal-sized parts.' };
    // A final arithmetic slip does not erase correctly shown equivalent fractions.
    if (method.commonUnits && !hasContradiction) return { kind: 'supporting', note: 'The task’s addends are shown in equivalent, common-sized parts.' };
    if (method.partialRename && !hasContradiction) return { kind: 'partial', note: 'One equivalent fraction is shown; both addends in common-sized parts are not yet established.' };
  } else if (skillId === ADDITION) {
    if (method.denominatorAddition || method.invalidRename || method.wrongAddition) return {
      kind: 'counter', note: method.wrongAddition ? 'The addends are correctly renamed, but the written sum does not match them.' : method.invalidRename ? 'A changed fraction value prevents a valid sum.' : 'The working adds denominators instead of retaining a common unit.',
      ...(method.wrongAddition ? { nextStep: 'Keep the correct renaming, then ask the student to add the two numerators again and check the written total.' } : {}),
    };
    if (method.completeAddition && slot.numericResult === 'correct' && !hasContradiction) return { kind: 'supporting', note: 'The working adds equivalent, common-unit fractions to the correct total.' };
    if (method.commonUnits && !hasContradiction) return { kind: 'partial', note: 'Common-sized parts are shown; the completed addition still needs checking.' };
  } else {
    if (method.denominatorAddition || method.invalidRename || method.wrongAddition) return { kind: 'counter', note: 'The written calculation does not yet support the word-problem total.', ...(method.wrongAddition ? { nextStep: 'Recheck the addition after renaming, then explain what the corrected total measures.' } : {}) };
    if (method.completeAddition && slot.numericResult === 'correct' && !hasContradiction) {
      if (slot.facets.unitStatus === 'correct') return { kind: 'supporting', note: 'Valid working and the stated unit explain the word-problem total.' };
      return { kind: 'partial', note: 'The calculation is shown, but what the total measures is missing.', nextStep: 'Ask what the total measures and have the student add the unit to the explanation.' };
    }
    if (method.commonUnits && !hasContradiction) return { kind: 'partial', note: 'The word problem has a valid common-unit setup; finish and interpret the total.' };
  }
  if (hasContradiction) return { kind: 'unavailable', note: 'The recorded reasoning conflicts; check the method with the student.' };
  return { kind: 'unavailable', note: slot.facets.hasWorking ? 'The written method needs a teacher interpretation before assigning a stage.' : 'An answer alone does not show how the student reasoned.' };
}

function buildCell(state: AppState, assignment: Assignment, studentId: string, skill: typeof skillDefinitions[number], slots: AnswerSlot[], previous: UnderstandingCell[]): UnderstandingCell {
  const relevant = slots.filter(slot => slot.studentId === studentId && slot.question.learningObjectiveIds.includes(skill.id));
  const interpreted = relevant.map(slot => ({ slot, result: interpret(slot, skill.id) }));
  const refs = (kind: EvidenceResult['kind']) => interpreted.filter(item => item.result.kind === kind).flatMap(({ slot, result }) => {
    const ref = evidenceFor(state, slot, kind === 'supporting' || kind === 'counter' ? kind : 'context', result.note);
    return ref ? [ref] : [];
  });
  let supportingEvidence = refs('supporting');
  const counterEvidence = refs('counter'), partial = refs('partial');
  const otherEvidence = [...partial, ...refs('unavailable')];
  const currentIndependent = supportingEvidence.filter(ref => ref.support.level === 'independent');
  const unexplainedWrong = interpreted.some(item => item.result.kind === 'unavailable' && item.slot.bucket === 'incorrect');
  const lastUsable = [...previous].reverse().find(cell => cell.supportingEvidence.some(ref => ref.templateId === cell.templateId) || cell.counterEvidence.length || cell.stage === 'developing');
  const previousCurrent = lastUsable?.supportingEvidence.filter(ref => ref.templateId === lastUsable.templateId) ?? [];
  const priorComparable = !lastUsable?.counterEvidence.length ? previousCurrent.filter(ref => ref.support.level === 'independent' && currentIndependent.some(current => current.taskDifficulty === ref.taskDifficulty) && ref.activityDate < assignment.date) : [];
  const previousDemands = unique(previous.flatMap(cell => [...cell.supportingEvidence, ...cell.counterEvidence].filter(ref => ref.templateId === cell.templateId).map(ref => ref.taskDifficulty)));
  const currentDemands = unique(relevant.map(slot => slot.question.taskDifficulty));
  const comparison: UnderstandingCell['comparison'] = !previousDemands.length || !currentDemands.length ? 'not_comparable' : currentDemands.every(demand => previousDemands.includes(demand)) ? 'same_demand' : 'changed_demand';
  let stage: UnderstandingStage = 'insufficient_evidence';
  let reason = !relevant.length ? 'This assignment does not assess this skill.' : interpreted.find(item => item.slot.response)?.result.note ?? interpreted[0]?.result.note ?? 'There is no work to interpret yet.';
  let nextStep = !relevant.length ? 'Include this skill in a future check; this gap shows no change in understanding.' : skill.nextStep;
  const independent = currentIndependent.length > 0 && currentIndependent.length + priorComparable.length >= 2 && !counterEvidence.length && !partial.length && !unexplainedWrong && supportingEvidence.length === currentIndependent.length;
  if (independent) {
    stage = 'independent';
    if (currentIndependent.length < 2) supportingEvidence = [...supportingEvidence, priorComparable[0]];
    reason = currentIndependent.length >= 2 ? 'Two or more current worked examples show this skill without help.' : 'Current work and an earlier similar problem both show this skill without help.';
    nextStep = 'Use a fresh problem to check that the student can explain the method again without help.';
  } else if (supportingEvidence.length || partial.length) {
    stage = 'developing';
    reason = counterEvidence.length ? 'Correct on some work; check the step that went wrong.' : unexplainedWrong ? 'The method is shown in some responses; another incorrect answer needs an explanation.' : supportingEvidence.some(ref => ref.support.level === 'unknown') ? 'The method is shown, but the help given is not recorded.' : supportingEvidence.some(ref => ref.support.level === 'supported') ? 'The method is shown with help; check a fresh problem without prompts.' : partial.length ? partial[0].note : 'One worked example shows this skill without help; check another.';
    nextStep = interpreted.find(item => item.result.nextStep)?.result.nextStep ?? (supportingEvidence.some(ref => ref.support.level !== 'independent') ? 'Record what help was given, then ask for a fresh problem completed without prompts.' : `Ask for another worked example. ${skill.nextStep}`);
  } else if (counterEvidence.length) {
    stage = 'needs_support';
    reason = counterEvidence[0].note;
    nextStep = interpreted.find(item => item.result.nextStep)?.result.nextStep ?? skill.nextStep;
  } else if (relevant.some(slot => slot.bucket === 'flagged')) {
    nextStep = 'Check the original writing with the student before deciding what to reteach.';
  } else if (relevant.every(slot => slot.bucket === 'not_received')) {
    nextStep = relevant.length ? 'Collect a short worked response; missing work is not evidence of a difficulty.' : nextStep;
  } else if (relevant.some(slot => slot.bucket === 'unprocessed')) {
    nextStep = 'Read the uploaded work, then inspect the method and recorded help.';
  } else {
    nextStep = 'Ask the student to finish a short response and explain the method. Missing work does not show a misconception.';
  }
  const unresolved = relevant.filter(slot => ['flagged', 'unanswered', 'unprocessed'].includes(slot.bucket));
  if (stage !== 'insufficient_evidence' && unresolved.length) reason += ' Unclear or unfinished responses remain separate checks.';
  const interpretedEvidence = [...supportingEvidence, ...counterEvidence, ...partial];
  const reviewed = interpretedEvidence.filter(ref => ref.readingReviewed).length;
  return {
    id: `${assignment.id}:${studentId}:${skill.id}`, studentId, skillId: skill.id, templateId: assignment.templateId, assignmentId: assignment.id, date: assignment.date,
    stage, reason, nextStep, supportingEvidence, counterEvidence, otherEvidence,
    currentEvidenceCount: relevant.filter(slot => slot.response).length, comparison,
    reviewStatus: reviewed && reviewed === interpretedEvidence.length ? 'reviewed' : reviewed ? 'partly_reviewed' : 'unreviewed',
  };
}

/** An ordinal, transparent description of demonstrated task skills. It never
 * mutates a response, finding, observation, plan, or teacher confirmation. */
export function getUnderstandingOverview(state: AppState, templateId: string): UnderstandingOverview {
  const assignment = getAssignment(templateId);
  if (!assignment) throw new Error(`Unknown assignment: ${templateId}`);
  const included = assignments.filter(item => item.sequence <= assignment.sequence && item.date <= assignment.date);
  const dated = included.map(item => {
    const scoped = stateThrough(state, item);
    return { assignment: item, state: scoped, slots: getAssignmentAnalytics(scoped, item.templateId).allSlots };
  });
  const students: UnderstandingOverview['students'] = state.students.filter(student => student.active).map(student => ({
    studentId: student.id, name: student.displayName,
    skills: skillDefinitions.map(skill => {
      const cells: UnderstandingCell[] = [];
      for (const item of dated) cells.push(buildCell(item.state, item.assignment, student.id, skill, item.slots, cells));
      return { skillId: skill.id, label: skill.label, current: cells.at(-1)!, cells };
    }),
  }));
  const snapshots = included.map(item => ({
    templateId: item.templateId, assignmentId: item.id, title: item.title, date: item.date,
    skills: skillDefinitions.map(skill => {
      const cells = students.map(student => student.skills.find(entry => entry.skillId === skill.id)!.cells.find(cell => cell.templateId === item.templateId)!);
      const studentIds = Object.fromEntries(legend.map(entry => [entry.stage, cells.filter(cell => cell.stage === entry.stage).map(cell => cell.studentId)])) as Record<UnderstandingStage, string[]>;
      const counts = Object.fromEntries(legend.map(entry => [entry.stage, studentIds[entry.stage].length])) as Record<UnderstandingStage, number>;
      return { templateId: item.templateId, assignmentId: item.id, title: item.title, date: item.date, skillId: skill.id, counts, studentIds };
    }),
  }));
  return {
    assignment, throughDate: assignment.date, students, snapshots,
    skills: skillDefinitions.map(skill => {
      const points = snapshots.map(snapshot => snapshot.skills.find(point => point.skillId === skill.id)!);
      const current = points.at(-1)!;
      const nextStep = !students.length ? 'Add active students before checking class understanding.' : current.counts.needs_support ? skill.nextStep : current.counts.developing ? 'Check the recorded help and ask for one fresh explanation from students still developing this skill.' : current.counts.insufficient_evidence ? 'Gather the missing worked evidence before drawing a class conclusion.' : 'Keep the planned lesson moving and use a fresh explanation to check the method transfers.';
      return { id: skill.id, label: skill.label, description: curriculum.objectives.find(objective => objective.id === skill.id)!.description, criteria: [...skill.criteria], current, snapshots: points, nextStep };
    }),
    legend: legend.map(item => ({ ...item })), rules: [...rules],
    limitations: [
      'The stages describe this work. They are not grades, mastery scores or permanent student labels.',
      'Dates use the latest effective upload and corrected reading for each assignment. Original readings and earlier help records remain available in evidence history.',
      'Tasks and help differ. Open both dates before judging a change; a stage change alone does not prove improvement or decline.',
      'The checker recognizes explicit fraction calculations. Unrecognized diagrams or explanations need a teacher interpretation, not a lower stage.',
      'Reviewed refers to the cited source readings. These derived stages do not approve teaching notes, assign groups or change a lesson.',
    ],
  };
}
