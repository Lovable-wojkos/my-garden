import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { CRON_SECRET } from "astro:env/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { getDailyWeather } from "@/lib/services/open-meteo";
import { GET } from "@/pages/api/cron/weather";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/open-meteo");

const REGIONS = [
  { id: "region-warsaw", latitude: 52.229676, longitude: 21.012229 },
  { id: "region-krakow", latitude: 50.06465, longitude: 19.94498 },
];

const DAILY_RECORDS = [
  { date: "2026-06-10", temperatureC: 20, rainfallMm: 1.5 },
  { date: "2026-06-11", temperatureC: 22, rainfallMm: 0 },
];

function makeContext(authHeader?: string): Pick<APIContext, "request"> {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return {
    request: new Request("http://localhost/api/cron/weather", { headers }),
  };
}

function makeCronClient(regions: typeof REGIONS) {
  const upsertCalls: { inserts: unknown[]; options: unknown }[] = [];

  const regionsBuilder = {
    select: vi.fn(function (this: typeof regionsBuilder) {
      return this;
    }),
    overrideTypes: vi.fn(() => Promise.resolve({ data: regions, error: null })),
  };

  const weatherRecordsBuilder = {
    upsert: vi.fn((inserts: unknown[], options: unknown) => {
      upsertCalls.push({ inserts, options });
      return Promise.resolve({ error: null });
    }),
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === "regions") return regionsBuilder;
      if (table === "weather_records") return weatherRecordsBuilder;
      throw new Error(`unexpected table: ${table}`);
    }),
    _upsertCalls: upsertCalls,
    _weatherRecordsBuilder: weatherRecordsBuilder,
  };

  return client;
}

describe("GET /api/cron/weather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDailyWeather).mockResolvedValue(DAILY_RECORDS);
  });

  it("returns 401 without valid cron authorization", async () => {
    const response = await GET(makeContext() as any);
    expect(response.status).toBe(401);
  });

  it("returns 401 with wrong cron secret", async () => {
    const response = await GET(makeContext("Bearer wrong-secret") as any);
    expect(response.status).toBe(401);
  });

  it("returns 500 when service-role client is unavailable", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);
    const response = await GET(makeContext(`Bearer ${CRON_SECRET}`) as any);
    expect(response.status).toBe(500);
  });

  it("upserts weather records with non-null region_id per region", async () => {
    const client = makeCronClient(REGIONS);
    vi.mocked(createServiceRoleClient).mockReturnValue(client as any);

    const response = await GET(makeContext(`Bearer ${CRON_SECRET}`) as any);

    expect(response.status).toBe(200);
    expect(getDailyWeather).toHaveBeenCalledTimes(2);
    expect(getDailyWeather).toHaveBeenCalledWith(REGIONS[0].latitude, REGIONS[0].longitude);
    expect(getDailyWeather).toHaveBeenCalledWith(REGIONS[1].latitude, REGIONS[1].longitude);

    expect(client._upsertCalls).toHaveLength(2);
    expect(client._upsertCalls[0].options).toEqual({ onConflict: "region_id, recorded_at" });
    expect(client._upsertCalls[0].inserts).toEqual(
      DAILY_RECORDS.map((r) => ({
        region_id: "region-warsaw",
        latitude: REGIONS[0].latitude,
        longitude: REGIONS[0].longitude,
        recorded_at: `${r.date}T00:00:00Z`,
        temperature_c: r.temperatureC,
        rainfall_mm: r.rainfallMm,
      })),
    );
    expect(client._upsertCalls[1].inserts).toEqual(
      DAILY_RECORDS.map((r) => ({
        region_id: "region-krakow",
        latitude: REGIONS[1].latitude,
        longitude: REGIONS[1].longitude,
        recorded_at: `${r.date}T00:00:00Z`,
        temperature_c: r.temperatureC,
        rainfall_mm: r.rainfallMm,
      })),
    );

    const json = await response.json();
    expect(json).toEqual({ fetched: 2, failed: 0, locations: 2, backfilled: true });
  });

  it("fetches each region once when two users share the same region", async () => {
    const client = makeCronClient([REGIONS[0]]);
    vi.mocked(createServiceRoleClient).mockReturnValue(client as any);

    const response = await GET(makeContext(`Bearer ${CRON_SECRET}`) as any);

    expect(response.status).toBe(200);
    expect(getDailyWeather).toHaveBeenCalledOnce();
    expect(client._upsertCalls).toHaveLength(1);

    const json = await response.json();
    expect(json.locations).toBe(1);
  });
});
