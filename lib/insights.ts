import type { AppState, Finding } from "./contracts";
import {
  countResults,
  currentAssignmentFindings,
  getAssignmentAnalytics,
  type AnswerSlot,
} from "./analytics";
import { assignments, getAssignment } from "./assignments";
import { getQuestion, getTemplate } from "./curriculum";
import { checkMath, findingWarnings, getPlanningFindings } from "./domain";

export type InsightEvidence = {
  responseId: string;
  responseRevision: number;
  studentId: string;
  questionId: string;
  batchId: string;
};
export type TeachingAction = {
  id: string;
  kind:
    | "equal_parts"
    | "readings"
    | "independence"
    | "method"
    | "units"
    | "challenge"
    | "practice"
    | "unfinished"
    | "process"
    | "collect";
  title: string;
  studentIds: string[];
  reason: string;
  steps: string[];
  successCheck: string;
  minutes: number;
  status: "reviewed" | "suggested" | "needs_reading";
  reviewedStudentIds: string[];
  evidence: InsightEvidence[];
  filters: Record<string, string | undefined>;
  recommendedLessonId: string;
};

const unique = <T>(values: T[]) => [...new Set(values)];
const usable = (slot: AnswerSlot) =>
  slot.bucket === "correct" || slot.bucket === "incorrect";
const references = (slots: AnswerSlot[]): InsightEvidence[] =>
  slots.flatMap((slot) =>
    slot.response && slot.batchId
      ? [
          {
            responseId: slot.response.id,
            responseRevision: slot.response.revision,
            studentId: slot.studentId,
            questionId: slot.questionId,
            batchId: slot.batchId,
          },
        ]
      : [],
  );
const validNote = (state: AppState, finding: Finding) =>
  finding.status === "confirmed" &&
  !findingWarnings(state, finding, {
    acknowledgeClear: true,
    batchId: finding.batchId,
  }).length;

