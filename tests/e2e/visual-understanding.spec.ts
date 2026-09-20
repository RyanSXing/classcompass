import { expect, test, type Page } from "@playwright/test";
import type { AppState } from "../../lib/contracts";

const templateIds = [
  "baseline-template-v1",
  "followup-template-v1",
  "fraction-practice-template-v1",
  "word-problems-template-v1",
  "independent-check-template-v1",
];

test.beforeEach(async ({ request, baseURL }) => {
  expect(new URL(baseURL!).port).toBe("3001");
  const headers = { origin: new URL(baseURL!).origin };
  const reset = await request.post("/api/demo/reset", {
    data: { confirm: true },
    headers,
  });
  expect(reset.ok()).toBeTruthy();
  for (const templateId of templateIds) {
    const load = await request.post("/api/demo/load", {
      data: { templateId },
      headers,
    });
    expect(load.ok()).toBeTruthy();
    const { batchId } = (await load.json()).data;
    const analysis = await request.post("/api/demo/analyze", {
      data: { batchId },
      headers,
    });
    expect(analysis.ok()).toBeTruthy();
  }
});

async function openPicture(page: Page) {
  await page.goto("/classroom");
  const picture = page.getByRole("region", {
    name: "Learning picture",
    exact: true,
  });
  await expect(picture).toBeVisible();
  await expect(
    page.getByLabel("Understanding skill", { exact: true }),
  ).toHaveValue("obj-add-unlike-fractions");
  return picture;
}

