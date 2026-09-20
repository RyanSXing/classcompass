import { describe, expect, it } from "vitest";
import {
  getLessonPlanningState,
  teacherNextStep,
} from "../../lib/teacher-workflow";
import {
  analyzeBatch,
  applyProposal,
  correctSupport,
  createInitialState,
  generateProposal,
  reviewFindings,
} from "../../lib/domain";
import type { AppState, Proposal } from "../../lib/contracts";
import { seedAssignment, testProvenance } from "./helpers";

const lessonId = "lesson-2026-09-23";

function reviewedWork() {
  const state = createInitialState("teacher");
  const batch = seedAssignment(state, "baseline-template-v1", {
    studentIds: ["stu-01"],
  });
  const notes = analyzeBatch(state, {
    batchId: batch.id,
    provenance: testProvenance,
  });
  reviewFindings(state, {
    items: notes.map((note) => ({
      findingId: note.id,
      expectedRevision: note.revision,
      decision: "confirm" as const,
    })),
    acknowledgeClearReadings: true,
  });
  return { state, batch };
}

function prepareProposal(state: AppState) {
  return generateProposal(state, lessonId, {
    basePlanVersionId: state.plans.find((plan) => plan.id === lessonId)!
      .currentVersionId,
    expectedEvidenceRevision: state.classroom.evidenceRevision,
    expectedCalendarRevision: state.classroom.calendarRevision,
    provenance: testProvenance,
  });
}

function saveProposal(
  state: AppState,
  proposal: Proposal,
  selectedChangeIds = proposal.changes.map((change) => change.id),
) {
  return applyProposal(state, proposal.id, {
    expectedRevision: proposal.revision,
    basePlanVersionId: proposal.basePlanVersionId,
    expectedEvidenceRevision: state.classroom.evidenceRevision,
    expectedCalendarRevision: state.classroom.calendarRevision,
    selectedChangeIds,
  });
}