/** These are explicit rules over saved work, not AI-generated interpretations. */
export function getAssignmentInsights(state: AppState, templateId: string) {
  const analytics = getAssignmentAnalytics(state, templateId);
  const assignment = analytics.assignment;
  const slots = analytics.allSlots;
  const notes = currentAssignmentFindings(state, templateId);
  const confirmed = notes.filter(
    (f) => f.status === "confirmed" && validNote(state, f),
  );
  const planningIds = new Set(
    getPlanningFindings(state, "9999-12-31").map((f) => f.id),
  );
  const planningNotes = confirmed.filter((f) => planningIds.has(f.id));
  const latestReviewedBatch = state.batches
    .filter((batch) =>
      state.findings.some(
        (finding) =>
          finding.batchId === batch.id && finding.status === "confirmed",
      ),
    )
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0];
  const nextAssignment =
    latestReviewedBatch && latestReviewedBatch.activityDate > assignment.date
      ? (getAssignment(latestReviewedBatch.templateId) ?? assignment)
      : assignment;
  const candidates: Array<TeachingAction & { priority: number }> = [];
  function add(
    kind: TeachingAction["kind"],
    matching: AnswerSlot[],
    input: Omit<
      TeachingAction,
      | "id"
      | "kind"
      | "studentIds"
      | "evidence"
      | "reviewedStudentIds"
      | "status"
      | "recommendedLessonId"
    > & { priority: number; noteMatches?: (finding: Finding) => boolean },
  ) {
    if (!matching.length) return;
    const studentIds = unique(matching.map((slot) => slot.studentId));
    const reviewedStudentIds = studentIds.filter((id) =>
      planningNotes.some((f) => f.studentId === id && input.noteMatches?.(f)),
    );
    const { noteMatches: _, ...rest } = input;
    void _;
    candidates.push({
      ...rest,
      id: `${assignment.id}-${kind}`,
      kind,
      studentIds,
      evidence: references(matching),
      reviewedStudentIds,
      recommendedLessonId: nextAssignment.targetLessonId,
      status:
        kind === "readings"
          ? "needs_reading"
          : reviewedStudentIds.length === studentIds.length
            ? "reviewed"
            : "suggested",
    });
  }
  const wrong = slots.filter((slot) => slot.bucket === "incorrect");
  const denominator = wrong.filter(
    (slot) =>
      slot.response &&
      checkMath(
        slot.question,
        slot.response.workingText,
        slot.response.answerText,
        "clear",
      ).denominatorAddition,
  );
  const patternStudents = unique(
    denominator.map((slot) => slot.studentId),
  ).filter(
    (id) => denominator.filter((slot) => slot.studentId === id).length >= 2,
  );
  const repeated = denominator.filter((slot) =>
    patternStudents.includes(slot.studentId),
  );
  add("equal_parts", repeated, {
    priority: 100,
    title: "Reteach equal-sized parts",
    minutes: 10,
    reason: `${patternStudents.length} student${patternStudents.length === 1 ? "" : "s"} added denominators in at least two worked answers (${repeated.length} answers total).`,
    steps: [
      "Use two equal-length fraction strips to represent the addends.",
      "Rename both fractions in the same-sized parts, then add only the numerators.",
      "Ask each student to explain why the size of the parts stays the same.",
    ],
    successCheck:
      "Each student solves one new unlike-fraction sum and explains the common denominator without a hint.",
    filters: { result: "incorrect" },
    noteMatches: (f) => f.suggestedNextStep === "targeted_equal_parts",
  });
  const flagged = slots.filter((slot) => slot.bucket === "flagged");
  add("readings", flagged, {
    priority: 95,
    title: "Check the unclear readings first",
    minutes: Math.max(2, Math.min(8, flagged.length)),
    reason: `${flagged.length} answer${flagged.length === 1 ? " needs" : "s need"} a reading check. These are excluded from correct and incorrect totals.`,
    steps: [
      "Open the highlighted original answer beside its reading.",
      "Correct the reading, or keep it uncertain if you cannot tell.",
      "Update the teaching notes after checking the source.",
    ],
    successCheck:
      "The saved reading matches the page, or remains clearly marked for another check.",
    filters: { result: "flagged" },
  });
  const assisted = slots.filter(
    (slot) => slot.bucket === "correct" && slot.supportLevel !== "independent",
  );
  add("independence", assisted, {
    priority: 85,
    title: "Check what they can do without help",
    minutes: 5,
    reason: `${assisted.length} correct answer${assisted.length === 1 ? " has" : "s have"} help recorded or help not yet recorded. Correctness alone does not show independence.`,
    steps: [
      "Verify what help was given on the original worksheet.",
      "Give one short problem using the same skill, without prompts.",
      "Record any help and keep the new answer alongside this work.",
    ],
    successCheck:
      "The student makes equivalent fractions and explains the sum without a hint.",
    filters: { result: "correct" },
    noteMatches: (f) => f.suggestedNextStep === "independent_check",
  });
  const method = slots.filter(
    (slot) =>
      slot.bucket === "correct" && slot.facets.reasoning !== "demonstrated",
  );
  add("method", method, {
    priority: 80,
    title: "Ask them to explain their method",
    minutes: 6,
    reason: `${method.length} correct answer${method.length === 1 ? " does" : "s do"} not yet show a consistent common-unit method in the recorded working.`,
    steps: [
      "Choose one of the correct answers as a starting point.",
      "Ask: “How did you make the parts the same size?”",
      "Have the student add a labeled drawing or equivalent-fraction calculation.",
    ],
    successCheck:
      "The explanation shows equivalent addends and preserves the value of each fraction.",
    filters: { result: "correct" },
    noteMatches: (f) => f.suggestedNextStep === "gather_evidence",
  });
  const units = slots.filter(
    (slot) => usable(slot) && slot.facets.unitStatus === "missing",
  );
  add("units", units, {
    priority: 75,
    title: "Connect the answer to its unit",
    minutes: 4,
    reason: `${units.length} usable word-problem answer${units.length === 1 ? " is" : "s are"} missing the requested unit. This is separate from the numerical result.`,
    steps: [
      "Reread what the problem asks you to measure.",
      "Add the unit to the calculation and the answer sentence.",
      "Explain what the fraction describes in this situation.",
    ],
    successCheck:
      "The next word-problem answer includes a meaningful unit and a sentence interpreting the total.",
    filters:
      units.length &&
      units.every((slot) => slot.questionId === units[0].questionId)
        ? { question: units[0].questionId }
        : {},
  });
  const independentSuccess = slots.filter(
    (slot) =>
      slot.bucket === "correct" &&
      slot.supportLevel === "independent" &&
      slot.facets.reasoning === "demonstrated",
  );
  const priorExtensionStudents = new Set(
    getPlanningFindings(state, assignment.date)
      .filter((finding) => finding.suggestedNextStep === "extension")
      .map((finding) => finding.studentId),
  );
  const challengeStudents = unique(
    independentSuccess.map((slot) => slot.studentId),
  ).filter((id) => {
    const studentSlots = slots.filter((slot) => slot.studentId === id);
    return (
      independentSuccess.filter((slot) => slot.studentId === id).length >=
        assignment.eligibilityPolicy.extensionMinimum &&
      (!assignment.eligibilityPolicy.requiresPriorExtension ||
        priorExtensionStudents.has(id)) &&
      studentSlots.every((slot) => slot.bucket === "correct")
    );
  });
  const challenge = independentSuccess.filter((slot) =>
    challengeStudents.includes(slot.studentId),
  );
  add("challenge", challenge, {
    priority: 70,
    title: "Try an explanation challenge",
    minutes: 8,
    reason: `${challengeStudents.length} student${challengeStudents.length === 1 ? " has" : "s have"} correct values for every question and at least ${assignment.eligibilityPolicy.extensionMinimum} answers with common-unit working, without recorded help.`,
    steps: [
      "Ask students to create two different fraction sums with the same total.",
      "Have them explain why both sums work, using equal-sized wholes.",
      "Check a new example before changing their next learning goal.",
    ],
    successCheck:
      "The student explains both sums and justifies the equivalence on a fresh problem.",
    filters: { result: "correct", support: "independent" },
    noteMatches: (f) => f.suggestedNextStep === "extension",
  });
  const otherWrong = wrong.filter(
    (slot) => !patternStudents.includes(slot.studentId),
  );
  add("practice", otherWrong, {
    priority: 65,
    title: "Work through one missed problem",
    minutes: 8,
    reason: `${otherWrong.length} incorrect answer${otherWrong.length === 1 ? " needs" : "s need"} a closer look at the method. A repeated error pattern has not been established for this group.`,
    steps: [
      "Choose one incorrect answer per student and read the working together.",
      "Model the first step the student cannot explain.",
      "Let the student finish a similar problem with less help.",
    ],
    successCheck:
      "The next worked answer shows an appropriate common denominator and correct sum.",
    filters: { result: "incorrect" },
    noteMatches: (f) => f.code === "other_teacher_finding",
  });
  if (!otherWrong.length)
    add(
      "practice",
      independentSuccess.filter(
        (slot) => !challengeStudents.includes(slot.studentId),
      ),
      {
        priority: 55,
        title: "Practice the method on one more problem",
        minutes: 6,
        reason:
          "These students showed a correct common-unit method without recorded help. More reviewed evidence is needed before assigning an extension group.",
        steps: [
          "Offer a fresh problem with different denominators.",
          "Ask for equivalent-fraction working and a short explanation.",
          "Review this answer alongside the earlier work before changing the next step.",
        ],
        successCheck:
          "The student repeats the method independently on the new problem.",
        filters: { result: "correct", support: "independent" },
        noteMatches: (finding) =>
          finding.suggestedNextStep === "independent_application",
      },
    );
  const unfinished = slots.filter((slot) => slot.bucket === "unanswered");
  add("unfinished", unfinished, {
    priority: 60,
    title: "Find out why these answers are unfinished",
    minutes: 4,
    reason: `${unfinished.length} question${unfinished.length === 1 ? " has" : "s have"} no final answer. Missing work is not counted as a mathematical error.`,
    steps: [
      "Ask the student where they stopped and what they tried.",
      "Give time to finish one question, recording any help.",
      "Use the new response before choosing a teaching group.",
    ],
    successCheck:
      "A complete response or a specific learning need is recorded.",
    filters: { result: "unanswered" },
    noteMatches: (f) => f.suggestedNextStep === "gather_evidence",
  });
  const unprocessed = slots.filter((slot) => slot.bucket === "unprocessed");
  add("process", unprocessed, {
    priority: 110,
    title: "Read the uploaded worksheets",
    minutes: 3,
    reason: `${unique(unprocessed.map((slot) => slot.studentId)).length} received worksheet${unique(unprocessed.map((slot) => slot.studentId)).length === 1 ? " is" : "s are"} waiting for analysis. No results have been assumed.`,
    steps: [
      "Open the received work and run or resume analysis.",
      "Compare uncertain readings with the original page.",
      "Review the resulting teaching notes before planning.",
    ],
    successCheck:
      "Each received answer has a saved reading or a visible review flag.",
    filters: { result: "unprocessed" },
  });
  const absent = slots.filter((slot) => slot.bucket === "not_received");
  add("collect", absent, {
    priority: 50,
    title: "Collect the missing work",
    minutes: 3,
    reason: `${unique(absent.map((slot) => slot.studentId)).length} student${unique(absent.map((slot) => slot.studentId)).length === 1 ? " has" : "s have"} no worksheet for this assignment. There is no result to interpret yet.`,
    steps: [
      "Check whether the worksheet was completed or missed.",
      "Upload the work or offer a short equivalent task.",
      "Record the date and help before comparing results.",
    ],
    successCheck: "The missing submission or reason for its absence is known.",
    filters: { result: "not_received" },
  });
  const questions = getTemplate(templateId).questionIds.map(
    (questionId, index) => {
      const answers = slots.filter((slot) => slot.questionId === questionId);
      const assessed = answers.filter(usable);
      return {
        question: getQuestion(questionId),
        number: index + 1,
        counts: countResults(answers),
        evidence: references(answers),
        methodsShown: assessed.filter(
          (slot) => slot.facets.reasoning === "demonstrated",
        ).length,
        methodsNotEstablished: assessed.filter(
          (slot) => slot.facets.reasoning === "not_established",
        ).length,
        reasoningConflicts: assessed.filter(
          (slot) => slot.facets.reasoning === "contradictory",
        ).length,
        missingUnits: assessed.filter(
          (slot) => slot.facets.unitStatus === "missing",
        ).length,
        denominatorAddition: assessed.filter(
          (slot) =>
            slot.response &&
            checkMath(
              slot.question,
              slot.response.workingText,
              slot.response.answerText,
              "clear",
            ).denominatorAddition,
        ).length,
        correctWithoutMethod: assessed.filter(
          (slot) =>
            slot.bucket === "correct" &&
            slot.facets.reasoning !== "demonstrated",
        ).length,
      };
    },
  );
  return {
    assignment,
    analytics,
    actions: candidates.sort((a, b) => b.priority - a.priority).slice(0, 3),
    questions,
    confirmedNotes: confirmed.length,
    planningNotes: planningNotes.length,
    pendingNotes: notes.filter(
      (f) => f.status !== "confirmed" || !confirmed.includes(f),
    ).length,
  };
}

