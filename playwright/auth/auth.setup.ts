import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(import.meta.dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/auth/signin");

  await page.fill("#email", process.env.E2E_EMAIL!);
  await page.fill("#password", process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("/dashboard");
  await expect(page).toHaveURL("/dashboard");

  await page.context().storageState({ path: authFile });
});
