import { test, expect } from "@playwright/test";

test("pending plant request is visible for admin after page reload", async ({ page }) => {
  await page.goto("/admin/plant-requests");
  await expect(page.getByRole("heading", { name: "Plant Requests" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plant Requests" })).toBeVisible();
});
