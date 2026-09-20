import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ request }) => {
  const reset = await request.post("/api/demo/reset", {
    data: { confirm: true },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(reset.ok()).toBeTruthy();
});

test("incomplete answers remain in the total and lead to a clear review step", async ({
  page,
  request,
}) => {
  const loaded = await request.post("/api/demo/load", {
    data: { templateId: "independent-check-template-v1" },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  const { batchId } = (await loaded.json()).data;
  const analyzed = await request.post("/api/demo/analyze", {
    data: { batchId },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(analyzed.ok()).toBeTruthy();
  await page.goto("/classroom");
  const next = page.getByRole("region", { name: "Next step", exact: true });
  await expect(
    next.getByRole("link", { name: "Review teaching notes", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quality-score")).not.toBeVisible();
  await page.locator(".evidence-explorer > summary").click();
  await expect(page.locator(".quality-score")).toBeVisible();
  await expect(page.locator(".quality-score")).toContainText("21 of 24");
  await expect(page.locator(".question-score-breakdown").last()).toContainText(
    "1 no answer",
  );
  await page
    .getByRole("tab", { name: "Students", exact: true })
    .click();
  const casey = page.getByRole("link", {
    name: "Casey, Independent check: 2 correct of 3 questions",
    exact: true,
  });
  await expect(casey).toBeVisible();
  await expect(casey.locator("..")).not.toHaveClass(/matrix-secure/);
  await casey.click();
  await expect(page.getByLabel("Filter student")).toHaveValue("stu-03");
  await expect(
    page.getByRole("button", { name: /Casey, question 3: No answer/ }),
  ).toBeVisible();
  await page.goto("/plans/lesson-2026-10-01");
  const suggestions = page.getByRole("region", {
    name: "Lesson suggestions",
    exact: true,
  });
  await expect(
    suggestions.getByRole("link", {
      name: "Review teaching notes",
      exact: true,
    }),
  ).toBeVisible();
  await suggestions
    .getByRole("link", { name: "Review teaching notes", exact: true })
    .click();
  await expect(page).toHaveURL(/#teaching-notes$/);
});

test("roster questions get the roster and an untouched mode follows server changes", async ({
  page,
}) => {
  let live = false;
  await page.route("**/api/classroom", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.config.aiMode = live ? "live" : "fixture";
    body.data.config.assistantLiveAvailable = true;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/assistant");
  await page
    .getByLabel("Ask about your classroom", { exact: true })
    .fill("Who are my students?");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  const reply = page.getByRole("article", {
    name: "Assistant reply",
    exact: true,
  });
  for (const name of [
    "Avery",
    "Blake",
    "Casey",
    "Devon",
    "Emery",
    "Finley",
    "Gray",
    "Harper",
  ])
    await expect(reply).toContainText(name);
  await expect(reply).not.toContainText("Try an explanation challenge");
  live = true;
  await page.getByRole("button", { name: "Add goals", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Teaching goals", exact: true })
    .fill("Collect independent fraction work.");
  await page.getByRole("button", { name: "Save goals", exact: true }).click();
  await expect(page.getByLabel("Assistant mode", { exact: true })).toHaveValue(
    "live",
  );
  await expect(
    page.getByRole("button", { name: "Ask Live AI", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Assistant mode", { exact: true })
    .selectOption("fixture");
  await page.getByRole("button", { name: "Edit goals", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Teaching goals", exact: true })
    .fill("Collect independent fraction work and explanations.");
  await page.getByRole("button", { name: "Save goals", exact: true }).click();
  await expect(page.getByLabel("Assistant mode", { exact: true })).toHaveValue(
    "fixture",
  );
});
