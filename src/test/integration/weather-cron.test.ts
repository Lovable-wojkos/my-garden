import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CRON_SECRET } from "astro:env/server";
import { GET } from "@/pages/api/cron/weather";
import { requireLocalSupabase } from "@/test/integration/setup";
import { createServiceRoleClient, seedTestRegion } from "@/test/integration/helpers/supabase";

const warsawFixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../fixtures/open-meteo/warsaw-forecast.json"), "utf8"),
);

const supabaseAvailable = await requireLocalSupabase();

describe.skipIf(!supabaseAvailable)("weather cron integration", () => {
  let regionId: string;
  let service: ReturnType<typeof createServiceRoleClient>;

  beforeAll(async () => {
    service = createServiceRoleClient();
    const region = await seedTestRegion(service, "Cron Integration Warsaw");
    regionId = region.id;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(warsawFixture), { status: 200 })),
    );
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await service.from("weather_records").delete().eq("region_id", regionId);
    await service.from("regions").delete().eq("id", regionId);
  });

  function makeCronContext() {
    return {
      request: new Request("http://localhost/api/cron/weather", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    };
  }

  it("upserts weather_records for test region and is idempotent on re-run", async () => {
    const response = await GET(makeCronContext() as any);
    expect(response.status).toBe(200);

    const { count: firstCount } = await service
      .from("weather_records")
      .select("*", { count: "exact", head: true })
      .eq("region_id", regionId);
    expect(firstCount).toBeGreaterThan(0);

    const rerun = await GET(makeCronContext() as any);
    expect(rerun.status).toBe(200);

    const { count: secondCount } = await service
      .from("weather_records")
      .select("*", { count: "exact", head: true })
      .eq("region_id", regionId);
    expect(secondCount).toBe(firstCount);

    const { data: sample } = await service
      .from("weather_records")
      .select("region_id, recorded_at, rainfall_mm, temperature_c")
      .eq("region_id", regionId)
      .eq("recorded_at", "2026-06-21T00:00:00Z")
      .single();
    expect(sample?.rainfall_mm).toBe(44.6);
    expect(sample?.temperature_c).toBe(30.7);
  });

  it("does not corrupt rows when fetch fails after pre-seed", async () => {
    await service.from("weather_records").delete().eq("region_id", regionId);

    await service.from("weather_records").insert({
      region_id: regionId,
      latitude: 52.229676,
      longitude: 21.012229,
      recorded_at: "2026-06-15T00:00:00Z",
      temperature_c: 18,
      rainfall_mm: 2.5,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Open-Meteo unavailable");
      }),
    );

    const response = await GET(makeCronContext() as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.failed).toBeGreaterThan(0);

    const { count } = await service
      .from("weather_records")
      .select("*", { count: "exact", head: true })
      .eq("region_id", regionId);
    expect(count).toBe(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(warsawFixture), { status: 200 })),
    );
  });
});
