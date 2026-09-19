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
    page.getByRole("button", { name: "Refresh findings", exact: true }),
  ).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".job-panel")).toHaveCount(0);
}

async function confirmCurrentStudents(page: Page) {
  await page
    .getByRole("button", { name: "Individual work", exact: true })
    .click();
  for (let i = 1; i <= 8; i++) {
    await page
      .getByLabel("Choose student", { exact: true })
      .selectOption(`stu-0${i}`);
    // A student can have both affirmative evidence and an incomplete-work limitation.
    const confirms = page.getByRole("button", {
      name: "Confirm finding",
      exact: true,
    });
    while (await confirms.count()) {
      const before = await confirms.count();
      await expect(confirms.first()).toBeEnabled();
      await confirms.first().click();
      await expect(confirms).toHaveCount(before - 1);
    }
  }
}

test("complete teacher-controlled baseline → correction → selected lesson → fresh progress loop", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/classroom");
  await expect(
    page.getByRole("heading", { name: "Your classroom", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset fictional work", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Import a real runtime lesson JSON through the same file pipeline used by teachers.
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

  await page.getByRole("link", { name: "Upload work", exact: true }).click();
  await page
    .getByRole("button", { name: "Load fictional baseline work", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review\//);
  const baselineUrl = page.url();
  await expect(
    page.getByText("Prepared demo analysis.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start analysis", exact: true })
    .click();
  await finishAnalysis(page);
  await expect(
    page.getByText("Prepared reading", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/This original prepared reading includes a simulated/),
  ).toHaveCount(0);

  // Changing the configured mode must not relabel already saved extraction origins.
  await page.route("**/api/classroom", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.config.aiMode = "live";
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(
    page.getByText("Saved reading origins: 32 prepared.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Prepared reading", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Live reading", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/classroom");

  // Correct one extraction, preserving the image and original extraction.
  await page
    .getByRole("button", { name: "Individual work", exact: true })
    .click();
  await page
    .getByLabel("Choose student", { exact: true })
    .selectOption("stu-06");
  await page
    .getByRole("button", { name: "Show question 3", exact: true })
    .click();
  await expect(page.locator(".transcript")).toContainText("1/5");
  await expect(
    page.getByText(/This original prepared reading includes a simulated/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit / verify reading", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Working shown on the page" })
    .fill("2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2");
  await page.getByLabel("Final answer", { exact: true }).fill("1/2");
  await page
    .getByLabel("How readable is this response?", { exact: true })
    .selectOption("clear");
  await page
    .getByLabel("Reason or review note", { exact: true })
    .fill("The original final denominator is 2; the prior step is 5/10.");
  await page
    .getByRole("button", { name: "Save reviewed reading", exact: true })
    .click();
  await expect(page.locator(".transcript")).toContainText("1/2");
  await expect(
    page.getByText("Prepared reading", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Teacher corrected", { exact: true }),
  ).toBeVisible();

  // Correct classroom context separately; numerical correctness must stay intact.
  await page
    .getByLabel("Choose student", { exact: true })
    .selectOption("stu-07");
  await page
    .getByRole("button", { name: "Edit recorded help", exact: true })
    .click();
  await page
    .getByLabel("Task conditions", { exact: true })
    .selectOption("supported");
  await page
    .getByRole("textbox", { name: "What help was provided or verified?" })
    .fill("I prompted Gray to find a common denominator on each question.");
  await page
    .getByRole("button", { name: "Save support context", exact: true })
    .click();
  await expect(
    page.locator(".fact-row").filter({ hasText: "Mathematical check" }),
  ).toContainText("Correct");
  await expect(
    page.locator(".fact-row").filter({ hasText: "Recorded help" }),
  ).toContainText("Supported");
  await page
    .getByRole("button", { name: "Refresh findings", exact: true })
    .click();
  await finishAnalysis(page);
  await page.getByRole("button", { name: "Patterns", exact: true }).click();
  await page.getByRole("button", { name: /Adding the denominators/ }).click();
  for (const name of ["Avery", "Blake", "Casey"]) {
    await page
      .locator(".pattern-roster .selection-chip")
      .filter({ hasText: name })
      .getByRole("checkbox")
      .check();
  }
  await page
    .getByRole("button", { name: "Confirm selected", exact: true })
    .click();
  await expect(page.locator(".pattern-card.active")).toContainText(
    "3 confirmed",
  );
  await confirmCurrentStudents(page);

  await page
    .getByRole("link", { name: "Adjust instruction", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Suggest lesson changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply selected changes", exact: true }),
  ).toBeEnabled({ timeout: 40_000 });
  await expect(
    page.getByText("One 12-minute block. Three concurrent activities.", {
      exact: true,
    }),
  ).toBeVisible();

  // Keep the original exit task while accepting practice and the fresh checkpoint.
  const exitChange = page
    .locator(".change-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Check the next small step",
        exact: true,
      }),
    });
  await exitChange
    .getByRole("button", { name: "Keep original", exact: true })
    .click();
  await expect(page.locator(".sticky-actions")).toContainText(
    "2 changes selected",
  );
  await page
    .getByRole("button", { name: "Apply selected changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your saved lesson", exact: true }),
  ).toBeVisible();
  const accepted = await stateFrom(page);
  const september23 = accepted.plans.find((p) => p.id === "lesson-2026-09-23")!;
  const firstAccepted = accepted.planVersions.find(
    (v) => v.id === september23.currentVersionId,
  )!;
  expect(
    firstAccepted.snapshot.blocks.reduce((n, block) => n + block.minutes, 0),
  ).toBe(45);
  expect(firstAccepted.selectedChangeIds).toHaveLength(2);
  const practice = firstAccepted.snapshot.blocks.find(
    (block) => block.id === "practice",
  )!;
  expect(practice.minutes).toBe(12);
  expect(practice.lanes?.find((l) => l.id === "targeted")?.studentIds).toEqual([
    "stu-01",
    "stu-02",
    "stu-03",
  ]);
  expect(practice.lanes?.find((l) => l.id === "extension")?.studentIds).toEqual(
    ["stu-04", "stu-05", "stu-06"],
  );
  expect(
    practice.lanes?.find((l) => l.id === "independent")?.entryCheckStudentIds,
  ).toEqual(["stu-07", "stu-08"]);
  const preservedSeptember23 = JSON.stringify(firstAccepted);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your saved lesson", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open materials", exact: true }).click();
  await expect(page.locator(".print-sheet")).toBeVisible();
  await expect(page.locator(".print-key")).toHaveCount(0);
  await expect(page.locator('.directions')).toContainText('Show your thinking with a drawing or a calculation.');
  await expect(page.locator('.print-sheet')).not.toContainText('Record hints');
  await expect(page.locator('.print-sheet')).not.toContainText('Provide equal-length');
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".print-sheet")).toBeVisible();
  await mkdir(path.resolve('.local/print-qa'), { recursive: true });
  await page.pdf({ path: '.local/print-qa/materials-letter.pdf', format: 'Letter', preferCSSPageSize: false, printBackground: true });
  await page.pdf({ path: '.local/print-qa/materials-a4.pdf', format: 'A4', preferCSSPageSize: false, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: /Teacher guidance/ }).click();
  await expect(page.locator(".print-key").first()).toBeVisible();
  await expect(page.locator('.print-sheet')).toContainText('Provide equal-length');
  await expect(page.locator('.print-sheet')).toContainText('Record hints');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: '.local/print-qa/teacher-key.pdf', format: 'Letter', preferCSSPageSize: false, printBackground: true });
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByText("Assessment stays put", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".calendar-cell").filter({ hasText: "Oct 2" }),
  ).toContainText("Fixed date");
  await expect(
    page.locator(".calendar-cell").filter({ hasText: "Sep 24" }),
  ).toContainText("Fresh fraction check");

  // Fresh work enters the same loop and targets September 25, never the taught lesson.
  await page.getByRole("link", { name: "Upload work", exact: true }).click();
  await page
    .getByLabel("Known assignment", { exact: true })
    .selectOption("followup");
  await page
    .getByRole("button", { name: "Load fictional followup work", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start analysis", exact: true })
    .click();
  await finishAnalysis(page);
  await confirmCurrentStudents(page);
  await page
    .getByRole("link", { name: "Adjust Sep 25 lesson", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/plans\/lesson-2026-09-25/);
  await page
    .getByRole("button", { name: "Suggest lesson changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply selected changes", exact: true }),
  ).toBeEnabled({ timeout: 40_000 });
  await page
    .getByRole("button", { name: "Apply selected changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your saved lesson", exact: true }),
  ).toBeVisible();
  const finalState = await stateFrom(page);
  expect(
    JSON.stringify(
      finalState.planVersions.find((v) => v.id === firstAccepted.id),
    ),
  ).toBe(preservedSeptember23);
  const finalPlan = finalState.plans.find((p) => p.id === "lesson-2026-09-25")!;
  const finalPractice = finalState.planVersions
    .find((v) => v.id === finalPlan.currentVersionId)!
    .snapshot.blocks.find((b) => b.id === "practice")!;
  expect(
    finalPractice.lanes?.find((l) => l.id === "targeted")?.studentIds,
  ).toEqual(["stu-03"]);
  expect(
    finalState.observations
      .filter((o) => o.studentId === "stu-07" && !o.superseded)
      .map((o) => o.observationStatus),
  ).toContain("independent");

  await page.goto("/students/stu-07");
  await expect(
    page.getByText("Demonstrated with support", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Demonstrated independently", { exact: true }),
  ).toBeVisible();
  await page.goto(baselineUrl);
  await expect(
    page.getByRole("heading", {
      name: "Let’s look at the evidence",
      exact: true,
    }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("390 px layout keeps classroom, review, lesson and calendar usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await stateFrom(page);
  const batch = state.batches.find((b) => b.kind === "baseline")!;
  for (const route of [
    "/classroom",
    `/review/${batch.id}`,
    "/plans/lesson-2026-09-23",
    "/calendar",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits, `horizontal overflow on ${route}`).toBeTruthy();
  }
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Upload work", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Classroom", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your classroom", exact: true }),
  ).toBeVisible();
});

test("real worksheet PNG uploads are mapped and lesson PDF imports are rendered before confirmation", async ({
  page,
}) => {
  await page.goto("/classroom");
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
  await expect(page).toHaveURL(/\/plans\/lesson-2026-09-23/);
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
    .getByRole("button", { name: "Analyze 1 worksheet", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review\//);
  await finishAnalysis(page);
  await expect(page.locator(".scan-paper img")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Adding the denominators", exact: true }),
  ).toBeVisible();
});
