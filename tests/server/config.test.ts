import { afterEach, describe, expect, it, vi } from "vitest";
import { configuration } from "../../lib/server/config";
import { shouldUseSecureCookies } from "../../lib/server/auth";

afterEach(() => vi.unstubAllEnvs());

describe("runtime access boundaries", () => {
  it("keeps sample tools local unless explicitly enabled", () => {
    vi.stubEnv("APP_DEPLOYMENT", "local");
    vi.stubEnv("DATA_BACKEND", "local");
    vi.stubEnv("SHOW_SAMPLE_TOOLS", "false");
    expect(configuration().sampleToolsEnabled).toBe(true);

    vi.stubEnv("DATA_BACKEND", "supabase");
    expect(configuration().sampleToolsEnabled).toBe(false);
    vi.stubEnv("SHOW_SAMPLE_TOOLS", "true");
    expect(configuration().sampleToolsEnabled).toBe(true);
  });

  it("marks hosted and HTTPS auth cookies secure while preserving loopback login", () => {
    vi.stubEnv("APP_DEPLOYMENT", "local");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3000");
    expect(shouldUseSecureCookies()).toBe(false);
    vi.stubEnv("APP_BASE_URL", "https://classcompass.example");
    expect(shouldUseSecureCookies()).toBe(true);
    vi.stubEnv("APP_DEPLOYMENT", "hosted");
    vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3000");
    expect(shouldUseSecureCookies()).toBe(true);
  });
});
