import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const authFile = path.join(import.meta.dirname, "../.auth/user.json");

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

  const redirectTo = `${baseURL}/auth/callback`;
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties?.hashed_token) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? "missing hashed_token"}`);
  }

  const callbackUrl = `${baseURL}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`;
  await page.goto(callbackUrl);

  await page.waitForURL("/dashboard");
  await expect(page).toHaveURL("/dashboard");

  await page.context().storageState({ path: authFile });
});
