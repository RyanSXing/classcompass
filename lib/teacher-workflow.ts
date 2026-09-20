import type { AppState } from "./contracts";
import { getAssignmentInsights } from "./insights";
import { assignmentHref } from "./client/links";
import { assignments } from "./assignments";
import { getPlanningFindings, proposalIsFresh } from "./domain";

/** A draft only belongs beside the saved version it was prepared to change. */
export function getLessonPlanningState(state: AppState, lessonId: string) {
  const plan = state.plans.find((item) => item.id === lessonId);
  const version = state.planVersions.find(
    (item) => item.id === plan?.currentVersionId,
  );
  const latestProposal = [...state.proposals]
    .reverse()
    .find(
      (item) =>
        item.lessonId === lessonId && item.basePlanVersionId === version?.id,
    );
  const proposal =
    latestProposal?.status === "draft" || latestProposal?.status === "stale"
      ? latestProposal
      : undefined;
  const confirmed = plan ? getPlanningFindings(state, plan.date) : [];
  const usesCurrentNotes = (findingIds: string[]) =>
    findingIds.every((id) => confirmed.some((finding) => finding.id === id));
  const hasFreshDraft =
    !!proposal &&
    proposalIsFresh(state, proposal) &&
    proposal.changes.every((change) => usesCurrentNotes(change.findingIds));
  const applied = state.proposals.find(
    (item) =>
      item.id === version?.proposalId &&
      item.lessonId === lessonId &&
      item.status === "applied" &&
      item.appliedVersionId === version?.id,
  );
  // Applying a proposal advances the calendar revision itself. A saved lesson
  // stays saved; only a new draft or changed evidence calls for another review.
  const hasCurrentSavedChanges =
    !proposal &&
    !!applied &&
    !!version?.selectedChangeIds.length &&
    applied.evidenceRevision === state.classroom.evidenceRevision &&
    applied.changes
      .filter((change) => version.selectedChangeIds.includes(change.id))
      .every((change) => usesCurrentNotes(change.findingIds));
  return { proposal, hasFreshDraft, hasCurrentSavedChanges };
}

export type TeacherNextStep = {
  kind: "upload" | "analyze" | "readings" | "review" | "plan" | "saved";
  title: string;
  detail: string;
  label: string;
  href: string;
  lessonHref: string;
  hasFreshDraft?: boolean;
};

/** One useful next action, derived from the actual saved assignment state. */
export function teacherNextStep(
  state: AppState,
  templateId: string,
): TeacherNextStep {
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
  if (insights.planningNotes) {
    const planning = getLessonPlanningState(state, insights.targetLessonId);
    if (planning.hasCurrentSavedChanges)
      return {
        kind: "saved",
        title: "Your reviewed lesson changes are saved",
        detail:
          "Open your saved lesson to teach it, print the activities, or check the calendar.",
        label: "Open saved lesson",
        href: lessonHref,
        lessonHref,
      };
    return {
      kind: "plan",
      title: "Your reviewed evidence is ready",
      detail: planning.hasFreshDraft
        ? "Preview the suggested changes beside their evidence, then save the ones you want to teach."
        : "Prepare suggestions from your approved teaching notes, then choose what to save.",
      label: planning.hasFreshDraft
        ? "Preview lesson changes"
        : "Prepare lesson changes",
      href: `${lessonHref}#lesson-suggestions`,
      lessonHref,
      hasFreshDraft: planning.hasFreshDraft,
    };
  }
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
