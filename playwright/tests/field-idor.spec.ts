import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const meta = JSON.parse(readFileSync(path.join(import.meta.dirname, "../.auth/two-users-meta.json"), "utf8")) as {
  fieldBId: string;
  fieldBName: string;
  plantingName: string;
  userAId: string;
  userBId: string;
  regionId: string;
};

test.afterAll(async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await service.from("plantings").delete().eq("field_id", meta.fieldBId);
  await service.from("fields").delete().eq("id", meta.fieldBId);
  await service.auth.admin.deleteUser(meta.userAId);
  await service.auth.admin.deleteUser(meta.userBId);
});

test("authenticated user A cannot view user B field detail content", async ({ page }) => {
  const response = await page.goto(`/dashboard/fields/${meta.fieldBId}`);

  await expect(page.getByText(meta.fieldBName)).not.toBeVisible();
  await expect(page.getByText(meta.plantingName)).not.toBeVisible();

  // Documents current SSR boundary: cross-tenant field id yields server error, not data leak.
  expect(response?.status()).toBeGreaterThanOrEqual(400);
});
