import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getRainfall7dCalendarMm } from "@/lib/services/weather";
import { requireLocalSupabase } from "@/test/integration/setup";
import {
  createServiceRoleClient,
  seedTestRegion,
  signInTestUser,
  createTestUsers,
  teardownTestUsers,
} from "@/test/integration/helpers/supabase";

const supabaseAvailable = await requireLocalSupabase();

const WINDOW_DATES = ["2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22"];

describe.skipIf(!supabaseAvailable)("getRainfall7dCalendarMm live integration", () => {
  let regionId: string;
  let service: ReturnType<typeof createServiceRoleClient>;
  let users: Awaited<ReturnType<typeof createTestUsers>>;

  beforeAll(async () => {
    service = createServiceRoleClient();
    users = await createTestUsers();
    const region = await seedTestRegion(service, "Rainfall Integration Warsaw");
    regionId = region.id;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ timezone: "Europe/Warsaw" }), { status: 200 })),
    );

    for (const date of WINDOW_DATES) {
      const { error } = await service.from("weather_records").upsert(
        {
          region_id: regionId,
          latitude: region.latitude,
          longitude: region.longitude,
          recorded_at: `${date}T12:00:00Z`,
          temperature_c: 20,
          rainfall_mm: 1.0,
        },
        { onConflict: "region_id, recorded_at" },
      );
      if (error) throw error;
    }
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await service.from("weather_records").delete().eq("region_id", regionId);
    await teardownTestUsers(users, [regionId]);
  });

  it("returns fresh sum when 7-day window is complete", async () => {
    const session = await signInTestUser(users.userA);

    const result = await getRainfall7dCalendarMm(session.client, regionId);

    expect(result.error).toBeNull();
    expect(result.rainfallStale).toBe(false);
    expect(result.data).toBe(7.0);
  });

  it("flags rainfallStale when latest record is older than 36h", async () => {
    await service
      .from("weather_records")
      .update({ recorded_at: "2026-06-18T00:00:00Z" })
      .eq("region_id", regionId)
      .eq("recorded_at", "2026-06-22T12:00:00Z");

    const session = await signInTestUser(users.userA);
    const result = await getRainfall7dCalendarMm(session.client, regionId);

    expect(result.rainfallStale).toBe(true);
    expect(result.data).toBeNull();
  });
});
