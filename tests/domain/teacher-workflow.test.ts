import { describe, expect, it } from "vitest";
import { teacherNextStep } from "../../lib/teacher-workflow";
import {
  analyzeBatch,
  createInitialState,
  reviewFindings,
} from "../../lib/domain";
import { seedAssignment, testProvenance } from "./helpers";

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
});
