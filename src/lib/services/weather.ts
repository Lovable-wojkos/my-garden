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

export async function getRainfallLast7Days(client: SupabaseClient, regionId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return client
    .from("weather_records")
    .select("rainfall_mm")
    .eq("region_id", regionId)
    .gte("recorded_at", since)
    .overrideTypes<Pick<WeatherRecordRow, "rainfall_mm">[], { merge: false }>();
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
