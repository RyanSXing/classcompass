import type {
  AppState,
  Finding,
  Observation,
  SupportContext,
} from "./contracts";
import { assignments, getAssignment, type Assignment } from "./assignments";
import {
  currentAssignmentFindings,
  getAssignmentAnalytics,
  isReadingVerified,
  selectResponseRevision,
  type AnswerSlot,
} from "./analytics";
import { curriculum, getQuestion, getTemplate } from "./curriculum";
import {
  addFractions,
  checkMath,
  equalFractions,
  findingWarnings,
  parseFraction,
} from "./domain";
import { getAssignmentInsights, type TeachingAction } from "./insights";

export type LearningStatus =
  | "reviewed"
  | "suggested"
  | "needs_reading"
  | "limited_evidence";
export type LearningEvidence = {
  id: string;
  responseId: string;
  responseRevision: number;
  batchId: string;
  submissionId: string;
  submissionRevision: number;
  templateId: string;
  studentId: string;
  questionId: string;
  questionNumber: number;
  activityDate: string;
  dateLabel: string;
  taskDifficulty: string;
  objectiveIds: string[];
  support: SupportContext;
  readingReviewed: boolean;
  href: string;
  findingId?: string;
  findingRevision?: number;
  observationId?: string;
};
export type LearningTrend = {
  id: string;
  kind:
    | "repeated_difficulty"
    | "less_help"
    | "independence_recorded"
    | "more_help"
    | "method_developing"
    | "independent_consistency"
    | "applying_context"
    | "starting_point";
  skillId: string;
  skill: string;
  title: string;
  description: string;
  status: LearningStatus;
  studentIds: string[];
  dateRange: { from: string; to: string };
  evidence: LearningEvidence[];
  nextStep: string;
  comparability: string;
};
export type LearningFollowUp = {
  id: string;
  studentId: string;
  title: string;
  reason: string;
  nextStep: string;
  steps: string[];
  minutes: number;
  successCheck: string;
  status: LearningStatus;
  evidence: LearningEvidence[];
};
export type LearningDecision = Omit<LearningFollowUp, "studentId"> & {
  lessonId: string;
  studentIds: string[];
};
export type LearningHistoryEntry = {
  id: string;
  studentId: string;
  skillId: string;
  skill: string;
  date: string;
  interpretation: string;
  status: "current" | "superseded";
  evidence: LearningEvidence[];
};
export type LearningInsights = {
  assignment: Assignment;
  throughDate: string;
  summary: string;
  trends: LearningTrend[];
  followUps: LearningFollowUp[];
  allFollowUps: LearningFollowUp[];
  lessonDirection: LearningDecision | null;
  reviewedHistory: LearningHistoryEntry[];
  limitations: string[];
};

const unique = <T>(items: T[]) => [...new Set(items)];
const skillLabel = (objectiveId: string) =>
  ({
    "obj-equivalent-fractions": "Equivalent fractions",
    "obj-add-unlike-fractions": "Adding unlike fractions",
    "obj-explain-fraction-context": "Using fractions in word problems",
  })[objectiveId] ??
  curriculum.objectives.find((objective) => objective.id === objectiveId)
    ?.description ??
  "The recorded skill";
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const refKey = (ref: LearningEvidence) =>
  `${ref.responseId}:${ref.responseRevision}:${ref.submissionRevision}:${ref.observationId ?? ""}`;
const uniqueEvidence = (refs: LearningEvidence[]) => [
  ...new Map(refs.map((ref) => [refKey(ref), ref])).values(),
];

/** Current corrected readings of work dated through the selected assignment.
 * This is not a reconstruction of what the teacher knew on that calendar day. */
