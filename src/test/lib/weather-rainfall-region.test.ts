import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRainfall7dCalendarMm } from "@/lib/services/weather";

vi.mock("@/lib/services/open-meteo", () => ({
  getAutoTimezone: vi.fn(() => Promise.resolve("Europe/Warsaw")),
}));

const WARSAW_REGION_ID = "region-warszawa";
const OGONY_REGION_ID = "region-ogony";

const FULL_WINDOW_ROWS = [
  { recorded_at: "2026-06-17T00:00:00Z", rainfall_mm: 0.3 },
  { recorded_at: "2026-06-16T00:00:00Z", rainfall_mm: 2 },
  { recorded_at: "2026-06-15T00:00:00Z", rainfall_mm: 1 },
  { recorded_at: "2026-06-14T00:00:00Z", rainfall_mm: 3 },
  { recorded_at: "2026-06-13T00:00:00Z", rainfall_mm: 2 },
  { recorded_at: "2026-06-12T00:00:00Z", rainfall_mm: 4 },
  { recorded_at: "2026-06-11T00:00:00Z", rainfall_mm: 1.7 },
];

function makeRainfallClient(options: {
  regionId: string;
  latitude: number;
  longitude: number;
  weatherRows: typeof FULL_WINDOW_ROWS;
}) {
  const regionEq = vi.fn();
  const weatherEq = vi.fn();
  const weatherGte = vi.fn();

  const weatherBuilder: Record<string, unknown> = {};
  const weatherChain = () => weatherBuilder;
  weatherBuilder.select = vi.fn(weatherChain);
  weatherBuilder.eq = vi.fn((col: string, val: unknown) => {
    if (col === "region_id") weatherEq(val);
    return weatherBuilder;
  });
  weatherBuilder.gte = vi.fn((col: string, val: unknown) => {
    if (col === "recorded_at") weatherGte(val);
    return weatherBuilder;
  });
  weatherBuilder.overrideTypes = vi.fn(() =>
    Promise.resolve({ data: options.weatherRows, error: null }),
  );

  const regionBuilder: Record<string, unknown> = {};
  const regionChain = () => regionBuilder;
  regionBuilder.select = vi.fn(regionChain);
  regionBuilder.eq = vi.fn((col: string, val: unknown) => {
    if (col === "id") regionEq(val);
    return regionBuilder;
  });
  regionBuilder.single = vi.fn(() =>
    Promise.resolve({
      data: { latitude: options.latitude, longitude: options.longitude },
      error: null,
    }),
  );

  return {
    from: vi.fn((table: string) => {
      if (table === "regions") return regionBuilder;
      if (table === "weather_records") return weatherBuilder;
      throw new Error(`unexpected table: ${table}`);
    }),
    _weatherEq: weatherEq,
    _regionEq: regionEq,
  };
}

describe("getRainfall7dCalendarMm region scoping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries weather_records for the provided region_id, not user coordinates", async () => {
    const client = makeRainfallClient({
      regionId: WARSAW_REGION_ID,
      latitude: 52.229676,
      longitude: 21.012229,
      weatherRows: FULL_WINDOW_ROWS,
    });

    const result = await getRainfall7dCalendarMm(client as any, WARSAW_REGION_ID);

    expect(client._regionEq).toHaveBeenCalledWith(WARSAW_REGION_ID);
    expect(client._weatherEq).toHaveBeenCalledWith(WARSAW_REGION_ID);
    expect(result.data).toBe(14);
    expect(result.error).toBeNull();
  });

  it("returns different totals when region_id changes after Warszawa to Ogony switch", async () => {
    const warsawRows = FULL_WINDOW_ROWS;
    const ogonyRows = warsawRows.map((row) => ({ ...row, rainfall_mm: (row.rainfall_mm ?? 0) + 10 }));

    const warsawClient = makeRainfallClient({
      regionId: WARSAW_REGION_ID,
      latitude: 52.229676,
      longitude: 21.012229,
      weatherRows: warsawRows,
    });
    const ogonyClient = makeRainfallClient({
      regionId: OGONY_REGION_ID,
      latitude: 52.154789,
      longitude: 21.045123,
      weatherRows: ogonyRows,
    });

    const warsaw = await getRainfall7dCalendarMm(warsawClient as any, WARSAW_REGION_ID);
    const ogony = await getRainfall7dCalendarMm(ogonyClient as any, OGONY_REGION_ID);

    expect(warsaw.data).toBe(14);
    expect(ogony.data).toBe(84);
    expect(ogony.data).not.toBe(warsaw.data);
  });

  it("returns null data when the 7-day window is incomplete for a newly created region", async () => {
    const client = makeRainfallClient({
      regionId: OGONY_REGION_ID,
      latitude: 52.154789,
      longitude: 21.045123,
      weatherRows: [{ recorded_at: "2026-06-15T00:00:00Z", rainfall_mm: 0.3 }],
    });

    const result = await getRainfall7dCalendarMm(client as any, OGONY_REGION_ID);

    expect(result.data).toBeNull();
    expect(result.rainfallStale).toBe(true);
  });
});
