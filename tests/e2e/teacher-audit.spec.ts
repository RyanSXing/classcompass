import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AppState } from "../../lib/contracts";

test.beforeEach(async ({ page, baseURL }) => {
  // This suite uses the configured isolated E2E workspace, never the demo server.
  expect(new URL(baseURL!).port).not.toBe("3000");
  const reset = await page.request.post("/api/demo/reset", {
    data: { confirm: true },
    headers: { origin: new URL(baseURL!).origin },
  });
  expect(reset.ok()).toBeTruthy();
});

async function stateFrom(page: Page): Promise<AppState> {
  const response = await page.request.get("/api/classroom");
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.state;
}

async function loadBaseline(page: Page) {
  await page.goto("/classroom?upload=work&assignment=baseline-template-v1");
  await page
    .getByRole("button", { name: "Load sample worksheets", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review\//);
  await page
    .getByRole("button", { name: "Analyze this upload", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update teaching notes", exact: true }),
  ).toBeEnabled({ timeout: 70_000 });
  await expect(page.locator(".job-panel")).toHaveCount(0);
  const state = await stateFrom(page);
  return {
    state,
    batch: state.batches.find(
      (item) => item.templateId === "baseline-template-v1",
    )!,
  };
}

test("unknown worksheet names require a student and upload choices stay frozen until failure is shown", async ({
  page,
}) => {
  await page.goto("/classroom?upload=work&assignment=baseline-template-v1");
  const dialog = page.getByRole("dialog", { name: "Upload work" });
  await dialog.getByLabel("Choose student worksheets").setInputFiles({
    name: "scan.png",
    mimeType: "image/png",
    buffer: await readFile(path.resolve("public/demo/baseline-stu-01.png")),
  });
  const student = dialog.getByLabel("Student for scan.png");
  const help = dialog.getByLabel("Help provided for scan.png");
  const submit = dialog.getByRole("button", {
    name: "Upload and analyze 1 worksheet",
    exact: true,
  });
  await expect(student).toHaveValue("");
  await expect(submit).toBeDisabled();
  await student.selectOption("stu-01");
  await help.selectOption("independent");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/uploads/prepare", async (route) => {
    await pending;
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "UPLOAD_UNAVAILABLE",
          message: "Upload unavailable. Please retry.",
        },
      },
    });
  });
  try {
    await submit.click();
    await expect(student).toBeDisabled();
    await expect(help).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Remove scan.png", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toContainText("Upload unavailable");
  await expect(student).toBeEnabled();
  await expect(student).toHaveValue("stu-01");
  await expect(help).toHaveValue("independent");
  expect((await stateFrom(page)).submissions).toHaveLength(0);
});

test("a failed replacement lesson cannot confirm the previous draft", async ({
  page,
}) => {
  await page.goto("/plans");
  await page
    .getByRole("button", { name: "Import lesson", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Import lesson" });
  const input = dialog.getByLabel("Choose lesson plan", { exact: true });
  await input.setInputFiles(
    path.resolve("public/demo/lesson-2026-09-23-original.json"),
  );
  const confirm = dialog.getByRole("button", {
    name: "Confirm lesson import",
    exact: true,
  });
  await expect(confirm).toBeEnabled();
  const before = await stateFrom(page);
  await input.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not valid JSON"),
  });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByLabel("Lesson title", { exact: true })).toHaveCount(
    0,
  );
  await expect(dialog.getByText("broken.json", { exact: true })).toBeVisible();
  expect((await stateFrom(page)).planVersions).toEqual(before.planVersions);
});

test("current exact citations stay editable, earlier revisions stay read-only, and note links select their own question", async ({
  page,
}) => {
  const { state, batch } = await loadBaseline(page);
  const submission = state.submissions.find(
    (item) => item.batchId === batch.id && item.studentId === "stu-01",
  )!;
  const response = state.responses.find(
    (item) => item.submissionId === submission.id && item.questionId === "q-01",
  )!;
  await page.goto(
    `/review/${batch.id}?student=stu-01&question=q-01&response=${response.id}&revision=${response.revision}`,
  );
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update teaching notes", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Saved earlier work", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Historical help not available", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Filter question", { exact: true })
    .selectOption("q-02");
  await page
    .locator(".teaching-note")
    .filter({ hasText: "Avery" })
    .getByRole("link", { name: "View question 1", exact: true })
    .click();
  await expect(page.getByLabel("Filter student", { exact: true })).toHaveValue(
    "stu-01",
  );
  await expect(page.getByLabel("Filter question", { exact: true })).toHaveValue(
    "q-01",
  );
  await expect(
    page.getByRole("heading", { name: "Avery · Question 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit reading", exact: true }).click();
  await page
    .getByLabel("Reason or review note", { exact: true })
    .fill("I verified the written answer against the original page.");
  await page
    .getByLabel("How readable is this response?", { exact: true })
    .selectOption("clear");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved earlier work", { exact: true }),
  ).toHaveCount(0);
  // The original citation remains exact after a teacher saves a newer reading.
  await page.goto(
    `/review/${batch.id}?student=stu-01&question=q-01&response=${response.id}&revision=${response.revision}`,
  );
  await expect(
    page.getByText("Saved earlier work", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "View current results", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Avery · Question 1", exact: true }),
  ).toBeVisible();
});