function scopedState(state: AppState, assignment: Assignment): AppState {
  const templates = new Set(
    assignments
      .filter(
        (item) =>
          item.sequence <= assignment.sequence && item.date <= assignment.date,
      )
      .map((item) => item.templateId),
  );
  const batches = state.batches.filter(
    (batch) =>
      templates.has(batch.templateId) && batch.activityDate <= assignment.date,
  );
  const batchIds = new Set(batches.map((batch) => batch.id));
  const submissions = state.submissions.filter((submission) =>
    batchIds.has(submission.batchId),
  );
  const submissionIds = new Set(submissions.map((submission) => submission.id));
  const responses = state.responses.filter((response) =>
    submissionIds.has(response.submissionId),
  );
  const responseIds = new Set(responses.map((response) => response.id));
  return {
    ...state,
    batches,
    submissions,
    responses,
    findings: state.findings.filter(
      (finding) =>
        batchIds.has(finding.batchId) &&
        finding.evidence.every((ref) => responseIds.has(ref.responseId)),
    ),
    observations: state.observations.filter(
      (observation) =>
        observation.date <= assignment.date &&
        templates.has(observation.templateId),
    ),
    readingReviews: state.readingReviews.filter((review) =>
      responseIds.has(review.responseId),
    ),
    responseRevisions: state.responseRevisions.filter((revision) =>
      responseIds.has(revision.responseId),
    ),
  };
}

function validFindings(state: AppState, templateId: string): Finding[] {
  return currentAssignmentFindings(state, templateId).filter((finding) => {
    if (finding.status !== "confirmed") return false;
    try {
      return !findingWarnings(state, finding, {
        acknowledgeClear: true,
        batchId: finding.batchId,
      }).length;
    } catch {
      return false;
    }
  });
}

function evidenceFor(
  state: AppState,
  responseId: string,
  revision: number,
  finding?: Finding,
  observation?: Observation,
): LearningEvidence | undefined {
  const response = selectResponseRevision(state, responseId, revision);
  const submission = state.submissions.find(
    (item) => item.id === response?.submissionId,
  );
  const batch = state.batches.find((item) => item.id === submission?.batchId);
  if (!response || !submission || !batch) return undefined;
  const question = getQuestion(response.questionId);
  const snapshot =
    observation?.supportSnapshots.find(
      (item) => item.submissionId === submission.id,
    ) ??
    finding?.supportSnapshots.find(
      (item) => item.submissionId === submission.id,
    );
  const params = new URLSearchParams({
    student: submission.studentId,
    question: response.questionId,
    response: response.id,
    revision: String(revision),
  });
  if (observation) params.set("observation", observation.id);
  return {
    id: `${response.id}:${revision}:${snapshot?.submissionRevision ?? submission.revision}`,
    responseId: response.id,
    responseRevision: revision,
    batchId: batch.id,
    submissionId: submission.id,
    submissionRevision: snapshot?.submissionRevision ?? submission.revision,
    templateId: batch.templateId,
    studentId: submission.studentId,
    questionId: response.questionId,
    questionNumber:
      getTemplate(batch.templateId).questionIds.indexOf(response.questionId) +
      1,
    activityDate: batch.activityDate,
    dateLabel: dateLabel(batch.activityDate),
    taskDifficulty: question.taskDifficulty,
    objectiveIds: [...question.learningObjectiveIds],
    support: { ...(snapshot?.support ?? submission.support) },
    readingReviewed: isReadingVerified(state, response),
    href: `/review/${batch.id}?${params.toString()}#answer-inspector`,
    ...(finding
      ? { findingId: finding.id, findingRevision: finding.revision }
      : {}),
    ...(observation
      ? {
          observationId: observation.id,
          findingId: observation.findingId,
          findingRevision: observation.findingRevision,
        }
      : {}),
  };
}

function refsForSlots(
  state: AppState,
  slots: AnswerSlot[],
  findings: Finding[],
): LearningEvidence[] {
  return slots.flatMap((slot) => {
    if (!slot.response) return [];
    const finding = findings.find((note) =>
      note.evidence.some(
        (ref) =>
          ref.responseId === slot.responseId &&
          ref.responseRevision === slot.responseRevision,
      ),
    );
    const observation =
      finding &&
      state.observations.find(
        (item) =>
          !item.superseded &&
          item.findingId === finding.id &&
          item.findingRevision === finding.revision,
      );
    const ref = evidenceFor(
      state,
      slot.response.id,
      slot.response.revision,
      finding,
      observation,
    );
    return ref ? [ref] : [];
  });
}

