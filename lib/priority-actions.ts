import type { ClassroomBrief } from "./assistant-contracts";
import type { Student } from "./contracts";
import type {
  LearningEvidence,
  LearningFollowUp,
  LearningInsights,
} from "./learning-insights";
import { teachingParts } from "./teaching-copy";

export type PriorityAction = {
  id: string;
  title: string;
  source: "live" | "sample" | "evidence";
  studentIds?: string[];
  /** Original structured teaching text for assistant handoff and expanded detail. */
  description: string;
  who?: string;
  time?: string;
  nextStep: string;
  check?: string;
  reason?: string;
  evidence?: LearningEvidence[];
  citation?: { label: string; href: string; excerpt: string };
};

const navigationOnly = /^(?:open (?:the )?(?:saved |historical )?lesson|review (?:the )?lesson (?:decision|changes)|view (?:the )?(?:saved )?lesson)$/i;

function isTeachingAction(
  action: ClassroomBrief["actions"][number],
  brief: ClassroomBrief,
) {
  const parts = teachingParts(action.description);
  return (
    Boolean(action.description.trim()) &&
    !navigationOnly.test(action.title) &&
    brief.citations.some((citation) => citation.id === action.citationId) &&
    (parts.steps.length > 0 || Boolean(action.description.trim()))
  );
}

function namesFor(studentIds: string[], students: Student[]) {
  return studentIds
    .map((id) => students.find((student) => student.id === id)?.displayName)
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

function uniqueEvidence(evidence: LearningEvidence[]) {
  return [
    ...new Map(
      evidence.map((item) => [
        `${item.responseId}:${item.responseRevision}:${item.observationId ?? "current"}`,
        item,
      ]),
    ).values(),
  ];
}

function fallbackDescription(
  action: Pick<LearningFollowUp, "minutes" | "steps" | "successCheck">,
  who: string,
  perStudent = false,
) {
  return [
    `Time: ${action.minutes} min${perStudent ? " per student" : ""}`,
    who ? `With: ${who}` : "",
    ...action.steps.map((step) => `Do: ${step}`),
    `Check: ${action.successCheck}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function studentIdsFromBrief(
  who: string,
  href: string | undefined,
  students: Student[],
) {
  const ids = students
    .filter((student) =>
      who.toLowerCase().includes(student.displayName.toLowerCase()),
    )
    .map((student) => student.id);
  if (href) {
    try {
      const studentId = new URL(href, "https://classcompass.local").searchParams.get(
        "student",
      );
      if (studentId && students.some((student) => student.id === studentId))
        ids.push(studentId);
    } catch {
      // A malformed saved link cannot establish a student grouping.
    }
  }
  return [...new Set(ids)];
}

function evidencePriorityActions(
  learning: LearningInsights,
  students: Student[],
): PriorityAction[] {
  const actions: PriorityAction[] = [];
  const direction = learning.lessonDirection;
  const groups = [
    ...new Map(
      learning.allFollowUps.map((followUp) => [
        `${followUp.title}\u0000${followUp.nextStep}\u0000${followUp.successCheck}`,
        learning.allFollowUps.filter(
          (item) =>
            item.title === followUp.title &&
            item.nextStep === followUp.nextStep &&
            item.successCheck === followUp.successCheck,
        ),
      ]),
    ).values(),
  ];
  for (const group of groups) {
    if (actions.length === 2) break;
    const representative = group[0];
    const studentIds = [...new Set(group.map((item) => item.studentId))];
    const who = namesFor(studentIds, students);
    actions.push({
      id: representative.id,
      title: representative.title,
      source: "evidence",
      studentIds,
      description: fallbackDescription(representative, who, studentIds.length > 1),
      who: who || undefined,
      time: `${representative.minutes} min${studentIds.length > 1 ? " per student" : ""}`,
      nextStep: representative.nextStep,
      check: representative.successCheck,
      reason: group.length > 1
        ? group.map((item) => `${namesFor([item.studentId], students)}: ${item.reason}`).join(" ")
        : representative.reason,
      evidence: uniqueEvidence(group.flatMap((item) => item.evidence)),
    });
  }

  const directionOverlaps = direction?.studentIds.some((studentId) =>
    actions.some((action) => action.studentIds?.includes(studentId)),
  );
  if (direction && actions.length < 2 && !directionOverlaps) {
    const who = namesFor(direction.studentIds, students);
    actions.push({
      id: direction.id,
      title: direction.title,
      source: "evidence",
      studentIds: direction.studentIds,
      description: fallbackDescription(direction, who),
      who: who || undefined,
      time: `${direction.minutes} min`,
      nextStep: direction.nextStep,
      check: direction.successCheck,
      reason: direction.reason,
      evidence: direction.evidence,
    });
  }
  return actions;
}

function isDistinctNeed(action: PriorityAction, candidate: PriorityAction) {
  const actionStudents = action.studentIds ?? [];
  const candidateStudents = candidate.studentIds ?? [];
  // The fallback cannot safely classify a differently worded AI action. Only
  // use it when both cards name non-overlapping student groups explicitly.
  return (
    actionStudents.length > 0 &&
    candidateStudents.length > 0 &&
    !actionStudents.some((studentId) => candidateStudents.includes(studentId))
  );
}

/**
 * Limits the overview to decisions a teacher can act on now. Navigation links
 * in assistant output stay available in the expanded briefing, but never take
 * one of the two decision slots.
 */
export function getPriorityActions({
  brief,
  learning,
  students,
}: {
  brief?: ClassroomBrief;
  learning: LearningInsights;
  students: Student[];
}): PriorityAction[] {
  if (brief && !brief.stale) {
    const seen = new Set<string>();
    const briefActions: PriorityAction[] = brief.actions
      .filter((action) => isTeachingAction(action, brief))
      .filter((action) => {
        const key = `${normalized(action.title)}\u0000${normalized(action.description)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((action): PriorityAction => {
        const parts = teachingParts(action.description);
        const citation = brief.citations.find(
          (item) => item.id === action.citationId,
        );
        return {
          id: action.id,
          title: action.title,
          source: brief.provenance.mode === "live" ? "live" : "sample",
          description: action.description,
          who: parts.who || undefined,
          studentIds: studentIdsFromBrief(
            parts.who,
            citation?.href,
            students,
          ),
          time: parts.time || undefined,
          nextStep: parts.steps[0] ?? action.description,
          check: parts.check || undefined,
          citation: citation
            ? {
                label: citation.label,
                href: citation.href,
                excerpt: citation.excerpt,
              }
            : undefined,
        };
      })
      .slice(0, 2);
    if (briefActions.length) {
      for (const candidate of evidencePriorityActions(learning, students)) {
        if (briefActions.length === 2) break;
        if (briefActions.every((action) => isDistinctNeed(action, candidate)))
          briefActions.push(candidate);
      }
      return briefActions;
    }
  }
  return evidencePriorityActions(learning, students);
}
