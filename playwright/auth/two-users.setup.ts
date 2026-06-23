import { test as setup, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const authDir = path.join(import.meta.dirname, "../.auth");
const storageStateFile = path.join(authDir, "two-users-a.json");
const metaFile = path.join(authDir, "two-users-meta.json");

const FIELD_B_NAME = "E2E IDOR Field B";
const PLANTING_B_NAME = "E2E IDOR Secret Tomato";

async function createConfirmedUser(service: SupabaseClient, email: string, password: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create user ${email}: ${error?.message ?? "missing user"}`);
  }
  return data.user.id;
}

async function seedFieldForUser(
  service: SupabaseClient,
  userId: string,
  regionId: string,
): Promise<{ fieldId: string }> {
  const { data, error } = await service
    .from("fields")
    .insert({
      user_id: userId,
      name: FIELD_B_NAME,
      cols: 3,
      rows: 3,
      region_id: regionId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to seed field B: ${error?.message ?? "missing row"}`);
  }

  const { error: plantingError } = await service.from("plantings").insert({
    field_id: data.id,
    user_id: userId,
    plant_name: PLANTING_B_NAME,
    cell_row: 0,
    cell_col: 0,
    seeding_date: "2026-06-01",
  });

  if (plantingError) {
    throw new Error(`Failed to seed planting B: ${plantingError.message}`);
  }

  return { fieldId: data.id };
}

setup("two-user idor fixtures", async ({ page, baseURL }) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || !baseURL) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and baseURL are required");
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `e2e-idor-a-${suffix}@example.test`;
  const emailB = `e2e-idor-b-${suffix}@example.test`;
  const password = `e2e-idor-password-${suffix}`;

  const userAId = await createConfirmedUser(service, emailA, password);
  const userBId = await createConfirmedUser(service, emailB, password);

  const { data: region, error: regionError } = await service
    .from("regions")
    .upsert(
      {
        latitude: 52.229676,
        longitude: 21.012229,
        display_name: "E2E IDOR Warsaw",
      },
      { onConflict: "latitude,longitude" },
    )
    .select("id")
    .single();

  if (regionError || !region) {
    throw new Error(`Failed to seed region: ${regionError?.message ?? "missing row"}`);
  }

  const { fieldId } = await seedFieldForUser(service, userBId, region.id);

  const redirectTo = `${baseURL}/auth/callback`;
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: emailA,
    options: { redirectTo },
  });

  if (linkError || !linkData.properties.hashed_token) {
    throw new Error(`Failed to generate magic link for user A: ${linkError?.message ?? "missing token"}`);
  }

  const tokenHash = encodeURIComponent(linkData.properties.hashed_token);
  await page.goto(`${baseURL}/auth/callback?token_hash=${tokenHash}&type=email`);
  await expect(page).toHaveURL(`${baseURL}/dashboard`);

  if (!existsSync(authDir)) {
    mkdirSync(authDir, { recursive: true });
  }

  await page.context().storageState({ path: storageStateFile });

  writeFileSync(
    metaFile,
    JSON.stringify(
      {
        fieldBId: fieldId,
        fieldBName: FIELD_B_NAME,
        plantingName: PLANTING_B_NAME,
        userAId,
        userBId,
        regionId: region.id,
      },
      null,
      2,
    ),
  );

  // Sanity: meta file readable by spec
  const meta = JSON.parse(readFileSync(metaFile, "utf8"));
  expect(meta.fieldBId).toBe(fieldId);
});