test("missing work has an assignment-aware upload path", async ({ page }) => {
  await page.goto("/classroom?upload=work&assignment=baseline-template-v1");
  const dialog = page.getByRole("dialog", { name: "Upload work" });
  await dialog
    .getByLabel("Choose student worksheets")
    .setInputFiles(path.resolve("public/demo/baseline-stu-01.png"));
  await expect(
    dialog.getByLabel("Student for baseline-stu-01.png"),
  ).toHaveValue("stu-01");
  await dialog
    .getByRole("button", {
      name: "Upload and analyze 1 worksheet",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(
    page.getByRole("button", { name: "Update teaching notes", exact: true }),
  ).toBeEnabled({ timeout: 70_000 });
  await page
    .getByLabel("Filter student", { exact: true })
    .selectOption("stu-02");
  await expect(
    page.getByText("No worksheet has been received for Blake.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Upload this assignment’s worksheet",
      exact: true,
    })
    .click();
  const nextDialog = page.getByRole("dialog", { name: "Upload work" });
  await expect(nextDialog).toBeVisible();
  await expect(
    nextDialog.getByLabel("Assignment", { exact: true }),
  ).toHaveValue("baseline-template-v1");
});

test("help-save failures stay in the dialog and empty student filters can be cleared", async ({
  page,
}) => {
  const { batch } = await loadBaseline(page);
  await page.goto(`/review/${batch.id}?student=stu-01`);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/submissions/*/support", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: "REVISION_CONFLICT",
          message: "This worksheet changed. Refresh and try again.",
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Edit help given", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit help given" });
  await dialog
    .getByLabel("What help was provided or verified?", { exact: true })
    .fill("I checked that the work was independent.");
  await dialog
    .getByRole("button", { name: "Save help given", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "This worksheet changed",
  );
  await expect(
    dialog.getByRole("button", { name: "Save help given", exact: true }),
  ).toBeEnabled();
  expect(pageErrors).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto(
    "/students/stu-01?assignment=baseline-template-v1&support=supported",
  );
  await expect(
    page.getByText("No answers match these filters.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear result filters", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "First check" }),
  ).toBeVisible();
  await expect(
    page.getByText("No answers match these filters.", { exact: true }),
  ).toHaveCount(0);
});

test("earlier approved work opens the lesson after the latest reviewed assignment", async ({
  page,
  baseURL,
}) => {
  const headers = { origin: new URL(baseURL!).origin };
  let baselineId = "";
  for (const [templateId, studentId] of [
    ["baseline-template-v1", "stu-01"],
    ["followup-template-v1", "stu-03"],
  ]) {
    const loaded = await page.request.post("/api/demo/load", {
      data: { templateId },
      headers,
    });
    expect(loaded.ok()).toBeTruthy();
    const batchId = (await loaded.json()).data.batchId;
    if (templateId === "baseline-template-v1") baselineId = batchId;
    const analyzed = await page.request.post("/api/demo/analyze", {
      data: { batchId },
      headers,
    });
    expect(analyzed.ok()).toBeTruthy();
    const state = await stateFrom(page);
    const finding = state.findings.find(
      (item) =>
        item.batchId === batchId &&
        item.studentId === studentId &&
        item.code === "denominator_addition",
    )!;
    expect(finding).toBeTruthy();
    const reviewed = await page.request.post("/api/findings/review", {
      headers,
      data: {
        items: [
          {
            findingId: finding.id,
            expectedRevision: finding.revision,
            decision: "confirm",
          },
        ],
        acknowledgeClearReadings: true,
      },
    });
    expect(reviewed.ok()).toBeTruthy();
  }
  await page.goto(`/review/${baselineId}?student=stu-01`);
  await expect(
    page.getByRole("link", { name: "Plan the next lesson", exact: true }),
  ).toHaveAttribute("href", "/plans/lesson-2026-09-25");
});
