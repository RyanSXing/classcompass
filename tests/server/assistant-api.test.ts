import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, PATCH, POST } from "../../app/api/[...path]/route";

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "classcompass-assistant-api-"),
  );
  for (const [key, value] of Object.entries({
    LOCAL_DATA_DIR: directory,
    DATA_BACKEND: "local",
    APP_DEPLOYMENT: "local",
    AI_MODE: "fixture",
    VERCEL: "",
    OPENROUTER_API_KEY: "",
  }))
    vi.stubEnv(key, value);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(directory, { recursive: true, force: true });
});
const context = (id: string) => ({
  params: Promise.resolve({ path: ["assistant", id] }),
});
const request = (
  id: string,
  input: unknown,
  method = "POST",
  origin = "http://localhost:3000",
) =>
  new Request(`http://localhost:3000/api/assistant/${id}`, {
    method,
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(input),
  });

it("protects assistant routes, rejects injected owner/scope fields and exposes no key", async () => {
  expect(
    (
      await POST(
        request(
          "chat",
          { requestId: "x", message: "Help", mode: "fixture" },
          "POST",
          "https://attacker.test",
        ),
        context("chat"),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await PATCH(
        request(
          "goals",
          { text: "Help Casey", ownerId: "another-owner" },
          "PATCH",
        ),
        context("goals"),
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await POST(
        request("chat", {
          requestId: "x",
          message: "Help",
          scope: { studentId: "another-class-student" },
        }),
        context("chat"),
      )
    ).status,
  ).toBe(404);
  const response = await GET(
    new Request("http://localhost:3000/api/classroom"),
    { params: Promise.resolve({ path: ["classroom"] }) },
  );
  const payload = await response.json();
  expect(payload.data.config.assistantLiveAvailable).toBe(false);
  expect(JSON.stringify(payload)).not.toContain("OPENROUTER_API_KEY");
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("saves teacher goals with revision checks and handles unavailable live AI without changing lessons", async () => {
  const saved = await PATCH(
    request(
      "goals",
      { text: "Check independent reasoning.", expectedRevision: 0 },
      "PATCH",
    ),
    context("goals"),
  );
  expect(saved.status).toBe(200);
  expect(
    (
      await PATCH(
        request("goals", { text: "Stale edit", expectedRevision: 0 }, "PATCH"),
        context("goals"),
      )
    ).status,
  ).toBe(409);
  const read = () =>
    GET(new Request("http://localhost:3000/api/classroom"), {
      params: Promise.resolve({ path: ["classroom"] }),
    }).then((r) => r.json());
  const before = (await read()).data.state;
  const failed = await POST(
    request("chat", {
      requestId: "no-key",
      message: "What should I teach next?",
      mode: "live",
    }),
    context("chat"),
  );
  expect(failed.status).toBe(502);
  expect((await failed.json()).error.code).toBe("AI_KEY_MISSING");
  const after = (await read()).data.state;
  expect(after.planVersions).toEqual(before.planVersions);
  expect(after.findings).toEqual(before.findings);
  expect(after.assistant.goals.text).toBe("Check independent reasoning.");
});
