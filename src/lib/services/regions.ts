import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegionRow } from "@/types";

/** @deprecated Removed in Phase 3 — field create no longer uses voivodeship list */
export async function getRegions(client: SupabaseClient) {
  return client.from("regions").select("*").order("display_name").overrideTypes<RegionRow[], { merge: false }>();
}

export async function getRegionById(client: SupabaseClient, id: string) {
  return client.from("regions").select("*").eq("id", id).single<RegionRow>();
}

export async function findOrCreateRegion(
  client: SupabaseClient,
  params: { latitude: number; longitude: number; displayName: string },
): Promise<{ data: RegionRow | null; error: unknown }> {
  const { latitude, longitude, displayName } = params;

  const existing = await client
    .from("regions")
    .select("*")
    .eq("latitude", latitude)
    .eq("longitude", longitude)
    .maybeSingle<RegionRow>();

  if (existing.error) {
    return { data: null, error: existing.error };
  }
  if (existing.data) {
    return { data: existing.data, error: null };
  }

  const inserted = await client
    .from("regions")
    .insert({ latitude, longitude, display_name: displayName })
    .select()
    .single<RegionRow>();

  return { data: inserted.data, error: inserted.error };
}