type SkillSlice = {
  assignment: Assignment;
  studentId: string;
  skillId: string;
  difficulty: string;
  date: string;
  slots: AnswerSlot[];
};
type TrendWitness = {
  kind: LearningTrend["kind"];
  skillId: string;
  studentId: string;
  previous: SkillSlice;
  current: SkillSlice;
  evidence: LearningEvidence[];
};
const success = (slice: SkillSlice) =>
  slice.slots.filter(
    (slot) =>
      slot.bucket === "correct" &&
      slot.facets.reasoning === "demonstrated" &&
      (slice.skillId !== "obj-explain-fraction-context" ||
        slot.facets.unitStatus === "correct"),
  );
const completeSuccess = (slice: SkillSlice) =>
  slice.slots.length > 0 && success(slice).length === slice.slots.length;
const level = (slice: SkillSlice) => slice.slots[0]?.supportLevel ?? "unknown";
const denominatorErrors = (slice: SkillSlice) =>
  slice.slots.filter(
    (slot) =>
      slot.bucket === "incorrect" &&
      slot.response &&
      checkMath(
        slot.question,
        slot.response.workingText,
        slot.response.answerText,
        "clear",
      ).denominatorAddition,
  );
const priorities: Record<LearningTrend["kind"], number> = {
  repeated_difficulty: 100,
  more_help: 95,
  less_help: 90,
  independence_recorded: 85,
  method_developing: 84,
  applying_context: 80,
  independent_consistency: 70,
  starting_point: 0,
};

function trendText(kind: LearningTrend["kind"], students: number) {
  const who = students === 1 ? "This student" : "These students";
  switch (kind) {
    case "repeated_difficulty":
      return {
        title: "The same equal-parts difficulty appears again",
        description: `${who} added denominators in the working on two dates.`,
        nextStep:
          "Use equal-length fraction strips, then ask for one new sum and an explanation of why the part size stays the same.",
      };
    case "less_help":
      return {
        title: "Using the method with less help",
        description: `${who} used the common-denominator method with help earlier and independently on the later task.`,
        nextStep:
          "Give another comparable problem without prompts and record whether the student can explain each renaming step.",
      };
    case "independence_recorded":
      return {
        title: "Independent work is now recorded",
        description: `${who} showed the method independently on the latest task. The earlier work has no help record. Earlier independence remains unknown.`,
        nextStep:
          "Keep both help records and collect one more independent response before changing the learning goal.",
      };
    case "more_help":
      return {
        title: "The latest work used more support",
        description: `${who} used the method independently earlier and with help on the later task; this alone does not show a loss of skill.`,
        nextStep:
          "Ask what help was needed, then offer a short independent check of the same method.",
      };
    case "method_developing":
      return {
        title: "Common-unit working appears in the later task",
        description: `${who} added denominators in earlier working and then used a correct common-unit method independently on the later comparable task. Keep the earlier difficulty alongside this new evidence.`,
        nextStep:
          "Continue with one fresh problem, asking the student to explain why the denominators must name equal-sized parts.",
      };
    case "applying_context":
      return {
        title: "Using the method in word problems",
        description: `${who} used the method independently in calculations and then in word problems, including the correct units.`,
        nextStep:
          "Change the situation and ask the student to explain what the fraction and its unit represent.",
      };
    case "independent_consistency":
      return {
        title: "Independent working is becoming consistent",
        description: `${who} used the common-denominator method independently on two comparable tasks.`,
        nextStep:
          "Vary the denominators and ask for a justification; use that fresh evidence before adjusting the level of challenge.",
      };
    default:
      return {
        title: "A starting point for the next check",
        description:
          "There is not yet a comparable pair of dated observations for this skill.",
        nextStep:
          "Collect a short task on the same skill and record the help given.",
      };
  }
}

