import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantInsert, PlantRow } from "@/types";

export async function getPlants(client: SupabaseClient) {
  return client
    .from("plants")
    .select("*")
    .eq("status", "global")
    .order("name")
    .overrideTypes<PlantRow[], { merge: false }>();
}

export async function getPlantById(client: SupabaseClient, id: string) {
  return client.from("plants").select("*").eq("id", id).single<PlantRow>();
}

export async function createUserPlant(client: SupabaseClient, data: { name: string; user_id: string }) {
  return client
    .from("plants")
    .insert({ name: data.name, user_id: data.user_id, status: "pending" } satisfies PlantInsert)
    .select("*")
    .single<PlantRow>();
}

export async function getPendingPlants(client: SupabaseClient) {
  return client
    .from("plants")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .overrideTypes<PlantRow[], { merge: false }>();
}

export async function approvePlant(
  client: SupabaseClient,
  id: string,
  data: { growth_days: number; watering_needs?: string | null },
) {
  return client
    .from("plants")
    .update({
      status: "global",
      growth_days: data.growth_days,
      watering_needs: data.watering_needs ?? null,
    } satisfies import("@/types").PlantUpdate)
    .eq("id", id)
    .select("*")
    .single<PlantRow>();
}

export async function rejectPlant(client: SupabaseClient, id: string) {
  return client.from("plants").delete().eq("id", id);
}
