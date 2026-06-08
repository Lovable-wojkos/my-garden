import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantingInsert, PlantingRow, PlantingUpdate } from "@/types";

export async function getPlantingsByField(client: SupabaseClient, fieldId: string) {
  return client.from("plantings").select("*").eq("field_id", fieldId).overrideTypes<PlantingRow[], { merge: false }>();
}

export async function createPlanting(client: SupabaseClient, insert: PlantingInsert) {
  return client.from("plantings").insert(insert).select().single<PlantingRow>();
}

export async function updatePlanting(client: SupabaseClient, id: string, update: PlantingUpdate) {
  // Strip ownership/structural fields — these must not be changed via update
  const { user_id: _user_id, field_id: _field_id, ...safeUpdate } = update;
  return client.from("plantings").update(safeUpdate).eq("id", id).select().single<PlantingRow>();
}

export async function deletePlanting(client: SupabaseClient, id: string) {
  return client.from("plantings").delete().eq("id", id);
}