function makeTrends(
  state: AppState,
  assignment: Assignment,
  findings: Finding[],
): LearningTrend[] {
  const slices: SkillSlice[] = [];
  for (const item of assignments.filter(
    (item) => item.sequence <= assignment.sequence,
  )) {
    const slots = getAssignmentAnalytics(state, item.templateId).allSlots;
    for (const student of state.students.filter((student) => student.active)) {
      const submitted = slots.filter(
        (slot) => slot.studentId === student.id && slot.submission,
      );
      for (const skillId of unique(
        submitted.flatMap((slot) => slot.question.learningObjectiveIds),
      )) {
        for (const difficulty of unique(
          submitted
            .filter((slot) =>
              slot.question.learningObjectiveIds.includes(skillId),
            )
            .map((slot) => slot.question.taskDifficulty),
        )) {
          const matching = submitted.filter(
            (slot) =>
              slot.question.learningObjectiveIds.includes(skillId) &&
              slot.question.taskDifficulty === difficulty,
          );
          if (!matching.some((slot) => slot.response)) continue;
          slices.push({
            assignment: item,
            studentId: student.id,
            skillId,
            difficulty,
            date: matching[0].batch!.activityDate,
            slots: matching,
          });
        }
      }
    }
  }
  const witnesses: TrendWitness[] = [];
  for (const current of slices.filter(
    (slice) => slice.assignment.templateId === assignment.templateId,
  )) {
    const earlier = slices
      .filter(
        (slice) =>
          slice.studentId === current.studentId &&
          slice.skillId === current.skillId &&
          slice.date < current.date,
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.assignment.sequence - a.assignment.sequence,
      );
    const previous = earlier.find(
      (slice) => slice.difficulty === current.difficulty,
    );
    let kind: LearningTrend["kind"] | undefined;
    let before: AnswerSlot[] = [],
      after: AnswerSlot[] = [];
    if (previous) {
      const previousErrors = denominatorErrors(previous),
        currentErrors = denominatorErrors(current);
      const previousSuccess = success(previous),
        currentSuccess = success(current);
      if (
        previousErrors.length &&
        currentErrors.length &&
        previousErrors.length + currentErrors.length >= 2
      ) {
        kind = "repeated_difficulty";
        before = previousErrors;
        after = currentErrors;
      } else if (
        previousSuccess.length &&
        completeSuccess(current) &&
        level(current) === "independent" &&
        level(previous) === "supported"
      ) {
        kind = "less_help";
        before = previousSuccess;
        after = currentSuccess;
      } else if (
        previousSuccess.length &&
        completeSuccess(current) &&
        level(current) === "independent" &&
        level(previous) === "unknown"
      ) {
        kind = "independence_recorded";
        before = previousSuccess;
        after = currentSuccess;
      } else if (
        previousSuccess.length &&
        currentSuccess.length &&
        level(current) === "supported" &&
        level(previous) === "independent"
      ) {
        kind = "more_help";
        before = previousSuccess;
        after = currentSuccess;
      } else if (
        previousErrors.length &&
        completeSuccess(current) &&
        level(current) === "independent"
      ) {
        kind = "method_developing";
        before = previousErrors;
        after = currentSuccess;
      } else if (
        completeSuccess(previous) &&
        completeSuccess(current) &&
        level(previous) === "independent" &&
        level(current) === "independent"
      ) {
        kind = "independent_consistency";
        before = previousSuccess;
        after = currentSuccess;
      }
      if (kind)
        witnesses.push({
          kind,
          skillId: current.skillId,
          studentId: current.studentId,
          previous,
          current,
          evidence: refsForSlots(state, [...before, ...after], findings),
        });
    }
    // This describes transfer of the same addition method, not a difficulty-normalized gain.
    if (
      current.skillId === "obj-add-unlike-fractions" &&
      completeSuccess(current) &&
      level(current) === "independent" &&
      current.slots.every(
        (slot) =>
          slot.question.learningObjectiveIds.includes(
            "obj-explain-fraction-context",
          ) && slot.facets.unitStatus === "correct",
      )
    ) {
      const calculation = earlier.find(
        (slice) =>
          slice.slots.every(
            (slot) =>
              !slot.question.learningObjectiveIds.includes(
                "obj-explain-fraction-context",
              ),
          ) &&
          completeSuccess(slice) &&
          level(slice) === "independent",
      );
      if (calculation)
        witnesses.push({
          kind: "applying_context",
          skillId: current.skillId,
          studentId: current.studentId,
          previous: calculation,
          current,
          evidence: refsForSlots(
            state,
            [...success(calculation), ...success(current)],
            findings,
          ),
        });
    }
  }
  const groups = new Map<string, TrendWitness[]>();
  for (const witness of witnesses) {
    const key = `${witness.kind}:${witness.skillId}`;
    groups.set(key, [...(groups.get(key) ?? []), witness]);
  }
  const trends = [...groups.entries()]
    .map(([key, items]): LearningTrend => {
      const evidence = uniqueEvidence(items.flatMap((item) => item.evidence));
      const studentIds = unique(items.map((item) => item.studentId));
      const dates = evidence.map((ref) => ref.activityDate).sort();
      const { kind, skillId } = items[0];
      const helpChanged = items.some(
        (item) => level(item.previous) !== level(item.current),
      );
      return {
        id: `${assignment.id}:${key}`,
        kind,
        skillId,
        skill: skillLabel(skillId),
        ...trendText(kind, studentIds.length),
        studentIds,
        evidence,
        status:
          evidence.length && evidence.every((ref) => ref.findingId)
            ? "reviewed"
            : "suggested",
        dateRange: { from: dates[0], to: dates.at(-1)! },
        comparability:
          kind === "applying_context"
            ? "The same addition skill appears in a calculation and a later word problem. Task demands differ, so this is not a like-for-like score comparison."
            : `The same skill and recorded task difficulty are compared on different dates.${helpChanged ? " The help conditions changed and are shown with each source." : " Help conditions are recorded with each source."} These tasks are not a standardized growth measure.`,
      };
    })
    .sort(
      (a, b) =>
        priorities[b.kind] - priorities[a.kind] ||
        b.studentIds.length - a.studentIds.length ||
        a.skillId.localeCompare(b.skillId),
    );
  // Equivalent-fraction and addition objectives often share the same answers.
  // Prefer three distinct teaching messages over duplicate cards for those answers.
  const selected: LearningTrend[] = [];
  for (const trend of trends) {
    if (selected.some((existing) => existing.kind === trend.kind)) continue;
    selected.push(trend);
    if (selected.length === 3) break;
  }
  if (selected.length) return selected;
  const current = getAssignmentAnalytics(state, assignment.templateId).allSlots;
  const evidence = refsForSlots(
    state,
    current.filter((slot) => slot.response),
    findings,
  );
  if (!evidence.length) return [];
  const dates = evidence.map((ref) => ref.activityDate).sort();
  return [
    {
      id: `${assignment.id}:starting-point`,
      kind: "starting_point",
      skillId: "obj-add-unlike-fractions",
      skill: skillLabel("obj-add-unlike-fractions"),
      ...trendText("starting_point", 0),
      status: "limited_evidence",
      studentIds: unique(evidence.map((ref) => ref.studentId)),
      dateRange: { from: dates[0], to: dates.at(-1)! },
      evidence,
      comparability:
        "Current work can suggest a next step, but a trend needs usable evidence on the same skill and comparable task demands from another date.",
    },
  ];
}