export function getStudentAssignmentMatrix(state: AppState) {
  const columns = assignments.map((assignment) => ({
    assignment,
    analytics: getAssignmentAnalytics(state, assignment.templateId),
  }));
  return {
    assignments,
    students: state.students
      .filter((student) => student.active)
      .map((student) => ({
        student,
        cells: columns.map(({ assignment, analytics }) => {
          const slots = analytics.allSlots.filter(
            (slot) => slot.studentId === student.id,
          );
          const counts = countResults(slots);
          return {
            assignment,
            counts,
            supportLevel:
              slots.find((slot) => slot.submission)?.supportLevel ?? null,
            reviewed: slots.filter((slot) => slot.teacherReviewed).length,
            received: slots.some((slot) => !!slot.submission),
            analyzed: slots.some((slot) => !!slot.response),
          };
        }),
      })),
  };
}

/** Descriptive, paired observations only. Different tasks never imply a causal gain. */
export function compareAssignments(
  state: AppState,
  currentTemplateId: string,
  previousTemplateId?: string,
) {
  const current = getAssignmentAnalytics(state, currentTemplateId);
  const previousAssignment = previousTemplateId
    ? getAssignment(previousTemplateId)
    : [...assignments]
        .reverse()
        .find(
          (assignment) =>
            assignment.sequence < current.assignment.sequence &&
            state.batches.some(
              (batch) => batch.templateId === assignment.templateId,
            ),
        );
  if (
    !previousAssignment ||
    previousAssignment.sequence >= current.assignment.sequence
  )
    return null;
  const previous = getAssignmentAnalytics(state, previousAssignment.templateId);
  const sharedStudents = state.students.filter(
    (student) =>
      current.allSlots.some(
        (slot) => slot.studentId === student.id && slot.submission,
      ) &&
      previous.allSlots.some(
        (slot) => slot.studentId === student.id && slot.submission,
      ),
  );
  const supportChanged = sharedStudents
    .filter(
      (student) =>
        current.allSlots.find((slot) => slot.studentId === student.id)
          ?.supportLevel !==
        previous.allSlots.find((slot) => slot.studentId === student.id)
          ?.supportLevel,
    )
    .map((student) => student.id);
  const independentStudentIds = sharedStudents
    .filter((student) =>
      [current, previous].every((result) => {
        const answers = result.allSlots.filter(
          (slot) => slot.studentId === student.id,
        );
        return (
          answers.every((slot) => slot.supportLevel === "independent") &&
          answers.some(
            (slot) => slot.question.taskDifficulty === "core" && usable(slot),
          )
        );
      }),
    )
    .map((student) => student.id);
  const pairedCore = (result: typeof current) =>
    countResults(
      result.allSlots.filter(
        (slot) =>
          independentStudentIds.includes(slot.studentId) &&
          slot.question.taskDifficulty === "core",
      ),
    );
  const taskMix = (result: typeof current) => {
    const questions = unique(
      result.allSlots.map((slot) => slot.questionId),
    ).map(getQuestion);
    return {
      core: questions.filter((q) => q.taskDifficulty === "core").length,
      transfer: questions.filter((q) => q.taskDifficulty === "core-transfer")
        .length,
      other: questions.filter(
        (q) => !["core", "core-transfer"].includes(q.taskDifficulty),
      ).length,
      total: questions.length,
    };
  };
  const currentMix = taskMix(current),
    previousMix = taskMix(previous);
  const taskMixChanged =
    currentMix.core !== previousMix.core ||
    currentMix.transfer !== previousMix.transfer ||
    currentMix.other !== previousMix.other ||
    current.assignment.comparisonGroupId !==
      previous.assignment.comparisonGroupId;
  return {
    current: current.assignment,
    previous: previous.assignment,
    sharedStudentIds: sharedStudents.map((student) => student.id),
    independentStudentIds,
    supportChangedStudentIds: supportChanged,
    taskMixChanged,
    currentMix,
    previousMix,
    pairedCore: {
      current: pairedCore(current),
      previous: pairedCore(previous),
    },
    comparableTaskGroup:
      current.assignment.comparisonGroupId ===
      previous.assignment.comparisonGroupId,
    limitation:
      "Different questions were used. These are dated observations, not a measured learning gain.",
  };
}
