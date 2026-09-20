import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, createServerClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  return { getUser, createServerClient: vi.fn(() => ({ auth: { getUser } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { proxy } from "../../proxy";

type CookieBridge = {
  cookies: {
    setAll: (
      values: Array<{
        name: string;
        value: string;
        options: Record<string, unknown>;
      }>,
    ) => void;
  };
};

function request(path: string, cookie?: string) {
  return new NextRequest(`http://classcompass.test${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("page authentication proxy", () => {
  beforeEach(() => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    getUser.mockReset();
    createServerClient.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("redirects a signed-out page request to login with an internal return URL", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await proxy(request("/students/stu-04?skill=add-fractions"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://classcompass.test/login?next=%2Fstudents%2Fstu-04%3Fskill%3Dadd-fractions",
    );
  });

  it("allows a verified teacher through and moves an already signed-in login visit home", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "teacher-id" } }, error: null });
    expect((await proxy(request("/classroom"))).status).toBe(200);
    const loginResponse = await proxy(request("/login?next=%2Fstudents"));
    expect(loginResponse.headers.get("location")).toBe(
      "http://classcompass.test/classroom",
    );
  });

  it("does not loop on login when connected auth configuration is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await proxy(request("/login"))).status).toBe(200);
    expect((await proxy(request("/classroom"))).headers.get("location")).toContain(
      "/login?next=%2Fclassroom",
    );
  });

  it("keeps the explicit local fixture bypass for test and local demo servers", async () => {
    vi.stubEnv("DATA_BACKEND", "local");
    expect((await proxy(request("/classroom"))).status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("forwards a refreshed session and preserves HttpOnly/lax cookies on a loopback redirect", async () => {
    vi.stubEnv("APP_DEPLOYMENT", "local");
    vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3000");
    let bridge: CookieBridge;
    createServerClient.mockImplementationOnce((...args: unknown[]) => {
      bridge = args[2] as CookieBridge;
      return { auth: { getUser } };
    });
    getUser.mockImplementationOnce(async () => {
      bridge.cookies.setAll([
        {
          name: "sb-refresh",
          value: "rotated",
          options: { path: "/", httpOnly: false, sameSite: "strict" },
        },
      ]);
      return { data: { user: null }, error: null };
    });
    const incoming = request("/students", "sb-old=previous");
    const response = await proxy(incoming);
    const cookie = response.cookies.get("sb-refresh");
    expect(incoming.cookies.get("sb-refresh")?.value).toBe("rotated");
    expect(cookie).toMatchObject({
      value: "rotated",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
    expect(response.headers.get("location")).toContain("/login?next=%2Fstudents");
  });

  it("marks refreshed cookies secure for a hosted session", async () => {
    vi.stubEnv("APP_DEPLOYMENT", "hosted");
    let bridge: CookieBridge;
    createServerClient.mockImplementationOnce((...args: unknown[]) => {
      bridge = args[2] as CookieBridge;
      return { auth: { getUser } };
    });
    getUser.mockImplementationOnce(async () => {
      bridge.cookies.setAll([
        { name: "sb-refresh", value: "rotated", options: { path: "/" } },
      ]);
      return { data: { user: { id: "teacher-id" } }, error: null };
    });
    const response = await proxy(request("/classroom"));
    expect(response.cookies.get("sb-refresh")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });
});