test("top actions lead the overview and each selected square opens exact dated work", async ({
  page,
}) => {
  const picture = await openPicture(page);
  const pictureBounds = await picture.boundingBox();
  const briefBounds = await page
    .getByRole("region", { name: "Do these next", exact: true })
    .boundingBox();
  expect(briefBounds!.y).toBeLessThan(pictureBounds!.y);
  const legend = picture.getByLabel("Understanding stages", { exact: true });
  for (const label of [
    "Needs support",
    "Getting there",
    "Works independently",
    "Not enough evidence",
  ])
    await expect(legend.getByText(label, { exact: true })).toBeVisible();
  await expect(
    picture.getByRole("button", { name: /^Sep \d+ · / }),
  ).toHaveCount(5);
  await expect(picture.locator(".understanding-heatmap tbody tr")).toHaveCount(
    8,
  );
  await expect(page.locator(".quality-score")).toBeHidden();
  await picture.getByText("Explore student progress", { exact: true }).click();

  const avery = picture.getByRole("button", {
    name: "Avery, Sep 22: Needs support",
    exact: true,
  });
  await avery.press("Enter");
  await expect(avery).toBeFocused();
  await expect(avery).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/understandingStudent=stu-01/);
  await expect(page).toHaveURL(/understandingDate=baseline-template-v1/);
  const selected = picture.getByRole("region", {
    name: "Avery: selected work",
    exact: true,
  });
  await expect(selected).toContainText("Needs support");
  await expect(selected).toContainText("Next:");
  await selected.getByText("Show me why", { exact: true }).click();
  const source = selected
    .getByRole("link", { name: /^Avery · Sep 22 · Q/ })
    .first();
  const target = new URL(
    (await source.getAttribute("href"))!,
    "http://127.0.0.1:3001",
  );
  const stateResponse = await page.request.get("/api/classroom");
  const state: AppState = (await stateResponse.json()).data.state;
  const response = state.responses.find(
    (item) => item.id === target.searchParams.get("response"),
  )!;
  expect(target.searchParams.get("revision")).toBe(String(response.revision));
  expect(target.searchParams.get("question")).toBe(response.questionId);
  await source.click();
  await expect(page).toHaveURL(target.href);
  await expect(page.getByLabel("Filter student", { exact: true })).toHaveValue(
    "stu-01",
  );
  await expect(
    page.getByRole("button", { name: "Edit reading", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved earlier work", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/students/stu-01?assignment=baseline-template-v1");
  const studentChart = page.locator(".student-visual-progress");
  await expect(studentChart).toContainText("Work through Sep 22");
  await expect(studentChart.getByRole("button", { name: /Avery, .*: inspect/ })).toHaveCount(1);
  await expect(studentChart.getByRole("link", { name: "Student profile", exact: true })).toHaveCount(0);
  await studentChart.getByRole("link", { name: "View all dates", exact: true }).click();
  await expect(studentChart).toContainText("Work through Sep 30");
  await expect(studentChart.getByRole("button", { name: /Avery, .*: inspect/ })).toHaveCount(5);

});

test("an unassessed skill is a gap, and changing skills preserves keyboard selection", async ({
  page,
}) => {
  const picture = await openPicture(page);
  await page
    .getByLabel("Understanding skill", { exact: true })
    .selectOption("obj-explain-fraction-context");
  const september25 = picture.getByRole("button", {
    name: "Sep 25 · Fraction practice: 0 needs support, 0 getting there, 0 works independently, 8 not enough evidence",
    exact: true,
  });
  await expect(september25).toBeVisible();
  await picture.getByText("Explore student progress", { exact: true }).click();
  const gap = picture.getByRole("button", {
    name: "Avery, Sep 25: Not enough evidence",
    exact: true,
  });
  await gap.press("Space");
  await expect(gap).toBeFocused();
  await expect(gap).toHaveAttribute("aria-pressed", "true");
  const selected = picture.getByRole("region", {
    name: "Avery: selected work",
    exact: true,
  });
  await expect(selected).toContainText("Not enough evidence");
  await expect(
    picture.locator(
      '.understanding-line[data-from-date="fraction-practice-template-v1"]',
    ),
  ).toHaveCount(0);
  await expect(
    picture.locator(
      '.understanding-line[data-to-date="fraction-practice-template-v1"]',
    ),
  ).toHaveCount(0);
  await selected.getByText("Show me why", { exact: true }).click();
  await expect(selected.getByRole("link")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByLabel("Understanding skill", { exact: true }),
  ).toHaveValue("obj-explain-fraction-context");
  await expect(gap).toHaveAttribute("aria-pressed", "true");
  await picture.getByText("How to read these stages", { exact: true }).click();
  await expect(picture.locator(".understanding-definitions")).toContainText(
    "not grades",
  );
});

for (const width of [390, 768]) {
  test(`the understanding dashboard is usable at ${width}px without page overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const picture = await openPicture(page);
    await page
      .getByLabel("Understanding skill", { exact: true })
      .selectOption("obj-equivalent-fractions");
    const gray = picture
      .getByRole("button", { name: /^Gray: .*Select Gray's work from Sep 30/ })
      .first();
    await gray.click();
    await expect(
      picture.getByRole("region", { name: "Gray: selected work", exact: true }),
    ).toBeVisible();
    await expect(gray).toHaveAttribute("aria-pressed", "true");
    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    const cellBounds = await gray.boundingBox();
    expect(cellBounds!.width).toBeGreaterThanOrEqual(24);
    expect(cellBounds!.height).toBeGreaterThanOrEqual(24);
  });
}

test("charts update together by date and skill while detailed work stays optional", async ({ page }) => {
  const picture = await openPicture(page);
  const priorities = page.getByRole("region", { name: "Do these next", exact: true });
  await expect(priorities.locator(".priority-action")).toHaveCount(2);
  await expect(priorities.getByText("From classroom evidence", { exact: true })).toHaveCount(2);
  await expect(picture.locator(".student-progress-explorer")).not.toHaveAttribute("open");
  await expect(picture.getByRole("heading", { name: "What this work shows" })).toBeVisible();
  await expect(picture.getByRole("heading", { name: "Skills at a glance" })).toBeVisible();
  await expect(picture.getByRole("heading", { name: "Learning over time", exact: true })).toBeVisible();

  await picture.getByRole("button", { name: /^Sep 22 · First check:/ }).click();
  await expect(picture.locator(".trend-current")).toHaveText("4 of 8");
  await expect(picture.getByRole("button", { name: /^Avery: Needs support\. Select Avery's work from Sep 22/ })).toBeVisible();
  await expect(picture.getByRole("button", { name: /^Adding fractions: 4 of 8 students work independently/ })).toHaveAttribute("aria-pressed", "true");

  await picture.getByRole("button", { name: /^Explaining and applying: / }).click();
  await expect(page.getByLabel("Understanding skill", { exact: true })).toHaveValue("obj-explain-fraction-context");
  await picture.getByRole("button", { name: /^Sep 25 · Fraction practice:/ }).click();
  await expect(picture.locator(".trend-current")).toHaveText("Needs evidence");
  await expect(picture.locator(".stage-bar-gap")).toHaveCount(8);
  await expect(picture.locator('.trend-line[data-from-date="fraction-practice-template-v1"], .trend-line[data-to-date="fraction-practice-template-v1"]')).toHaveCount(0);
  await expect(picture.getByRole("button", { name: /^Explaining and applying: Not enough evidence for 8 students/ })).toBeVisible();
  await expect(picture.locator('.radar-gap[data-skill="obj-explain-fraction-context"]')).toBeVisible();
  await expect(picture.locator(".radar-area")).toHaveCount(0);

  await picture.getByRole("button", { name: /^Casey: Not enough evidence\. Select Casey's work from Sep 25/ }).press("Enter");
  await expect(picture.locator(".student-progress-explorer")).toHaveAttribute("open");
  await expect(picture.getByRole("region", { name: "Casey: selected work", exact: true })).toContainText("Not enough evidence");
  await expect(picture.locator(".understanding-student-detail")).toBeFocused();
  await page.reload();
  await expect(picture.locator(".student-progress-explorer")).toHaveAttribute("open");
  await expect(picture.locator(".trend-current")).toHaveText("Needs evidence");
});