function actionEvidence(
  state: AppState,
  action: TeachingAction,
  findings: Finding[],
): LearningEvidence[] {
  return action.evidence.flatMap((ref) => {
    const finding = findings.find((note) =>
      note.evidence.some(
        (item) =>
          item.responseId === ref.responseId &&
          item.responseRevision === ref.responseRevision,
      ),
    );
    const observation =
      finding &&
      state.observations.find(
        (item) =>
          !item.superseded &&
          item.findingId === finding.id &&
          item.findingRevision === finding.revision,
      );
    const evidence = evidenceFor(
      state,
      ref.responseId,
      ref.responseRevision,
      finding,
      observation,
    );
    return evidence ? [evidence] : [];
  });
}
function actionStatus(action: TeachingAction): LearningStatus {
  return ["collect", "process", "unfinished"].includes(action.kind)
    ? "limited_evidence"
    : action.status;
}

function hasWrittenArithmeticSlip(slot: AnswerSlot): boolean {
  if (
    slot.bucket !== "incorrect" ||
    slot.facets.reasoning !== "demonstrated" ||
    !slot.response
  )
    return false;
  const [a, b] = slot.question.operands;
  return [
    ...slot.response.workingText.matchAll(
      /(\d+\s*\/\s*\d+)\s*\+\s*(\d+\s*\/\s*\d+)\s*=\s*(\d+\s*\/\s*\d+)/g,
    ),
  ].some((match) => {
    const left = parseFraction(match[1]),
      right = parseFraction(match[2]),
      result = parseFraction(match[3]);
    return (
      left &&
      right &&
      result &&
      left.denominator === right.denominator &&
      result.denominator === left.denominator &&
      ((equalFractions(left, a) && equalFractions(right, b)) ||
        (equalFractions(left, b) && equalFractions(right, a))) &&
      !equalFractions(addFractions(left, right), result)
    );
  });
}

