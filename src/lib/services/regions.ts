import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegionRow } from "@/types";

export async function getRegions(client: SupabaseClient) {
  return client.from("regions").select("*").order("name").overrideTypes<RegionRow[], { merge: false }>();
}

export async function getRegionById(client: SupabaseClient, id: string) {
  return client.from("regions").select("*").eq("id", id).single<RegionRow>();
}
