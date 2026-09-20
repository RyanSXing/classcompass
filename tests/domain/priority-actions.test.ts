import { describe, expect, it } from "vitest";
import { getPriorityActions } from "../../lib/priority-actions";
import { getLearningInsights } from "../../lib/learning-insights";
import { createInitialState } from "../../lib/domain";
import { seedAssignment } from "./helpers";
import type { ClassroomBrief } from "../../lib/assistant-contracts";

const evidence = {
  id: "response:one",
  kind: "response" as const,
  label: "Avery · Sep 25 · Q2",
  href: "/assignments/a?response=one",
  excerpt: "Avery added the denominators.",
};

function brief(actions: ClassroomBrief["actions"]): ClassroomBrief {
  return {
    id: "brief-1",
    requestId: "request-1",
    title: "Brief",
    content: "Use a short check.",
    createdAt: "2026-09-25T00:00:00Z",
    scope: { templateId: "independent-check-template-v1" },
    actions,
    citations: [evidence],
    provenance: {
      mode: "live",
      modelId: "test",
      promptVersion: "test",
      generatedAt: "2026-09-25T00:00:00Z",
      inputFingerprint: "test",
    },
    contextDisclosure: {
      scope: {},
      assignmentCount: 1,
      responseCount: 1,
      conversationTurnsIncluded: 0,
      conversationTurnsOmitted: 0,
      historicalNotesIncluded: 0,
      historicalNotesOmitted: 0,
      historicalPlansIncluded: 0,
      historicalPlansOmitted: 0,
      text: "Test context.",
    },
  };
}

describe("priority actions", () => {
  it("keeps two teaching moves and leaves navigation out", () => {
    const state = createInitialState("teacher");
    const learning = getLearningInsights(state, "baseline-template-v1");
    const actions = getPriorityActions({
      brief: brief([
        {
          id: "open",
          title: "Open the saved lesson",
          description: "Read the saved teaching sequence.",
          citationId: "response:one",
          href: "/plans/lesson-2026-09-23",
        },
        {
          id: "teach",
          title: "Model equal-sized parts",
          description:
            "Time: 8 min\nWith: Avery\nDo: Model one rename.\nDo: Ask Avery to name the equal parts.\nCheck: Avery explains the denominator.",
          citationId: "response:one",
          href: "/assignments/a",
        },
        {
          id: "check",
          title: "Review equal-sized parts",
          description: "Ask one new question and record any help.",
          citationId: "response:one",
          href: "/assignments/a",
        },
        {
          id: "third",
          title: "Extend the practice",
          description:
            "Time: 4 min\nDo: Offer one word problem.\nCheck: Explain the method.",
          citationId: "response:one",
          href: "/assignments/a",
        },
      ]),
      learning,
      students: state.students,
    });
    expect(actions.map((action) => action.id)).toEqual(["teach", "check"]);
    expect(actions[0]).toMatchObject({ who: "Avery", time: "8 min" });
    expect(actions[0].description).toContain(
      "Do: Ask Avery to name the equal parts.",
    );
    expect(actions[1]).toMatchObject({
      title: "Review equal-sized parts",
      nextStep: "Ask one new question and record any help.",
      time: undefined,
    });
    expect(actions[0].citation).toMatchObject({
      label: evidence.label,
      href: evidence.href,
      excerpt: evidence.excerpt,
    });
  });

  it("uses saved classroom evidence when there is no current brief", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "independent-check-template-v1", {
      studentIds: ["stu-04", "stu-03"],
    });
    const learning = getLearningInsights(state, "independent-check-template-v1");
    const actions = getPriorityActions({ learning, students: state.students });
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ source: "evidence" });
    expect(actions[0].evidence?.length).toBeGreaterThan(0);
    expect(actions[0].studentIds?.some((id) => actions[1].studentIds?.includes(id))).toBe(false);
    expect(actions.every((action) => action.title !== "Open the saved lesson")).toBe(
      true,
    );
  });

  it("does not show a stale brief as a current recommendation", () => {
    const state = createInitialState("teacher");
    seedAssignment(state, "independent-check-template-v1", {
      studentIds: ["stu-04"],
    });
    const learning = getLearningInsights(state, "independent-check-template-v1");
    const current = brief([
      {
        id: "old-action",
        title: "Model equal-sized parts",
        description: "Time: 8 min\nDo: Model one rename.\nCheck: Ask why.",
        citationId: "response:one",
        href: "/assignments/a",
      },
    ]);
    current.stale = true;
    const actions = getPriorityActions({
      brief: current,
      learning,
      students: state.students,
    });
    expect(actions.every((action) => action.id !== "old-action")).toBe(true);
    expect(actions[0]?.source).toBe("evidence");
  });

  it("groups the full classroom's distinct follow-up needs into two actions", () => {
    const state = createInitialState("teacher");
    for (const templateId of [
      "baseline-template-v1",
      "followup-template-v1",
      "fraction-practice-template-v1",
      "word-problems-template-v1",
      "independent-check-template-v1",
    ])
      seedAssignment(state, templateId);
    const learning = getLearningInsights(state, "independent-check-template-v1");
    const actions = getPriorityActions({ learning, students: state.students });
    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.studentIds)).toEqual([
      ["stu-04"],
      ["stu-03", "stu-08"],
    ]);
    expect(actions[1].time).toBe("4 min per student");
    expect(actions[0].title).not.toBe(actions[1].title);
  });

  it("deduplicates exact assistant actions without changing their order", () => {
    const state = createInitialState("teacher");
    const learning = getLearningInsights(state, "baseline-template-v1");
    const duplicate = {
      title: "Model equal-sized parts",
      description: "Time: 8 min\nDo: Model one rename.\nCheck: Ask why.",
      citationId: "response:one",
      href: "/assignments/a",
    };
    const actions = getPriorityActions({
      brief: brief([
        { id: "first", ...duplicate },
        { id: "second", ...duplicate },
      ]),
      learning,
      students: state.students,
    });
    expect(actions.filter((action) => action.source === "live").map((action) => action.id)).toEqual([
      "first",
    ]);
  });

  it("fills a single student-specific assistant action with a distinct evidence group", () => {
    const state = createInitialState("teacher");
    for (const templateId of [
      "baseline-template-v1",
      "followup-template-v1",
      "fraction-practice-template-v1",
      "word-problems-template-v1",
      "independent-check-template-v1",
    ])
      seedAssignment(state, templateId);
    const learning = getLearningInsights(state, "independent-check-template-v1");
    const current = brief([
      {
        id: "devon-ai",
        title: "Recheck Devon's sum",
        description: "Time: 5 min\nWith: Devon\nDo: Ask Devon to recheck the sum.\nCheck: Explain each addition step.",
        citationId: "response:one",
        href: "/assignments/a?student=stu-04",
      },
    ]);
    current.citations[0] = { ...evidence, href: "/assignments/a?student=stu-04" };
    const actions = getPriorityActions({
      brief: current,
      learning,
      students: state.students,
    });
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ source: "live", studentIds: ["stu-04"] });
    expect(actions[1]).toMatchObject({
      source: "evidence",
      studentIds: ["stu-03", "stu-08"],
    });
  });
});
