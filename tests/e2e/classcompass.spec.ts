import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { AppState } from "../../lib/contracts";
test.describe.configure({ mode: "serial" });
async function stateFrom(page: Page): Promise<AppState> {
  const response = await page.request.get("/api/classroom");
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.state;
}
async function finishAnalysis(page: Page) {
  await expect(
    page.getByRole("button", { name: "Update teaching notes", exact: true }),
  ).toBeEnabled({ timeout: 70_000 });
  await expect(page.locator(".job-panel")).toHaveCount(0);
}
async function approveVisible(page: Page) {
  const checks = page.getByRole("checkbox", {
    name: /Select teaching note for/,
  });
  await expect(checks.first()).toBeVisible();
  const count = await checks.count();
  expect(count).toBeGreaterThan(0);
  for (const box of await checks.all()) await box.check();
  await page
    .getByRole("button", { name: `Approve ${count} selected`, exact: true })
    .click();
  await expect(checks).toHaveCount(0);
}
async function loadSingle(page: Page, templateId = "baseline-template-v1") {
  await page.getByRole("link", { name: "Upload work", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Upload work" })
    .getByLabel("Assignment", { exact: true })
    .selectOption(templateId);
  await page
    .getByRole("button", { name: "Load sample worksheets", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review\//);
  await page
    .getByRole("button", { name: "Analyze this upload", exact: true })
    .click();
  await finishAnalysis(page);
}
test("teacher corrects a flagged reading, reviews notes and saves selected changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/classroom");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const reset = await page.request.post("/api/demo/reset", {
    data: { confirm: true },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(reset.ok()).toBeTruthy();
  await page.goto("/plans");
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  await page
    .getByLabel("Choose lesson plan", { exact: true })
    .setInputFiles(path.resolve("public/demo/lesson-2026-09-23-original.json"));
  await expect(
    page.getByRole("button", { name: "Confirm lesson import", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Confirm lesson import", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plans\/lesson-2026-09-23/);
  await loadSingle(page);
  const baselineUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "First check", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Finley, question 3: Flagged, 1/5",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Filter result").selectOption("flagged");
  await expect(
    page.getByRole("button", { name: /question \d: Incorrect/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Finley, question 3: Flagged, 1/5",
      exact: true,
    })
    .click();
  await expect(page.locator(".transcript")).toContainText("1/5");
  // Saved sample provenance must survive switching the configured mode.
  await page.route("**/api/classroom", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.config.aiMode = "live";
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.getByText("Sample reading", { exact: true })).toBeVisible();
  await expect(page.getByText("Live reading", { exact: true })).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Edit reading", exact: true }).click();
  await page
    .getByLabel("Working shown on the page")
    .fill("2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2");
  await page.getByLabel("Final answer", { exact: true }).fill("1/2");
  await page
    .getByLabel("How readable is this response?", { exact: true })
    .selectOption("clear");
  await page
    .getByLabel("Reason or review note", { exact: true })
    .fill("The final denominator is 2; the prior step is 5/10.");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Filter result").selectOption("all");
  await page.getByLabel("Filter student").selectOption("stu-07");
  await page
    .getByRole("button", { name: "Edit help given", exact: true })
    .click();
  await page
    .getByLabel("Help given", { exact: true })
    .selectOption("supported");
  await page
    .getByLabel("What help was provided or verified?", { exact: true })
    .fill("I prompted Gray to find a common denominator.");
  await page
    .getByRole("button", { name: "Save help given", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Filter student").selectOption("");
  await page
    .getByRole("button", { name: "Update teaching notes", exact: true })
    .click();
  await finishAnalysis(page);
  await approveVisible(page);
  await page
    .getByRole("link", { name: "Plan the next lesson", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Suggest lesson changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save selected changes", exact: true }),
  ).toBeEnabled({ timeout: 40_000 });
  await page
    .getByRole("checkbox", {
      name: "Save change: Change the exit question",
      exact: true,
    })
    .uncheck();
  await page
    .getByRole("button", { name: "Save selected changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved lesson", exact: true }),
  ).toBeVisible();
  const saved = await stateFrom(page);
  const plan = saved.plans.find((p) => p.id === "lesson-2026-09-23")!;
  const version = saved.planVersions.find(
    (v) => v.id === plan.currentVersionId,
  )!;
  expect(version.selectedChangeIds).toHaveLength(2);
  expect(version.snapshot.blocks.reduce((n, b) => n + b.minutes, 0)).toBe(45);
  const practice = version.snapshot.blocks.find((b) => b.id === "practice")!;
  expect(practice.lanes?.find((l) => l.id === "targeted")?.studentIds).toEqual([
    "stu-01",
    "stu-02",
    "stu-03",
  ]);
  expect(practice.lanes?.find((l) => l.id === "extension")?.studentIds).toEqual(
    ["stu-04", "stu-05", "stu-06"],
  );
  const preserved = JSON.stringify(version);
  await page.reload();
  await page
    .getByRole("link", { name: "Print materials", exact: true })
    .click();
  await expect(page.locator(".print-sheet")).toBeVisible();
  await expect(page.locator(".print-key")).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".desktop-sidebar")).toBeHidden();
  await mkdir(path.resolve(".local/print-qa"), { recursive: true });
  await page.pdf({
    path: ".local/print-qa/materials-letter.pdf",
    format: "Letter",
    printBackground: true,
  });
  await page.pdf({
    path: ".local/print-qa/materials-a4.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: /Teacher guidance/ }).click();
  await expect(page.locator(".print-key").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: ".local/print-qa/teacher-key.pdf",
    format: "Letter",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto("/calendar");
  await expect(
    page.locator(".calendar-cell").filter({ hasText: "Oct 2" }),
  ).toContainText("Fixed date");
  await loadSingle(page, "followup-template-v1");
  await approveVisible(page);
  await page
    .getByRole("link", { name: "Plan the next lesson", exact: true })
    .click();
  await expect(page).toHaveURL(/lesson-2026-09-25/);
  await page
    .getByRole("button", { name: "Suggest lesson changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save selected changes", exact: true }),
  ).toBeEnabled({ timeout: 40_000 });
  await page
    .getByRole("button", { name: "Save selected changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved lesson", exact: true }),
  ).toBeVisible();
  const final = await stateFrom(page);
  expect(
    JSON.stringify(final.planVersions.find((v) => v.id === version.id)),
  ).toBe(preserved);
  const current = final.planVersions.find(
    (v) =>
      v.id ===
      final.plans.find((p) => p.id === "lesson-2026-09-25")!.currentVersionId,
  )!;
  expect(
    current.snapshot.blocks
      .find((b) => b.id === "practice")
      ?.lanes?.find((l) => l.id === "targeted")?.studentIds,
  ).toEqual(["stu-03"]);
  await page.goto("/students/stu-07");
  await expect(
    page.getByText("Demonstrated independently", { exact: true }),
  ).toBeVisible();
  await page.getByText(/Earlier reviews \(/).click();
  await expect(
    page.getByText("Demonstrated with help", { exact: true }),
  ).toBeVisible();
  await page.goto(baselineUrl);
  await expect(
    page.getByRole("heading", { name: "First check", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("five assignments give linked class and individual analytics without erasing reviews", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const before = await stateFrom(page);
  const accepted = before.planVersions.filter((v) => v.proposalId);
  const corrections = JSON.stringify(before.responseRevisions);
  await page.goto("/assignments");
  await page
    .getByRole("button", { name: "Load sample class", exact: true })
    .click();
  await expect(
    page.getByText("Sample assignments loaded. Existing work kept.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 100_000 });
  const state = await stateFrom(page);
  expect(state.students).toHaveLength(8);
  expect(state.batches).toHaveLength(5);
  expect(state.responses).toHaveLength(120);
  expect(state.submissions).toHaveLength(40);
  expect(JSON.stringify(state.responseRevisions)).toBe(corrections);
  for (const v of accepted)
    expect(state.planVersions.find((item) => item.id === v.id)).toEqual(v);
  expect(state.findings.filter((f) => f.status === "confirmed")).toHaveLength(
    before.findings.filter((f) => f.status === "confirmed").length,
  );
  await page
    .getByRole("button", { name: "Load sample class", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load sample class", exact: true }),
  ).toBeVisible({ timeout: 100_000 });
  expect((await stateFrom(page)).responses).toHaveLength(120);
  await page.goto("/classroom");
  await page
    .getByLabel("Assignment", { exact: true })
    .selectOption("word-problems-template-v1");
  await page.getByText("Explore the evidence", { exact: true }).click();
  await page.getByRole("link", { name: /1 Flagged Check the reading/ }).click();
  await expect(page.getByLabel("Filter result")).toHaveValue("flagged");
  await expect(
    page.getByRole("button", { name: /question \d: Flagged/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /question \d: Incorrect/ }),
  ).toHaveCount(0);
  await page.getByLabel("Filter result").selectOption("incorrect");
  await expect(
    page.getByRole("button", { name: /question \d: Incorrect/ }),
  ).toHaveCount(2);
  await page.goto(
    "/students/stu-03?assignment=fraction-practice-template-v1&support=supported",
  );
  await expect(
    page.getByRole("heading", { name: "Casey", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("With help");
  await page.getByRole("link", { name: "See work", exact: true }).click();
  await expect(page.getByLabel("Filter student")).toHaveValue("stu-03");
  await expect(page.getByLabel("Filter help given")).toHaveValue("supported");
  await page.goto(
    `/review/${state.batches.find((b) => b.templateId === "independent-check-template-v1")!.id}`,
  );
  await approveVisible(page);
  await page
    .getByRole("link", { name: "Plan the next lesson", exact: true })
    .click();
  await expect(page).toHaveURL(/lesson-2026-10-01/);
  await page
    .getByRole("button", { name: "Suggest lesson changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save selected changes", exact: true }),
  ).toBeEnabled({ timeout: 40_000 });
  await page
    .getByRole("button", { name: "Save selected changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved lesson", exact: true }),
  ).toBeVisible();
  const final = await stateFrom(page);
  const version = final.planVersions.find(
    (v) =>
      v.id ===
      final.plans.find((p) => p.id === "lesson-2026-10-01")!.currentVersionId,
  )!;
  expect(
    version.snapshot.blocks
      .find((b) => b.id === "practice")
      ?.lanes?.find((l) => l.id === "extension")?.studentIds,
  ).toContain("stu-01");
  expect(
    final.calendarEntries.find((e) => e.date === "2026-10-02")?.locked,
  ).toBe(true);
  await page.goto("/plans/lesson-2026-09-23");
  await expect(
    page.getByRole("button", { name: "Suggest lesson changes", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Open Oct 1 lesson", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("390px screens and modal navigation support keyboard use without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await stateFrom(page);
  for (const route of [
    "/classroom",
    "/assignments",
    "/students",
    "/students/stu-01",
    `/review/${state.batches[0].id}`,
    "/plans",
    "/plans/lesson-2026-10-01",
    "/calendar",
    "/assistant",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBeTruthy();
  }
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Navigation", exact: true });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await dialog.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test("classroom assistant uses saved goals, answers follow-ups and preserves evidence links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/assistant?student=stu-03&lesson=lesson-2026-10-01");
  await expect(
    page.getByRole("heading", { name: "Classroom assistant", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add goals", exact: true }).click();
  await page
    .getByLabel("Teaching goals", { exact: true })
    .fill(
      "Help Casey show equivalent fractions independently. Keep the October 2 assessment fixed.",
    );
  await page.getByRole("button", { name: "Save goals", exact: true }).click();
  await expect(
    page.getByText("Teaching goals saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Assistant mode", { exact: true })
    .selectOption("fixture");
  await page
    .getByLabel("Ask about your classroom", { exact: true })
    .fill("What should I do with Casey next? Show me the evidence.");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  const replies = page.getByRole("article", {
    name: "Assistant reply",
    exact: true,
  });
  await expect(replies).toHaveCount(1, { timeout: 30_000 });
  await expect(replies.first()).toContainText("Casey");
  await expect(
    replies.first().getByText("Sample reply", { exact: true }),
  ).toBeVisible();
  expect(
    await replies.first().locator(".chat-citation-links a").count(),
  ).toBeGreaterThan(0);
  await page
    .getByLabel("Ask about your classroom", { exact: true })
    .fill("How does that fit my goal and the next lesson?");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  await expect(replies).toHaveCount(2, { timeout: 30_000 });
  await expect(replies.last()).toContainText(/goal|October|lesson/i);
  await page.reload();
  await expect(replies).toHaveCount(2);
  await expect(page.locator(".teacher-goal-text")).toContainText("Help Casey");
  const saved = await stateFrom(page);
  expect(saved.assistant?.turns).toHaveLength(4);
  expect(saved.assistant?.goals.text).toContain("October 2");
  const citation = replies
    .first()
    .locator('.chat-citation-links a[href^="/review/"]')
    .first();
  if (await citation.count()) {
    await replies.first().locator(".chat-citations > summary").click();
    await citation.click();
    await expect(page.locator(".scan-paper img")).toBeVisible();
    await expect(page.locator(".transcript")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("AI briefing connects richer analytics to exact evidence and complete lesson versions", async ({
  page,
}) => {
  await page.goto(
    "/classroom?assignment=independent-check-template-v1&evidence=open",
  );
  await page
    .getByRole("tab", { name: "Students over time", exact: true })
    .click();
  const matrix = page.getByRole("region", {
    name: "Student results across assignments",
    exact: true,
  });
  await expect(matrix.locator("tbody tr")).toHaveCount(8);
  await expect(matrix.locator("thead th")).toHaveCount(6);
  await matrix
    .getByRole("link", {
      name: "Casey, Independent check: 2 correct of 3 questions",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Filter student")).toHaveValue("stu-03");
  await expect(
    page.getByRole("button", { name: /Casey, question 3: No answer/ }),
  ).toBeVisible();
  await page.goto(
    "/classroom?assignment=independent-check-template-v1&evidence=open",
  );
  await page
    .getByRole("tab", { name: "Question patterns", exact: true })
    .click();
  await expect(page.locator(".question-pattern-grid > article")).toHaveCount(3);
  await page.getByRole("tab", { name: "Class results", exact: true }).click();
  await page
    .getByLabel("Teaching insights mode", { exact: true })
    .selectOption("fixture");
  await page
    .getByRole("button", { name: "Generate teaching insights", exact: true })
    .click();
  await expect(
    page.getByText("Sample-mode brief", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".brief-action").first()).toBeVisible();
  const saved = await stateFrom(page);
  expect(saved.assistant?.briefs).toHaveLength(1);
  expect(saved.assistant?.briefs[0].contextDisclosure.responseCount).toBe(120);
  const plan = saved.plans.find((p) => p.id === "lesson-2026-10-01")!;
  const version = saved.planVersions.find(
    (v) => v.id === plan.currentVersionId,
  )!;
  await page.goto(`/plans/${plan.id}?version=${version.id}`);
  await expect(page.locator(".lesson-guide")).toContainText("Success criteria");
  await expect(page.locator(".lesson-guide")).toContainText("Worked example");
  await expect(page.locator(".lesson-guide")).toContainText(
    "After the exit check",
  );
  const old = saved.planVersions.find(
    (v) => v.lessonId === plan.id && v.id !== version.id,
  )!;
  await page.goto(`/plans/${plan.id}?version=${old.id}`);
  await expect(page.locator(".lg-meta")).toContainText(
    `Saved version ${old.versionNumber}`,
  );
  await page
    .getByLabel("Saved lesson version", { exact: true })
    .selectOption(version.id);
  await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}$`));
  await page.reload();
  await expect(page.locator(".lg-meta")).toContainText(
    `Saved version ${version.versionNumber}`,
  );
  await page.goto(`/plans/${plan.id}?version=missing-version`);
  await expect(
    page.getByRole("heading", {
      name: "Saved lesson version unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(
    "/classroom?assignment=independent-check-template-v1&evidence=open",
  );
  const goals = saved.assistant!.goals;
  const update = await page.request.patch("/api/assistant/goals", {
    data: {
      text: goals.text + " Collect a short exit check.",
      expectedRevision: goals.revision,
    },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(update.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByText(
      /Refresh this briefing for the current learning insights and evidence/,
    ),
  ).toBeVisible();
});

test("real PNG upload and source PDF lesson import still use the complete pipeline", async ({
  page,
}) => {
  await page.goto("/plans");
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  await page
    .getByLabel("Choose lesson plan", { exact: true })
    .setInputFiles(path.resolve("public/demo/lesson-2026-09-23-original.pdf"));
  await expect(page.getByLabel("Lesson title", { exact: true })).toHaveValue(
    "Apply fraction addition to word problems",
    { timeout: 30_000 },
  );
  await page.getByText("View original lesson", { exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Original uploaded lesson plan",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm lesson import", exact: true })
    .click();
  await expect(page).toHaveURL(/lesson-2026-09-23/);
  await page.getByRole("link", { name: "Upload work", exact: true }).click();
  await page
    .getByLabel("Choose student worksheets", { exact: true })
    .setInputFiles(path.resolve("public/demo/baseline-stu-01.png"));
  await page
    .getByLabel("Student for baseline-stu-01.png", { exact: true })
    .selectOption("stu-01");
  await page
    .getByLabel("Help provided for baseline-stu-01.png", { exact: true })
    .selectOption("independent");
  await page
    .getByRole("button", {
      name: "Upload and analyze 1 worksheet",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/review\//);
  await finishAnalysis(page);
  await expect(page.locator(".scan-paper img")).toBeVisible();
  await page.goto("/classroom?assignment=baseline-template-v1&evidence=open");
  await expect(
    page.getByText("8 of 8 worksheets received", { exact: true }),
  ).toBeVisible();
});
test("partial uploads process the selected source and uncertain readings keep their flags", async ({
  page,
}) => {
  const initial = await stateFrom(page);
  const created: string[] = [];
  for (const studentId of ["stu-01", "stu-02"]) {
    const source = initial.submissions.find(
      (s) =>
        s.studentId === studentId &&
        initial.batches.some(
          (b) => b.id === s.batchId && b.templateId === "baseline-template-v1",
        ),
    )!;
    const response = await page.request.post("/api/batches", {
      headers: { origin: "http://127.0.0.1:3001" },
      data: {
        templateId: "baseline-template-v1",
        activityDate: "2026-09-22",
        kind: "baseline",
        submissions: [
          {
            studentId,
            assetId: source.assetId,
            support: {
              level: "independent",
              source: "teacher-recorded",
              note: "Independent check",
            },
          },
        ],
      },
    });
    expect(response.ok()).toBeTruthy();
    created.push((await response.json()).data.id);
  }
  await page.goto(`/review/${created[1]}?student=stu-01`);
  await expect(
    page.getByRole("button", {
      name: "Avery, question 1: Not analyzed",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze this upload", exact: true })
    .click();
  await finishAnalysis(page);
  let current = await stateFrom(page);
  const a = current.submissions.find((s) => s.batchId === created[0])!;
  const b = current.submissions.find((s) => s.batchId === created[1])!;
  expect(current.responses.filter((r) => r.submissionId === a.id)).toHaveLength(
    4,
  );
  expect(current.responses.filter((r) => r.submissionId === b.id)).toHaveLength(
    0,
  );
  await page.getByLabel("Filter student").selectOption("stu-02");
  await page
    .getByRole("button", { name: "Analyze this upload", exact: true })
    .click();
  await finishAnalysis(page);
  current = await stateFrom(page);
  expect(current.responses.filter((r) => r.submissionId === b.id)).toHaveLength(
    4,
  );
  const word = current.batches.find(
    (b) => b.templateId === "word-problems-template-v1",
  )!;
  await page.goto(`/review/${word.id}?result=flagged`);
  await page
    .getByRole("button", { name: /Finley, question 3: Flagged/ })
    .click();
  await page.getByText("Reading details and history", { exact: true }).click();
  await expect(page.getByText(/simulated/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit reading", exact: true }).click();
  await page
    .getByLabel("How readable is this response?", { exact: true })
    .selectOption("uncertain");
  await page
    .getByLabel("Reason or review note", { exact: true })
    .fill("I still cannot read the final denominator reliably.");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Finley, question 3: Flagged/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check and move to next", exact: true })
    .click();
  await page
    .getByLabel("Working shown on the page")
    .fill("1/4 = 5/20; 1/10 = 2/20; 5/20 + 2/20 = 7/20 meter");
  await page.getByLabel("Final answer", { exact: true }).fill("7/20 meter");
  await page
    .getByLabel("How readable is this response?", { exact: true })
    .selectOption("clear");
  await page
    .getByLabel("Reason or review note", { exact: true })
    .fill("The source shows a denominator of20.");
  await page
    .getByRole("button", { name: "Save and next", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Return to results", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to results", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: /Finley, question 3: Correct, 7\/20 meter/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Finley, question 3: Correct, 7\/20 meter/ })
    .click();
  const firstRevision = page.getByRole("button", {
    name: "View revision 1",
    exact: true,
  });
  if (!(await firstRevision.isVisible()))
    await page
      .getByText("Reading details and history", { exact: true })
      .click();
  await firstRevision.click();
  await expect(page.locator(".transcript")).toContainText("7/30 meter");
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "View current results", exact: true })
    .click();
  await expect(page.locator(".transcript")).toContainText("7/20 meter");
  await expect(
    page.getByRole("heading", { name: "Finley · Question 3", exact: true }),
  ).toBeVisible();
});

test("goal drafts detect concurrent edits and interrupted questions can be asked again", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Edit goals", exact: true }).click();
  await page
    .getByLabel("Teaching goals", { exact: true })
    .fill("An older unsaved draft");
  const before = await stateFrom(page);
  const update = await page.request.patch("/api/assistant/goals", {
    data: {
      text: "A newer goal saved elsewhere",
      expectedRevision: before.assistant!.goals.revision,
    },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(update.ok()).toBeTruthy();
  await page
    .getByLabel("Assistant mode", { exact: true })
    .selectOption("fixture");
  await page
    .getByLabel("Ask about your classroom", { exact: true })
    .fill("What should I check next?");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save goals", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save goals", exact: true }).click();
  await expect(page.locator(".teacher-goal-form [role=alert]")).toBeVisible();
  expect((await stateFrom(page)).assistant?.goals.text).toBe(
    "A newer goal saved elsewhere",
  );
  await page.route("**/api/classroom", async (route) => {
    const response = await route.fetch(),
      payload = await response.json();
    const assistant = payload.data.state.assistant;
    assistant.turns.push({
      id: "interrupted-ui-check",
      requestId: "interrupted-ui-check",
      role: "user",
      content: "An interrupted classroom question",
      createdAt: "2020-01-01T00:00:00Z",
      scope: {},
      citations: [],
      actions: [],
      provenance: null,
      contextDisclosure: null,
    });
    assistant.requests.push({
      requestId: "interrupted-ui-check",
      kind: "chat",
      status: "pending",
      startedAt: "2020-01-01T00:00:00Z",
    });
    await route.fulfill({ response, json: payload });
  });
  await page.reload();
  const interrupted = page
    .getByRole("article", { name: "Your question", exact: true })
    .filter({ hasText: "An interrupted classroom question" });
  await interrupted
    .getByRole("button", { name: "Ask again", exact: true })
    .click();
  await expect(
    page.getByLabel("Ask about your classroom", { exact: true }),
  ).toHaveValue("An interrupted classroom question");
  await page.unrouteAll({ behavior: "wait" });
});
