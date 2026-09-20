import { describe, expect, it } from "vitest";
import {
  compareAssignments,
  getAssignmentInsights,
  getStudentAssignmentMatrix,
} from "../../lib/insights";
import { assignments } from "../../lib/assignments";
import {
  analyzeBatch,
  correctResponse,
  createInitialState,
  reviewFindings,
} from "../../lib/domain";
import { seedAssignment, testProvenance } from "./helpers";

describe("evidence-backed teaching suggestions", () => {
  it("links still-current earlier evidence to the lesson after the latest reviewed assignment", () => {
    const state = createInitialState("teacher");
    for (const [templateId, studentId] of [
      ["baseline-template-v1", "stu-01"],
      ["followup-template-v1", "stu-03"],
    ]) {
      const batch = seedAssignment(state, templateId, {
        studentIds: [studentId],
      });
      const findings = analyzeBatch(state, {
        batchId: batch.id,
        provenance: testProvenance,
      });
      reviewFindings(state, {
        items: findings.map((finding) => ({
          findingId: finding.id,
          expectedRevision: finding.revision,
          decision: "confirm" as const,
        })),
        acknowledgeClearReadings: true,
      });
    }
    const action = getAssignmentInsights(
      state,
      "baseline-template-v1",
    ).actions.find((item) => item.kind === "equal_parts");
    expect(action).toMatchObject({
      status: "reviewed",
      recommendedLessonId: "lesson-2026-09-25",
    });
  });
  it("does not suggest a follow-up extension without required earlier approval", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "followup-template-v1", { studentIds: ["stu-01"] });
    const result = getAssignmentInsights(state, "followup-template-v1");
    expect(result.actions.some((action) => action.kind === "challenge")).toBe(
      false,
    );
    expect(
      result.actions.find((action) => action.kind === "practice")?.studentIds,
    ).toEqual(["stu-01"]);
  });
  it("does not invent instructional outcomes when work is missing or unprocessed", () => {
    const state = createInitialState("teacher");
    expect(
      getAssignmentInsights(state, "baseline-template-v1").actions.map(
        (action) => action.kind,
      ),
    ).toEqual(["collect"]);
    seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-01"],
      extract: false,
    });
    const result = getAssignmentInsights(state, "baseline-template-v1");
    expect(result.actions.map((action) => action.kind)).toEqual([
      "process",
      "collect",
    ]);
    expect(result.analytics.counts.correctPercent).toBeNull();
    expect(result.actions.flatMap((action) => action.evidence)).toEqual([]);
  });
  it("needs repeated usable worked errors before recommending an equal-parts group", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "baseline-template-v1", { studentIds: ["stu-01"] });
    expect(
      getAssignmentInsights(state, "baseline-template-v1").actions.find(
        (action) => action.kind === "equal_parts",
      )?.studentIds,
    ).toEqual(["stu-01"]);
    for (const response of state.responses.slice(1))
      response.legibility = "uncertain";
    const result = getAssignmentInsights(state, "baseline-template-v1");
    expect(result.actions.some((action) => action.kind === "equal_parts")).toBe(
      false,
    );
    expect(
      result.actions.find((action) => action.kind === "readings")?.evidence,
    ).toHaveLength(3);
    expect(result.analytics.counts).toMatchObject({ incorrect: 1, flagged: 3 });
  });
  it("removes an error suggestion after a teacher correction and cites exact new revisions", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "baseline-template-v1", { studentIds: ["stu-01"] });
    for (const response of state.responses) {
      const question = getAssignmentInsights(
        state,
        "baseline-template-v1",
      ).questions.find(
        (item) => item.question.id === response.questionId,
      )!.question;
      correctResponse(state, response.id, {
        expectedRevision: response.revision,
        answerText: question.expectedAnswer.canonicalFraction,
        workingText: "",
        legibility: "clear",
        readingStatus: "resolved",
        reason: "Checked against the original.",
      });
    }
    const result = getAssignmentInsights(state, "baseline-template-v1");
    expect(result.actions.some((action) => action.kind === "equal_parts")).toBe(
      false,
    );
    expect(
      result.actions
        .find((action) => action.kind === "method")
        ?.evidence.every((ref) => ref.responseRevision === 2),
    ).toBe(true);
  });
  it("excludes replaced uploads from actions and matrix denominators", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "baseline-template-v1", { studentIds: ["stu-01"] });
    const oldIds = new Set(state.responses.map((response) => response.id));
    seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-01"],
      extract: false,
    });
    const result = getAssignmentInsights(state, "baseline-template-v1");
    expect(result.analytics.counts).toMatchObject({
      unprocessed: 4,
      incorrect: 0,
    });
    expect(
      result.actions
        .flatMap((action) => action.evidence)
        .some((ref) => oldIds.has(ref.responseId)),
    ).toBe(false);
    expect(
      getStudentAssignmentMatrix(state).students[0].cells[0].counts.total,
    ).toBe(4);
  });
  it("treats correct values with help as a separate independence check", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-04"],
      support: "supported",
    });
    const result = getAssignmentInsights(state, "baseline-template-v1");
    expect(result.analytics.counts).toMatchObject({
      correct: 4,
      incorrect: 0,
      flagged: 0,
    });
    expect(
      result.actions.find((action) => action.kind === "independence")
        ?.studentIds,
    ).toEqual(["stu-04"]);
    expect(result.actions.some((action) => action.kind === "challenge")).toBe(
      false,
    );
  });
  it("keeps missing units and unestablished methods separate from correct values", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "baseline-template-v1", { studentIds: ["stu-04"] });
    const context = state.responses.find(
      (response) => response.questionId === "q-04",
    )!;
    context.answerText = "5/8";
    const calculation = state.responses.find(
      (response) => response.questionId === "q-01",
    )!;
    calculation.workingText = "1/7=2/14; 5/6";
    const result = getAssignmentInsights(state, "baseline-template-v1");
    expect(result.analytics.counts.correct).toBe(4);
    expect(
      result.questions.find((question) => question.question.id === "q-04")
        ?.missingUnits,
    ).toBe(1);
    expect(
      result.questions.find((question) => question.question.id === "q-01"),
    ).toMatchObject({ methodsShown: 0, correctWithoutMethod: 1 });
  });
  it("never implies teacher approval before review or carries it beyond newer unreviewed work", () => {
    const state = createInitialState("teacher");
    const batch = seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-01"],
    });
    const findings = analyzeBatch(state, {
      batchId: batch.id,
      provenance: testProvenance,
    });
    expect(
      getAssignmentInsights(state, batch.templateId).actions.find(
        (action) => action.kind === "equal_parts",
      )?.status,
    ).toBe("suggested");
    reviewFindings(state, {
      items: findings.map((finding) => ({
        findingId: finding.id,
        expectedRevision: finding.revision,
        decision: "confirm" as const,
      })),
      acknowledgeClearReadings: true,
    });
    expect(
      getAssignmentInsights(state, batch.templateId).actions.find(
        (action) => action.kind === "equal_parts",
      )?.status,
    ).toBe("reviewed");
    seedAssignment(state, "followup-template-v1", {
      studentIds: ["stu-01"],
      extract: false,
    });
    expect(
      getAssignmentInsights(state, batch.templateId).actions.find(
        (action) => action.kind === "equal_parts",
      )?.status,
    ).toBe("suggested");
    expect(state.observations).toHaveLength(1);
  });
  it("makes a complete student-by-assignment matrix without duplicate uploads", () => {
    const state = createInitialState("teacher");
    for (const assignment of assignments)
      seedAssignment(state, assignment.templateId);
    const matrix = getStudentAssignmentMatrix(state);
    expect(matrix.students).toHaveLength(8);
    expect(
      matrix.students
        .flatMap((row) => row.cells)
        .reduce((sum, cell) => sum + cell.counts.total, 0),
    ).toBe(120);
    expect(
      matrix.students.every((row) => row.cells.every((cell) => cell.received)),
    ).toBe(true);
    for (const assignment of assignments.slice(1)) {
      const comparison = compareAssignments(state, assignment.templateId)!;
      for (const mix of [comparison.currentMix, comparison.previousMix])
        expect(mix.core + mix.transfer + mix.other).toBe(mix.total);
    }
    expect(
      compareAssignments(
        state,
        "independent-check-template-v1",
        "word-problems-template-v1",
      )?.previousMix,
    ).toEqual({ core: 0, transfer: 3, other: 0, total: 3 });
    expect(
      compareAssignments(state, "independent-check-template-v1")?.previous
        .templateId,
    ).toBe("fraction-practice-template-v1");
  });
  it("compares only paired independent core work and discloses changed task mix and help", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "baseline-template-v1", {
      studentIds: ["stu-04", "stu-05"],
    });
    seedAssignment(state, "followup-template-v1", {
      studentIds: ["stu-04"],
      support: "supported",
    });
    const comparison = compareAssignments(state, "followup-template-v1")!;
    expect(comparison.sharedStudentIds).toEqual(["stu-04"]);
    expect(comparison.supportChangedStudentIds).toEqual(["stu-04"]);
    expect(comparison.independentStudentIds).toEqual([]);
    expect(comparison.pairedCore.current.correctPercent).toBeNull();
    expect(comparison.taskMixChanged).toBe(true);
    expect(comparison.limitation).toContain("not a measured learning gain");
    expect(compareAssignments(state, "baseline-template-v1")).toBeNull();
  });
});