function refineAction<T extends TeachingAction & { priority: number }>(
  action: T,
  slots: AnswerSlot[],
): T {
  // Open questions and specific support needs should appear before enrichment.
  if (action.kind === "challenge") return { ...action, priority: 45 };
  if (action.kind === "unfinished") return { ...action, priority: 76 };
  const cited = slots.filter((slot) =>
    action.evidence.some(
      (ref) =>
        ref.responseId === slot.responseId &&
        ref.responseRevision === slot.responseRevision,
    ),
  );
  if (
    action.kind !== "practice" ||
    !cited.length ||
    !cited.every(hasWrittenArithmeticSlip)
  )
    return action;
  return {
    ...action,
    priority: 82,
    title: "Check the addition after renaming",
    reason:
      "The fractions were renamed correctly, but the final addition needs checking.",
    steps: [
      "Keep the valid equivalent-fraction steps and ask the student to check the numerator calculation.",
      "Estimate the total, then recalculate and compare it with the estimate.",
      "Try one similar sum without a prompt, keeping the same common-unit method.",
    ],
    successCheck:
      "The student adds the renamed numerators accurately and checks that the result is reasonable.",
    minutes: 5,
  };
}

function personalReason(action: TeachingAction): string {
  switch (action.kind) {
    case "equal_parts":
      return "The working adds numerators and denominators in more than one answer. Revisit what the denominator represents.";
    case "readings":
      return "Check the original writing before interpreting the mathematics in these flagged responses.";
    case "independence":
      return "Correct working is present, but help was given or the help conditions are unknown. Collect a fresh independent response.";
    case "method":
      return "A correct value is present, but the recorded working does not yet establish a consistent common-unit method.";
    case "units":
      return "A word-problem answer omits the requested unit. Keep this separate from whether its fraction value is correct.";
    case "challenge":
      return "The current task shows correct common-unit working under recorded independent conditions. A fresh explanation task can test the next step.";
    case "unfinished":
      return "The unfinished work leaves an open question. Ask where the student stopped before choosing support.";
    case "collect":
      return "No worksheet is available for this task, so there is no result to interpret yet.";
    case "process":
      return "The worksheet is uploaded but its answers have not yet been read.";
    default:
      return action.reason;
  }
}

