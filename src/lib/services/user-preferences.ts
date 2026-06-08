import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPreferencesInsert, UserPreferencesRow } from "@/types";

export async function getUserPreferences(
  client: SupabaseClient,
  userId: string,
): Promise<{ data: UserPreferencesRow | null; error: unknown }> {
  return client.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
}

export async function upsertUserPreferences(
  client: SupabaseClient,
  prefs: UserPreferencesInsert,
): Promise<{ data: UserPreferencesRow | null; error: unknown }> {
  return client
    .from("user_preferences")
    .upsert({ ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
}
