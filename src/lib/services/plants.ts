import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantRow, PlantRequestInsert, PlantRequestRow, PlantRequestStatus } from "@/types";

export async function getPlants(client: SupabaseClient) {
  return client.from("plants").select("*").order("name").overrideTypes<PlantRow[], { merge: false }>();
}

export async function getPlantById(client: SupabaseClient, id: string) {
  return client.from("plants").select("*").eq("id", id).single<PlantRow>();
}

export async function createPlantRequest(client: SupabaseClient, insert: PlantRequestInsert) {
  return client.from("plant_requests").insert(insert).select().single<PlantRequestRow>();
}

export async function getPlantRequestsByUser(client: SupabaseClient, userId: string) {
  return client
    .from("plant_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .overrideTypes<PlantRequestRow[], { merge: false }>();
}

/** Admin only — must be called with a service-role client to bypass RLS. */
export async function updatePlantRequestStatus(client: SupabaseClient, id: string, status: PlantRequestStatus) {
  return client.from("plant_requests").update({ status }).eq("id", id).select().single<PlantRequestRow>();
}
