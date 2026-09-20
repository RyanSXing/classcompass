import { expect, test } from "@playwright/test";

test("teacher can choose a dated lesson and open its saved plan", async ({
  page,
}) => {
  await page.goto("/plans");

  const library = page.getByRole("region", { name: "Lesson library" });
  await expect(library).toBeVisible();
  await page
    .getByRole("button", {
      name: "Show Sep 25 lesson: Compare strategies and check reasonableness",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Compare strategies and check reasonableness",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open lesson plan", exact: true }),
  ).toHaveAttribute("href", "/plans/lesson-2026-09-25");
});

test("student portraits load and the roster works on a narrow screen", async ({ page }) => {
  await page.goto("/students");
  const portraits = page.locator(".student-summary .student-portrait img");
  await expect(portraits).toHaveCount(8);
  await expect.poll(() => portraits.evaluateAll(images => images.every(image => {
    const img = image as HTMLImageElement;
    return img.complete && img.naturalWidth > 0;
  }))).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("searchbox", { name: "Find a student" }).fill("Avery");
  await expect(page.locator(".student-summary")).toHaveCount(1);
  await page.getByRole("link", { name: "View student", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Avery", exact: true })).toBeVisible();
  await expect(page.locator(".student-portrait img").first()).toBeVisible();
});
