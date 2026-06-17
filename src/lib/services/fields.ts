import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldRow, FieldInsert, FieldUpdate } from "@/types";

export async function getFieldsByUser(client: SupabaseClient, userId: string) {
  return client
    .from("fields")
    .select("*")
    .eq("user_id", userId)
    .order("created_at")
    .overrideTypes<FieldRow[], { merge: false }>();
}

export async function getFieldById(client: SupabaseClient, fieldId: string) {
  return client.from("fields").select("*").eq("id", fieldId).single<FieldRow>();
}

export async function createField(client: SupabaseClient, insert: FieldInsert) {
  return client.from("fields").insert(insert).select().single<FieldRow>();
}

export async function updateField(client: SupabaseClient, id: string, update: FieldUpdate) {
  // Strip ownership field — user_id must not be changed via update
  const { user_id: _user_id, ...safeUpdate } = update;
  return client.from("fields").update(safeUpdate).eq("id", id).select().single<FieldRow>();
}

export async function deleteField(client: SupabaseClient, id: string) {
  return client.from("fields").delete().eq("id", id);
}

export async function updateFieldsRegionForUser(client: SupabaseClient, userId: string, regionId: string) {
  return client
    .from("fields")
    .update({ region_id: regionId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