describe("the teacher's next step", () => {
  it("does not send the teacher back to reanalyze old notes when newer work is unreviewed", () => {
    const state = createInitialState("teacher");
    const batch = seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-01"],
    });
    const notes = analyzeBatch(state, {
      batchId: batch.id,
      provenance: testProvenance,
    });
    reviewFindings(state, {
      items: notes.map((note) => ({
        findingId: note.id,
        expectedRevision: note.revision,
        decision: "confirm" as const,
      })),
      acknowledgeClearReadings: true,
    });
    const newer = seedAssignment(state, "followup-template-v1", {
      studentIds: ["stu-01"],
    });
    expect(teacherNextStep(state, batch.templateId)).toMatchObject({
      label: "Review newer work",
      href: `/review/${newer.id}#teaching-notes`,
    });
  });
  it("does not send missing or unread work straight to a lesson proposal", () => {
    const state = createInitialState("teacher");
    expect(teacherNextStep(state, "baseline-template-v1").kind).toBe("upload");
    seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-01"],
      extract: false,
    });
    expect(teacherNextStep(state, "baseline-template-v1").kind).toBe("analyze");
    expect(teacherNextStep(state, "baseline-template-v1").href).toContain(
      "result=unprocessed",
    );
  });
  it("keeps flags separate and leads checked findings into a teacher-approved lesson", () => {
    const state = createInitialState("teacher");
    const batch = seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-01"],
    });
    const notes = analyzeBatch(state, {
      batchId: batch.id,
      provenance: testProvenance,
    });
    expect(teacherNextStep(state, batch.templateId).kind).toBe("review");
    reviewFindings(state, {
      items: notes.map((note) => ({
        findingId: note.id,
        expectedRevision: note.revision,
        decision: "confirm" as const,
      })),
      acknowledgeClearReadings: true,
    });
    expect(teacherNextStep(state, batch.templateId)).toMatchObject({
      kind: "plan",
      href: "/plans/lesson-2026-09-23#lesson-suggestions",
    });
    state.responses[0].legibility = "uncertain";
    state.readingReviews = [];
    expect(teacherNextStep(state, batch.templateId)).toMatchObject({
      kind: "readings",
    });
  });
  it("sends earlier usable evidence to the lesson after the latest reviewed work", () => {
    const state = createInitialState("teacher");
    for (const [templateId, studentId] of [
      ["baseline-template-v1", "stu-01"],
      ["followup-template-v1", "stu-03"],
    ]) {
      const batch = seedAssignment(state, templateId, {
        studentIds: [studentId],
      });
      const notes = analyzeBatch(state, {
        batchId: batch.id,
        provenance: testProvenance,
      });
      reviewFindings(state, {
        items: notes.map((note) => ({
          findingId: note.id,
          expectedRevision: note.revision,
          decision: "confirm" as const,
        })),
        acknowledgeClearReadings: true,
      });
    }
    expect(teacherNextStep(state, "baseline-template-v1").lessonHref).toBe(
      "/plans/lesson-2026-09-25",
    );
  });
  it("distinguishes preparing a draft from previewing one without generating or saving anything", () => {
    const { state, batch } = reviewedWork();
    const before = structuredClone(state);
    expect(teacherNextStep(state, batch.templateId)).toMatchObject({
      kind: "plan",
      label: "Prepare lesson changes",
      hasFreshDraft: false,
    });
    expect(state).toEqual(before);
    const proposal = prepareProposal(state);
    expect(teacherNextStep(state, batch.templateId)).toMatchObject({
      kind: "plan",
      label: "Preview lesson changes",
      hasFreshDraft: true,
    });
    expect(proposal.status).toBe("draft");
    expect(
      state.plans.find((plan) => plan.id === lessonId)?.currentVersionId,
    ).toBe(proposal.basePlanVersionId);
  });
  it("keeps the accepted lesson saved after its calendar update and never resurfaces an older draft", () => {
    const { state, batch } = reviewedWork();
    const earlier = prepareProposal(state);
    const accepted = prepareProposal(state);
    const calendarBeforeSave = state.classroom.calendarRevision;
    const result = saveProposal(state, accepted);
    expect(earlier.status).toBe("stale");
    expect(state.classroom.calendarRevision).toBe(calendarBeforeSave + 1);
    expect(getLessonPlanningState(state, lessonId)).toMatchObject({
      proposal: undefined,
      hasFreshDraft: false,
      hasCurrentSavedChanges: true,
    });
    expect(teacherNextStep(state, batch.templateId)).toMatchObject({
      kind: "saved",
      label: "Open saved lesson",
      href: `/plans/${lessonId}`,
    });
    expect(
      state.planVersions.find((version) => version.id === result.planVersionId)
        ?.snapshot.totalMinutes,
    ).toBe(45);
    expect(state.proposals).toContain(earlier);
  });
  it("shows a deliberately prepared new draft, and keeps its stale evidence warning on the current version", () => {
    const { state, batch } = reviewedWork();
    saveProposal(state, prepareProposal(state));
    const nextDraft = prepareProposal(state);
    expect(getLessonPlanningState(state, lessonId)).toMatchObject({
      proposal: { id: nextDraft.id },
      hasFreshDraft: true,
      hasCurrentSavedChanges: false,
    });
    expect(teacherNextStep(state, batch.templateId).kind).toBe("plan");
    const submission = state.submissions[0];
    correctSupport(state, submission.id, {
      expectedRevision: submission.revision,
      support: { ...submission.support, level: "supported" },
      reason: "The student used teacher prompts.",
    });
    expect(getLessonPlanningState(state, lessonId)).toMatchObject({
      proposal: { id: nextDraft.id, status: "stale" },
      hasFreshDraft: false,
      hasCurrentSavedChanges: false,
    });
  });
  it("does not call a lesson current with the evidence after the teacher corrects help given", () => {
    const { state, batch } = reviewedWork();
    const accepted = prepareProposal(state);
    saveProposal(state, accepted);
    const submission = state.submissions[0];
    correctSupport(state, submission.id, {
      expectedRevision: submission.revision,
      support: { ...submission.support, level: "supported" },
      reason: "The student used teacher prompts.",
    });
    expect(getLessonPlanningState(state, lessonId).hasCurrentSavedChanges).toBe(
      false,
    );
    expect(teacherNextStep(state, batch.templateId).kind).not.toBe("saved");
    expect(accepted.status).toBe("applied");
  });
  it("does not revive an earlier draft when the teacher keeps the original lesson", () => {
    const { state } = reviewedWork();
    const earlier = prepareProposal(state);
    const dismissed = prepareProposal(state);
    saveProposal(state, dismissed, []);
    expect(earlier.status).toBe("draft");
    expect(getLessonPlanningState(state, lessonId)).toMatchObject({
      proposal: undefined,
      hasFreshDraft: false,
      hasCurrentSavedChanges: false,
    });
  });
});