/** Suggested teaching decisions grounded in dated work; never a score or automatic placement. */
export function getLearningInsights(
  state: AppState,
  templateId: string,
  options: { followUpLimit?: number } = {},
): LearningInsights {
  const assignment = getAssignment(templateId);
  if (!assignment) throw new Error(`Unknown assignment: ${templateId}`);
  const scoped = scopedState(state, assignment);
  const findings = assignments
    .filter((item) => item.sequence <= assignment.sequence)
    .flatMap((item) => validFindings(scoped, item.templateId));
  const insights = getAssignmentInsights(scoped, templateId);
  const trends = makeTrends(scoped, assignment, findings);
  const students = scoped.students.filter((student) => student.active);
  const ranked = students
    .flatMap((student) => {
      const focused = {
        ...scoped,
        students: scoped.students.map((item) =>
          item.id === student.id ? item : { ...item, active: false },
        ),
      };
      const studentInsights = getAssignmentInsights(focused, templateId);
      const action = studentInsights.actions
        .map((item) => refineAction(item, studentInsights.analytics.allSlots))
        .sort((a, b) => b.priority - a.priority)[0];
      if (!action) return [];
      const evidence = actionEvidence(scoped, action, findings);
      return [
        {
          priority: action.priority,
          kind: action.kind,
          followUp: {
            id: `${assignment.id}:${student.id}:${action.kind}`,
            studentId: student.id,
            title: action.title,
            reason: personalReason(action),
            nextStep: action.steps[0],
            steps: [...action.steps],
            minutes: action.minutes,
            successCheck: action.successCheck,
            status:
              actionStatus(action) === "reviewed" &&
              evidence.some((ref) => !ref.findingId)
                ? "suggested"
                : actionStatus(action),
            evidence,
          } satisfies LearningFollowUp,
        },
      ];
    })
    .sort((a, b) => b.priority - a.priority);
  const allFollowUps = ranked.map((item) => item.followUp);
  const primary = insights.actions
    .map((item) => refineAction(item, insights.analytics.allSlots))
    .sort((a, b) => b.priority - a.priority)[0];
  let lessonDirection: LearningDecision | null = primary
    ? {
        id: `${assignment.id}:lesson-direction:${primary.kind}`,
        lessonId: assignment.targetLessonId,
        studentIds: [...primary.studentIds],
        title: primary.title,
        reason: primary.reason,
        nextStep: primary.steps[0],
        steps: [...primary.steps],
        minutes: primary.minutes,
        successCheck: primary.successCheck,
        status: actionStatus(primary),
        evidence: actionEvidence(scoped, primary, findings),
      }
    : null;
  const currentSlots = insights.analytics.allSlots;
  const continuingStudents = students.filter((student) => {
    const slots = currentSlots.filter((slot) => slot.studentId === student.id);
    return (
      slots.length > 0 &&
      slots.every(
        (slot) =>
          slot.bucket === "correct" &&
          slot.facets.reasoning === "demonstrated" &&
          slot.supportLevel === "independent" &&
          (!slot.question.answerUnit || slot.facets.unitStatus === "correct"),
      )
    );
  });
  const checks = ranked.filter(
    (item) =>
      ["practice", "unfinished", "units", "method", "independence"].includes(
        item.kind,
      ) &&
      !continuingStudents.some(
        (student) => student.id === item.followUp.studentId,
      ),
  );
  const groupedChecks = [
    ...new Map(
      checks.map((item) => [
        item.followUp.title,
        checks.filter((other) => other.followUp.title === item.followUp.title),
      ]),
    ).values(),
  ];
  const checkMinutes = groupedChecks.reduce(
    (total, group) => total + group[0].followUp.minutes,
    0,
  );
  if (
    continuingStudents.length > students.length / 2 &&
    checks.length > 0 &&
    checkMinutes <= 12 &&
    students.every(
      (student) =>
        continuingStudents.some((item) => item.id === student.id) ||
        checks.some((item) => item.followUp.studentId === student.id),
    ) &&
    currentSlots.every(
      (slot) =>
        !["not_received", "unprocessed", "flagged"].includes(slot.bucket),
    )
  ) {
    const names = (ids: string[]) =>
      ids
        .map(
          (id) =>
            state.students.find((student) => student.id === id)!.displayName,
        )
        .join(", ");
    const needs = groupedChecks.map(
      (group) =>
        `${names(group.map((item) => item.followUp.studentId))}: ${group[0].followUp.title.toLowerCase()}`,
    );
    const evidence = uniqueEvidence([
      ...checks.flatMap((item) => item.followUp.evidence),
      ...refsForSlots(
        scoped,
        currentSlots.filter((slot) =>
          continuingStudents.some((student) => student.id === slot.studentId),
        ),
        findings,
      ),
    ]);
    lessonDirection = {
      id: `${assignment.id}:lesson-direction:individual-checks`,
      lessonId: assignment.targetLessonId,
      studentIds: checks.map((item) => item.followUp.studentId),
      title: "Keep the lesson moving with short individual checks",
      reason: `${needs.join("; ")}. The other submitted work shows correct common-unit working under independent conditions, so keep those students on the planned practice.`,
      nextStep:
        "Keep the planned practice running while you check the specific unfinished or uncertain steps.",
      steps: [
        "Keep the rest of the class on the planned practice.",
        ...groupedChecks.map(
          (group) =>
            `${names(group.map((item) => item.followUp.studentId))}: ${group[0].followUp.nextStep}`,
        ),
      ],
      minutes: checkMinutes,
      successCheck:
        "Collect a complete response from each checked student, with accurate working and any help recorded.",
      status:
        evidence.length > 0 && evidence.every((ref) => ref.findingId)
          ? "reviewed"
          : "suggested",
      evidence,
    };
  }
  const currentFindingIds = new Set(
    findings.map((finding) => `${finding.id}:${finding.revision}`),
  );
  const reviewedHistory = scoped.observations
    .map(
      (observation): LearningHistoryEntry => ({
        id: observation.id,
        studentId: observation.studentId,
        skillId: observation.objectiveId,
        skill: skillLabel(observation.objectiveId),
        date: observation.date,
        interpretation: observation.interpretation,
        status:
          !observation.superseded &&
          currentFindingIds.has(
            `${observation.findingId}:${observation.findingRevision}`,
          )
            ? "current"
            : "superseded",
        evidence: observation.evidence.flatMap((ref) => {
          const evidence = evidenceFor(
            scoped,
            ref.responseId,
            ref.responseRevision,
            undefined,
            observation,
          );
          return evidence ? [evidence] : [];
        }),
      }),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const meaningful = trends.find((trend) => trend.kind !== "starting_point");
  const summary = meaningful
    ? `${meaningful.title}. ${lessonDirection ? `${lessonDirection.title}. ${lessonDirection.successCheck}` : meaningful.nextStep}`
    : insights.analytics.submittedStudents
      ? `Use ${assignment.title.toLowerCase()} as a starting point. ${lessonDirection ? `${lessonDirection.title} next; collect dated follow-up work before calling this a trend.` : "Collect comparable follow-up work to see how the method develops."}`
      : `There is no submitted work for ${assignment.title.toLowerCase()} yet. Collect a short task and record the help given before deciding what to teach next.`;
  const requestedLimit = options.followUpLimit ?? 3;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.floor(requestedLimit))
    : 3;
  return {
    assignment,
    throughDate: assignment.date,
    summary,
    trends,
    followUps: allFollowUps.slice(0, limit),
    allFollowUps,
    lessonDirection,
    reviewedHistory,
    limitations: [
      `Only work dated through ${dateLabel(assignment.date)} is included. Corrected readings are used; earlier reading and help records remain in the history.`,
      "A trend describes these tasks, not mastery or a standardized gain. Correct values, shown reasoning and help conditions are kept separate.",
      "Reviewed labels refer to the supporting teacher-confirmed findings. The teaching suggestions still need teacher judgment.",
    ],
  };
}
