import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:3001",
    actionTimeout: 15_000,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://127.0.0.1:3001/classroom",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      APP_DEPLOYMENT: "local",
      APP_BASE_URL: "http://127.0.0.1:3001",
      DATA_BACKEND: "local",
      AI_MODE: "fixture",
      LOCAL_DATA_DIR: ".local/e2e",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
