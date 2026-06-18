import { defineConfig, devices } from "@playwright/test";

// Dashboard and seed E2E specs require E2E_EMAIL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.
const hasE2EAuthEnv = Boolean(
  process.env.E2E_EMAIL && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const authProjects = hasE2EAuthEnv
  ? [
      {
        name: "setup",
        testMatch: /auth\.setup\.ts/,
      },
      {
        name: "chromium",
        use: {
          ...devices["Desktop Chrome"],
          storageState: "playwright/.auth/user.json",
        },
        dependencies: ["setup"],
      },
    ]
  : [];

export default defineConfig({
  testDir: "./playwright/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: authProjects,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
