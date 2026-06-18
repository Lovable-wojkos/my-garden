import { test, expect } from "@playwright/test";
import { pl } from "../../src/lib/copy/pl";

// Runs last (z- prefix): sign-out revokes the refresh token server-side, so it must
// not run before other specs that reuse storageState from auth.setup.ts.
test("sign out redirects to home", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: pl.nav.signOut }).click();
  await expect(page).toHaveURL("/");
});
