import { test, expect } from "@playwright/test";
import { pl } from "../../src/lib/copy/pl";

test("dashboard loads for authenticated user", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: pl.dashboard.title })).toBeVisible();
});
