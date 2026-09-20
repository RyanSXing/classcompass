import type { AppState } from "./contracts";
import { getAssignmentInsights } from "./insights";
import { assignmentHref } from "./client/links";
import { assignments } from "./assignments";

/** One useful next action, derived from the actual saved assignment state. */
export function teacherNextStep(state: AppState, templateId: string) {
  const insights = getAssignmentInsights(state, templateId);
  const { counts, submittedStudents } = insights.analytics;
  const reviewHref = assignmentHref(state, templateId);
  const lessonHref = `/plans/${insights.targetLessonId}`;
  if (!submittedStudents)
    return {
      kind: "upload",
      title: "Add work for this assignment",
      detail: "Choose each student's worksheet to get started.",
      label: "Upload worksheets",
      href: `/classroom?assignment=${encodeURIComponent(templateId)}&upload=work`,
      lessonHref,
    };
  if (counts.unprocessed)
    return {
      kind: "analyze",
      title: "Some worksheets still need reading",
      detail: `${counts.unprocessed} answers have not been analyzed yet.`,
      label: "Analyze uploaded work",
      href: assignmentHref(state, templateId, { result: "unprocessed" }),
      lessonHref,
    };
  if (counts.flagged)
    return {
      kind: "readings",
      title: `Check ${counts.flagged} flagged answer${counts.flagged === 1 ? "" : "s"}`,
      detail:
        "Compare the reading with the page. A flag does not mean the answer is wrong.",
      label: "Check flagged answers",
      href: assignmentHref(state, templateId, { result: "flagged" }),
      lessonHref,
    };
  const newer = [...assignments]
    .reverse()
    .find(
      (assignment) =>
        assignment.sequence > insights.assignment.sequence &&
        state.batches.some(
          (batch) => batch.templateId === assignment.templateId,
        ),
    );
  if (!insights.planningNotes && insights.confirmedNotes && newer)
    return {
      kind: "review",
      title: "Review the newer work before planning",
      detail: `${newer.title} is newer than these approved notes. Check that evidence before choosing the next lesson change.`,
      label: "Review newer work",
      href: `${assignmentHref(state, newer.templateId)}#teaching-notes`,
      lessonHref: `/plans/${newer.targetLessonId}`,
    };
  if (insights.planningNotes)
    return {
      kind: "plan",
      title: "Your reviewed evidence is ready",
      detail: "Choose lesson changes, then save the ones you want to teach.",
      label: "Review lesson changes",
      href: `${lessonHref}#lesson-suggestions`,
      lessonHref,
    };
  if (insights.pendingNotes)
    return {
      kind: "review",
      title: `Review ${insights.pendingNotes} teaching note${insights.pendingNotes === 1 ? "" : "s"}`,
      detail:
        "Check the evidence and approve the notes you want to use in your lesson.",
      label: "Review teaching notes",
      href: `${reviewHref}#teaching-notes`,
      lessonHref,
    };
  return {
    kind: "analyze",
    title: "Prepare teaching notes",
    detail: "Turn the checked answers into suggestions for your next lesson.",
    label: "Review assignment",
    href: reviewHref,
    lessonHref,
  };
}
