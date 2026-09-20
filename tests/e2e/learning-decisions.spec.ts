import { expect, test, type Page } from "@playwright/test";
import type { AppState } from "../../lib/contracts";

test.beforeEach(async ({ request, baseURL }) => {
  // These destructive resets are confined to Playwright's separate workspace.
  expect(new URL(baseURL!).port).toBe("3001");
  const reset = await request.post("/api/demo/reset", {
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

async function loadSampleClass(page: Page) {
  await page.goto("/classroom");
  await page
    .getByRole("button", { name: "Load sample class", exact: true })
    .click();
  await expect
    .poll(async () => (await stateFrom(page)).responses.length, {
      timeout: 70_000,
    })
    .toBe(120);
  await expect(page.getByLabel("Assignment", { exact: true })).toHaveValue(
    "independent-check-template-v1",
  );
  const state = await stateFrom(page);
  expect(state.batches).toHaveLength(5);
  expect(
    state.findings.filter((finding) => finding.status === "confirmed"),
  ).toHaveLength(0);
  expect(state.proposals).toHaveLength(0);
}

test("the overview leads with teaching decisions and dated evidence opens the editable source", async ({
  page,
}) => {
  await loadSampleClass(page);
  for (const name of [
    "Actions",
    "Progress",
    "Follow-ups",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(page.locator(".quality-score")).toBeHidden();
  await expect(page.locator(".student-assignment-matrix")).toBeHidden();
  await expect(
    page.getByRole("tab", { name: "Students", exact: true }),
  ).toBeHidden();

  await page.locator(".student-progress-explorer > summary").click();
  const evidence = page.locator(
    ".understanding-observation details.learning-evidence",
  );
  await expect(evidence).not.toHaveAttribute("open");
  await evidence.getByText("Evidence", { exact: true }).click();
  const source = evidence.getByRole("link").first();
  await expect(source).toBeVisible();
  await expect(source).toHaveText(/.+ · Sep \d+ · Q\d+/);
  const href = await source.getAttribute("href");
  expect(href).toBeTruthy();
  const target = new URL(href!, "http://127.0.0.1:3001");
  expect(target.searchParams.get("response")).toBeTruthy();
  expect(target.searchParams.get("revision")).toBeTruthy();
  await source.click();
  await expect(page).toHaveURL(target.href);
  await expect(page.getByLabel("Filter student", { exact: true })).toHaveValue(
    target.searchParams.get("student")!,
  );
  await expect(page.getByLabel("Filter question", { exact: true })).toHaveValue(
    target.searchParams.get("question")!,
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
  await page.getByRole("button", { name: "Edit reading", exact: true }).click();
  await expect(page.getByLabel("Final answer", { exact: true })).toBeEditable();
});

test("detailed evidence opens on demand and historical work points back to the latest planning picture", async ({
  page,
}) => {
  await loadSampleClass(page);
  const explorer = page.locator("details.evidence-explorer");
  const toggle = page.locator(".evidence-explorer > summary");
  await expect(explorer).not.toHaveAttribute("open");
  await toggle.click();
  await expect(explorer).toHaveAttribute("open");
  await expect(page.locator(".quality-score")).toBeVisible();
  await toggle.click();
  await expect(explorer).not.toHaveAttribute("open");
  await expect(page.locator(".quality-score")).toBeHidden();

  const summary = explorer.locator(":scope > summary");
  await summary.press("Enter");
  await expect(explorer).toHaveAttribute("open");
  await expect(page).toHaveURL(/[?&]evidence=open/);
  await expect(summary).toBeFocused();
  await summary.press("Space");
  await expect(explorer).not.toHaveAttribute("open");
  await expect(page).not.toHaveURL(/[?&]evidence=open/);
  await expect(summary).toBeFocused();

  await page.goto("/classroom?view=students");
  await expect(explorer).toHaveAttribute("open");
  await expect(
    page.getByRole("tab", { name: "Students", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".student-assignment-matrix")).toBeVisible();
  await toggle.click();
  await expect(explorer).not.toHaveAttribute("open");
  await expect(page.locator(".student-assignment-matrix")).toBeHidden();
  await expect(page).not.toHaveURL(/[?&](view|evidence)=/);

  await page
    .getByLabel("Assignment", { exact: true })
    .selectOption("baseline-template-v1");
  await expect(
    page.getByRole("heading", {
      name: "Earlier actions",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Actions", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Next step", exact: true }),
  ).toHaveCount(0);
  const latest = page.getByRole("link", {
    name: "Use the latest work to plan",
    exact: true,
  });
  await expect(latest).toHaveAttribute(
    "href",
    "/classroom?assignment=independent-check-template-v1",
  );
  await latest.click();
  await expect(page.getByLabel("Assignment", { exact: true })).toHaveValue(
    "independent-check-template-v1",
  );
  await expect(
    page.getByRole("heading", { name: "Actions", exact: true }),
  ).toBeVisible();
});

test("teacher-approved evidence becomes a saved lesson without reviving an older draft", async ({
  page,
}) => {
  await loadSampleClass(page);
  await page
    .getByRole("region", { name: "Next step", exact: true })
    .getByRole("link", { name: "Review teaching notes", exact: true })
    .click();
  await page
    .getByLabel("Filter student", { exact: true })
    .selectOption("stu-01");
  const notes = page.getByRole("checkbox", {
    name: /Select teaching note for Avery:/,
  });
  await expect(notes.first()).toBeVisible();
  const count = await notes.count();
  for (const note of await notes.all()) await note.check();
  await page
    .getByRole("button", { name: `Approve ${count} selected`, exact: true })
    .click();
  await expect(notes).toHaveCount(0);
  await page.goto("/classroom");
  const next = page.getByRole("region", { name: "Next step", exact: true });
  await next
    .getByRole("link", { name: "Prepare lesson changes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plans\/lesson-2026-10-01/);
  expect((await stateFrom(page)).proposals).toHaveLength(0);
  await page
    .getByRole("button", { name: "Suggest lesson changes", exact: true })
    .click();
  const save = page.getByRole("button", {
    name: "Save selected changes",
    exact: true,
  });
  await expect(save).toBeEnabled({ timeout: 40_000 });
  await expect(page.locator(".job-panel")).toHaveCount(0);
  const firstDraft = (await stateFrom(page)).proposals.at(-1)!;
  expect(firstDraft.status).toBe("draft");
  await page
    .getByRole("button", { name: "Update suggestions", exact: true })
    .click();
  await expect
    .poll(async () => (await stateFrom(page)).proposals.length)
    .toBe(2);
  await expect(page.locator(".job-panel")).toHaveCount(0);
  await expect(save).toBeEnabled();
  const beforeSave = await stateFrom(page);
  const lockedDates = beforeSave.calendarEntries.filter(
    (entry) => entry.locked,
  );
  const accepted = beforeSave.proposals.at(-1)!;
  expect(accepted.id).not.toBe(firstDraft.id);
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Saved lesson", exact: true }),
  ).toBeVisible();
  await expect(save).toHaveCount(0);
  await expect(page.locator(".change-list")).toHaveCount(0);
  await expect(
    page.getByText("These suggestions need updating.", { exact: true }),
  ).toHaveCount(0);
  const saved = await stateFrom(page);
  const version = saved.planVersions.find(
    (item) => item.proposalId === accepted.id,
  )!;
  expect(version.snapshot.totalMinutes).toBe(45);
  expect(
    version.snapshot.blocks.reduce(
      (minutes, block) => minutes + block.minutes,
      0,
    ),
  ).toBe(45);
  expect(saved.calendarEntries.filter((entry) => entry.locked)).toEqual(
    lockedDates,
  );
  expect(
    saved.proposals.find((item) => item.id === firstDraft.id)?.status,
  ).toBe("stale");
  expect(saved.proposals.find((item) => item.id === accepted.id)?.status).toBe(
    "applied",
  );
  await page.goto("/classroom");
  await next
    .getByRole("link", { name: "Open saved lesson", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plans\/lesson-2026-10-01$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Saved lesson", exact: true }),
  ).toBeVisible();
  await expect(save).toHaveCount(0);
  await expect(page.locator(".change-list")).toHaveCount(0);
});
