import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeatherRecordRow } from "@/types";

export async function getLatestWeather(client: SupabaseClient, regionId: string) {
  return client
    .from("weather_records")
    .select("*")
    .eq("region_id", regionId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single<WeatherRecordRow>();
}

export async function getRainfallLast7Days(
  client: SupabaseClient,
  regionId: string,
): Promise<{ data: number | null; error: unknown }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("weather_records")
    .select("rainfall_mm")
    .eq("region_id", regionId)
    .gte("recorded_at", since)
    .overrideTypes<Pick<WeatherRecordRow, "rainfall_mm">[], { merge: false }>();
  if (error) return { data: null, error };
  const total = data.reduce((sum, r) => sum + (r.rainfall_mm ?? 0), 0);
  return { data: total, error: null };
}

export async function getLastRainDate(client: SupabaseClient, regionId: string) {
  return client
    .from("weather_records")
    .select("recorded_at, rainfall_mm")
    .eq("region_id", regionId)
    .gt("rainfall_mm", 0)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single<Pick<WeatherRecordRow, "recorded_at" | "rainfall_mm">>();
}
