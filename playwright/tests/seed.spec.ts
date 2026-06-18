import { test, expect } from "@playwright/test";
import { pl } from "../../src/lib/copy/pl";

test("pending plant request is visible for admin after page reload", async ({ page }) => {
  await page.goto("/admin/plant-requests");
  await expect(page).toHaveURL("/admin/plant-requests");
  await expect(page.getByRole("heading", { name: pl.admin.title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: pl.admin.title })).toBeVisible();
});
