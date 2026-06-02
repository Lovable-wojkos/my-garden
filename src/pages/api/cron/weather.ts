import type { APIRoute } from "astro";
import { createServiceRoleClient } from "@/lib/supabase";
import { getDailyWeather } from "@/lib/services/open-meteo";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const cronHeader = context.request.headers.get("x-vercel-cron");
  if (!cronHeader) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "service_role_key_not_configured" }), { status: 500 });
  }

  const { data: prefs } = await supabase.from("user_preferences").select("latitude, longitude");

  const uniqueCoords = new Map<string, { lat: number; lng: number }>();
  for (const p of prefs ?? []) {
    const lat = p.latitude as number | null;
    const lng = p.longitude as number | null;
    if (lat !== null && lng !== null) {
      uniqueCoords.set(`${lat},${lng}`, { lat, lng });
    }
  }

  let fetched = 0;
  let failed = 0;

  for (const { lat, lng } of uniqueCoords.values()) {
    try {
      const dailyRecords = await getDailyWeather(lat, lng);

      const inserts = dailyRecords.map((r) => ({
        latitude: lat,
        longitude: lng,
        recorded_at: `${r.date}T00:00:00Z`,
        temperature_c: r.temperatureC,
        rainfall_mm: r.rainfallMm,
        region_id: null,
      }));

      if (inserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("weather_records")
          .upsert(inserts, { onConflict: "latitude, longitude, recorded_at" });

        if (upsertError) {
          console.error(`Failed to upsert for ${lat},${lng}:`, upsertError);
          failed++;
        } else {
          fetched++;
        }
      }
    } catch (e) {
      console.error(`Failed to fetch weather for ${lat},${lng}:`, e);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      fetched,
      failed,
      locations: uniqueCoords.size,
      backfilled: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
