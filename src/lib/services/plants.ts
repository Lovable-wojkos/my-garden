import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantRow } from "@/types";

export async function getPlants(client: SupabaseClient) {
  return client.from("plants").select("*").order("name").overrideTypes<PlantRow[], { merge: false }>();
}

export async function getPlantById(client: SupabaseClient, id: string) {
  return client.from("plants").select("*").eq("id", id).single<PlantRow>();
}
