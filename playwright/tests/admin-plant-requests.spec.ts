import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { pl } from "../../src/lib/copy/pl";

type PlantStatus = "pending" | "global";

interface PlantRecord {
  id: string;
  name: string;
  status: PlantStatus;
  growth_days: number | null;
  watering_needs: string | null;
}

test.describe("risk #2: admin can safely process pending plant requests", () => {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const hasServiceEnv = Boolean(supabaseUrl && serviceRoleKey);
  test.skip(!hasServiceEnv, "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this E2E");
  const createdPlantIds = new Set<string>();

  test.afterEach(async () => {
    if (!hasServiceEnv) {
      return;
    }

    if (createdPlantIds.size === 0) {
      return;
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const ids = Array.from(createdPlantIds);
    createdPlantIds.clear();
    const { error } = await serviceClient.from("plants").delete().in("id", ids);
    expect(error).toBeNull();
  });

  test("approve and reject flows update UI queue and persisted state", async ({ page }, testInfo) => {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const uniqueSuffix = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.retry}`;
    const approvePlantName = `E2E Approve ${uniqueSuffix}`;
    const rejectPlantName = `E2E Reject ${uniqueSuffix}`;

    const { data: approveSeed, error: approveSeedError } = await serviceClient
      .from("plants")
      .insert({ name: approvePlantName, status: "pending", user_id: null })
      .select("id, name, status, growth_days, watering_needs")
      .single<PlantRecord>();
    expect(approveSeedError).toBeNull();
    expect(approveSeed).not.toBeNull();
    if (!approveSeed) {
      throw new Error("Failed to seed approval request");
    }
    createdPlantIds.add(approveSeed.id);

    const { data: rejectSeed, error: rejectSeedError } = await serviceClient
      .from("plants")
      .insert({ name: rejectPlantName, status: "pending", user_id: null })
      .select("id, name, status, growth_days, watering_needs")
      .single<PlantRecord>();
    expect(rejectSeedError).toBeNull();
    expect(rejectSeed).not.toBeNull();
    if (!rejectSeed) {
      throw new Error("Failed to seed rejection request");
    }
    createdPlantIds.add(rejectSeed.id);

    await page.goto("/admin/plant-requests", { waitUntil: "networkidle" });
    await expect(page).toHaveURL("/admin/plant-requests");
    await expect(page.getByRole("heading", { name: pl.admin.title })).toBeVisible();

    const approveRow = page.getByRole("listitem").filter({ hasText: approvePlantName });
    const rejectRow = page.getByRole("listitem").filter({ hasText: rejectPlantName });

    await expect(approveRow).toBeVisible();
    await expect(rejectRow).toBeVisible();

    const approveButton = approveRow.getByRole("button", { name: pl.admin.approve });
    await expect(approveButton).toBeEnabled();
    await expect(async () => {
      await approveButton.click();
      await expect(page.getByLabel(pl.admin.growthDaysLabel)).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await page.getByLabel(pl.admin.growthDaysLabel).fill("30");
    await page.getByLabel(pl.admin.wateringNeedsLabel).fill("medium");
    await page.getByRole("dialog").getByRole("button", { name: pl.admin.approve }).click();

    await expect(approveRow).toHaveCount(0);

    await expect
      .poll(async () => {
        const { data, error } = await serviceClient
          .from("plants")
          .select("id, name, status, growth_days, watering_needs")
          .eq("id", approveSeed.id)
          .maybeSingle<PlantRecord>();

        if (error || !data) {
          return null;
        }

        return `${data.status}:${data.growth_days}:${data.watering_needs}`;
      })
      .toBe("global:30:medium");

    await rejectRow.getByRole("button", { name: pl.admin.reject }).click();
    const rejectDialog = page.getByRole("alertdialog", { name: pl.admin.rejectConfirm });
    await rejectDialog.getByRole("button", { name: pl.admin.reject }).click();
    await expect(rejectRow).toHaveCount(0);

    await expect
      .poll(async () => {
        const { data, error } = await serviceClient.from("plants").select("id").eq("id", rejectSeed.id).maybeSingle();
        if (error) {
          return "error";
        }
        return data === null ? "deleted" : "present";
      })
      .toBe("deleted");

    createdPlantIds.delete(rejectSeed.id);
  });
});
