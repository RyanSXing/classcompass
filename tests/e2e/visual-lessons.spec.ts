import { expect, test } from "@playwright/test";
import type { AppState } from "../../lib/contracts";

test.beforeEach(async ({ request, baseURL }) => {
  expect(new URL(baseURL!).port).toBe("3001");
  const reset = await request.post("/api/demo/reset", {
    data: { confirm: true },
    headers: { origin: new URL(baseURL!).origin },
  });
  expect(reset.ok()).toBeTruthy();
});

test("lesson stages follow the saved timings and closed teaching notes remain printable", async ({ page }) => {
  const response = await page.request.get("/api/classroom");
  const state: AppState = (await response.json()).data.state;
  const plan = state.plans[0];
  const version = state.planVersions.find((item) => item.id === plan.currentVersionId)!;
  await page.goto(`/plans/${plan.id}`);
  const guide = page.locator(".lesson-guide");
  await expect(guide).toBeVisible();
  expect(await guide.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector("#lesson-suggestions")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const stages = page.locator(".lg-timeline-stages > li");
  await expect(stages).toHaveCount(version.snapshot.blocks.length);
  let elapsed = 0;
  for (const [index, block] of version.snapshot.blocks.entries()) {
    const stage = stages.nth(index);
    await expect(stage).toContainText(block.title);
    await expect(stage.locator(".lg-stage-range")).toHaveText(`${elapsed}–${elapsed + block.minutes} min`);
    expect(await stage.evaluate((element) => Number(getComputedStyle(element).flexGrow))).toBe(block.minutes);
    await stage.getByRole("link").click();
    const target = page.locator(`#${await stage.getByRole("link").getAttribute("href").then((href) => href!.slice(1))}`);
    await expect(target).toBeVisible();
    await expect(target.locator(".lg-saved-instructions")).toHaveText(block.instructions);
    elapsed += block.minutes;
  }
  expect(elapsed).toBe(45);
  const detail = guide.locator(".lg-teaching-details").filter({ has: page.locator(".lg-worked-example") }).first();
  await expect(detail).not.toHaveAttribute("open");
  await expect(detail.locator(".lg-worked-example")).toBeHidden();
  await detail.locator("summary").press("Enter");
  await expect(detail.locator(".lg-worked-example")).toBeVisible();
  await detail.locator("summary").press("Enter");
  await expect(detail).not.toHaveAttribute("open");
  await page.emulateMedia({ media: "print" });
  await expect(detail.locator(".lg-worked-example")).toBeVisible();
  await expect(guide.locator(".lg-preparation .lg-details-body")).toBeVisible();
  await expect(guide.locator(".lg-next .lg-details-body")).toBeVisible();
  await expect(page.locator("#lesson-suggestions")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(guide).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a teacher's custom instructions remain complete in the saved plan", async ({ page }) => {
  const response = await page.request.get("/api/classroom");
  const payload = await response.json();
  const state: AppState = payload.data.state;
  const plan = state.plans[0];
  const version = state.planVersions.find((item) => item.id === plan.currentVersionId)!;
  const block = version.snapshot.blocks[0];
  block.id = "teacher-custom-opening";
  block.title = "Our fraction discussion";
  block.instructions = "Invite each student to draw one half.\nKeep the full class explanation: compare the size of each equal part before choosing common units.";
  await page.route("**/api/classroom", (route) => route.fulfill({ json: payload }));
  await page.goto(`/plans/${plan.id}`);
  const custom = page.locator("#lesson-stage-teacher-custom-opening");
  await expect(custom.getByRole("heading", { name: block.title })).toBeVisible();
  await expect(custom.locator(".lg-saved-instructions")).toHaveText(block.instructions);
  await expect(custom.locator(".lg-saved-instructions")).toBeVisible();
  await expect(custom.locator(".lg-origin")).toContainText("Saved instructions");
  await expect(custom.locator(".lg-teaching-details")).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(custom.locator(".lg-saved-instructions")).toBeVisible();
});
