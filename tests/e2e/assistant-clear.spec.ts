import { expect, test, type Page } from "@playwright/test";
import type { AppState } from "../../lib/contracts";

async function stateFrom(page: Page): Promise<AppState> {
  const response = await page.request.get("/api/classroom");
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.state;
}

test.beforeEach(async ({ request, baseURL }) => {
  expect(new URL(baseURL!).port).toBe("3001");
  const headers = { origin: new URL(baseURL!).origin };
  const reset = await request.post("/api/demo/reset", {
    data: { confirm: true },
    headers,
  });
  expect(reset.ok()).toBeTruthy();

  const loaded = await request.post("/api/demo/load", {
    data: { templateId: "independent-check-template-v1" },
    headers,
  });
  expect(loaded.ok()).toBeTruthy();
  const { batchId } = (await loaded.json()).data;
  const analyzed = await request.post("/api/demo/analyze", {
    data: { batchId },
    headers,
  });
  expect(analyzed.ok()).toBeTruthy();
});

test("clear chat removes the conversation but keeps goals and allows a new question", async ({
  page,
}) => {
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "Assistant", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add goals", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Teaching goals", exact: true })
    .fill("Keep the October 2 assessment on schedule.");
  await page.getByRole("button", { name: "Save goals", exact: true }).click();
  await expect(page.getByText("Teaching goals saved.", { exact: true })).toBeVisible();

  const composer = page.getByLabel("Ask about your classroom", { exact: true });
  await composer.fill("What should I teach next?");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  await expect(page.getByRole("article", { name: "Your question", exact: true })).toHaveCount(1);
  await expect(page.getByRole("article", { name: "Assistant reply", exact: true })).toHaveCount(1);

  await composer.fill("A draft I do not want to send");
  await page.getByRole("button", { name: "Clear chat", exact: true }).click();
  await expect(page.getByRole("article", { name: "Your question", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Assistant reply", exact: true })).toHaveCount(0);
  await expect(composer).toHaveValue("");
  await expect(composer).toBeFocused();
  await expect(page.getByText("Chat cleared.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("article", { name: "Your question", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Assistant reply", exact: true })).toHaveCount(0);
  await expect(page.locator(".teacher-goal-text")).toContainText("October 2");

  await composer.fill("Who are my students?");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  await expect(page.getByRole("article", { name: "Assistant reply", exact: true })).toContainText("Avery");
  const state = await stateFrom(page);
  expect(state.assistant?.turns).toHaveLength(2);
  expect(state.assistant?.goals.text).toContain("October 2");
});

test("an older classroom read cannot restore a cleared chat", async ({ page }) => {
  await page.goto("/assistant");
  const composer = page.getByLabel("Ask about your classroom", { exact: true });
  await expect(composer).toBeVisible();

  let delayNextRead = true;
  let releaseOldRead!: () => void;
  let announceOldRead!: () => void;
  let announceOldReadFulfilled!: () => void;
  const oldReadReleased = new Promise<void>((resolve) => {
    releaseOldRead = resolve;
  });
  const oldReadStarted = new Promise<void>((resolve) => {
    announceOldRead = resolve;
  });
  const oldReadFulfilled = new Promise<void>((resolve) => {
    announceOldReadFulfilled = resolve;
  });
  await page.route("**/api/classroom", async (route) => {
    const response = await route.fetch();
    const isDelayedRead = route.request().method() === "GET" && delayNextRead;
    if (isDelayedRead) {
      delayNextRead = false;
      announceOldRead();
      await oldReadReleased;
    }
    await route.fulfill({ response });
    if (isDelayedRead) announceOldReadFulfilled();
  });

  await composer.fill("What should I teach next?");
  await page
    .getByRole("button", { name: "Get sample reply", exact: true })
    .click();
  await oldReadStarted;

  await page.getByRole("button", { name: "Clear chat", exact: true }).click();
  await expect(page.getByText("Chat cleared.", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Your question", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Assistant reply", exact: true })).toHaveCount(0);

  releaseOldRead();
  await oldReadFulfilled;
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await expect(page.getByRole("article", { name: "Your question", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Assistant reply", exact: true })).toHaveCount(0);
  expect((await stateFrom(page)).assistant?.turns).toEqual([]);
});
