import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const configDir = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(): void {
  const envPath = resolve(configDir, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const delimiterIndex = trimmed.indexOf("=");
    if (delimiterIndex <= 0) continue;

    const key = trimmed.slice(0, delimiterIndex).trim();
    let value = trimmed.slice(delimiterIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadDotEnv();

// Dashboard and seed E2E specs require E2E_EMAIL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.
const hasE2EAuthEnv = Boolean(
  process.env.E2E_EMAIL && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (!hasE2EAuthEnv) {
  console.warn(
    [
      "",
      "E2E auth env incomplete — Playwright will not register any projects.",
      "Add to .env: E2E_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
      "",
    ].join("\n"),
  );
}

const authProjects = hasE2EAuthEnv
  ? [
      {
        name: "setup",
        testDir: "./playwright/auth",
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
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
