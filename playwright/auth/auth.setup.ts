import { test as setup, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import path from "path";

const authFile = path.join(import.meta.dirname, "../.auth/user.json");

async function ensureAdminUser(serviceClient: SupabaseClient, email: string): Promise<void> {
  const { data, error } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  const existing = data.users.find((user) => user.email === email);

  if (!existing) {
    const { error: createError } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (createError) {
      throw new Error(`Failed to create E2E user: ${createError.message}`);
    }
    return;
  }

  if (existing.app_metadata.role !== "admin") {
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: "admin" },
    });
    if (updateError) {
      throw new Error(`Failed to grant admin role: ${updateError.message}`);
    }
  }
}

setup("authenticate", async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !supabaseUrl || !serviceRoleKey) {
    throw new Error("E2E_EMAIL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureAdminUser(serviceClient, email);

  const redirectTo = `${baseURL}/auth/callback`;
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties.hashed_token) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? "missing hashed_token"}`);
  }

  const tokenHash = encodeURIComponent(data.properties.hashed_token);
  const callbackUrl = `${baseURL}/auth/callback?token_hash=${tokenHash}&type=email`;
  await page.goto(callbackUrl);

  await expect(page).toHaveURL(`${baseURL}/dashboard`);

  // Confirm admin JWT before persisting storageState (admin E2E specs depend on it).
  await page.goto(`${baseURL}/admin/plant-requests`);
  await expect(page).toHaveURL(`${baseURL}/admin/plant-requests`);

  await page.context().storageState({ path: authFile });
});
