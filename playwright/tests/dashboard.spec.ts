import { test, expect } from "@playwright/test";

test("dashboard loads for authenticated user", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("sign out redirects to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("/auth/signin");
  await expect(page).toHaveURL("/auth/signin");
});
