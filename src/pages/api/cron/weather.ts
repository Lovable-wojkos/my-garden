import type { APIRoute } from "astro";
import { CRON_SECRET } from "astro:env/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { getDailyWeather } from "@/lib/services/open-meteo";
import type { RegionRow } from "@/types";

export const prerender = false;

type CronRegion = Pick<RegionRow, "id" | "latitude" | "longitude">;

export const GET: APIRoute = async (context) => {
  const authHeader = context.request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "service_role_key_not_configured" }), { status: 500 });
  }

  const { data: regions, error: regionsError } = await supabase
    .from("regions")
    .select("id, latitude, longitude")
    .overrideTypes<CronRegion[], { merge: false }>();

  if (regionsError) {
    return new Response(JSON.stringify({ error: "regions_query_failed" }), { status: 500 });
  }

  let fetched = 0;
  let failed = 0;

  for (const region of regions) {
    const { id: regionId, latitude: lat, longitude: lng } = region;
    try {
      const dailyRecords = await getDailyWeather(lat, lng);

      const inserts = dailyRecords.map((r) => ({
        region_id: regionId,
        latitude: lat,
        longitude: lng,
        recorded_at: `${r.date}T00:00:00Z`,
        temperature_c: r.temperatureC,
        rainfall_mm: r.rainfallMm,
      }));

      if (inserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("weather_records")
          .upsert(inserts, { onConflict: "region_id, recorded_at" });

        if (upsertError) {
          failed++;
        } else {
          fetched++;
        }
      }
    } catch (_e) {
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      fetched,
      failed,
      locations: regions.length,
      backfilled: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
