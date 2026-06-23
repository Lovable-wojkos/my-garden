import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDailyWeather, getWeather } from "@/lib/services/open-meteo";

const WARSAW_LAT = 52.229676;
const WARSAW_LNG = 21.012229;

const warsawFixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../fixtures/open-meteo/warsaw-forecast.json"), "utf8"),
);

function stubOpenMeteoFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

describe("getDailyWeather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps fixture fields and excludes today and forecast days", async () => {
    stubOpenMeteoFetch(warsawFixture);

    const records = await getDailyWeather(WARSAW_LAT, WARSAW_LNG);

    expect(records).toHaveLength(7);
    expect(records.map((r) => r.date)).toEqual([
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
    ]);
    expect(records[0]).toEqual({ date: "2026-06-16", temperatureC: 19.1, rainfallMm: 0.2 });
    expect(records[5]).toEqual({ date: "2026-06-21", temperatureC: 30.7, rainfallMm: 44.6 });
  });

  it("returns null rainfall when precipitation is null", async () => {
    stubOpenMeteoFetch({
      ...warsawFixture,
      daily: {
        ...warsawFixture.daily,
        precipitation_sum: [null, 0, 0, 0, 0, 0, 0, 0],
      },
    });

    const records = await getDailyWeather(WARSAW_LAT, WARSAW_LNG);
    expect(records[0]?.rainfallMm).toBeNull();
  });

  it("returns empty array when daily.time is missing", async () => {
    stubOpenMeteoFetch({ timezone: "Europe/Warsaw", daily: {} });

    const records = await getDailyWeather(WARSAW_LAT, WARSAW_LNG);
    expect(records).toEqual([]);
  });
});

describe("getWeather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses current temperature and past-only 7-day rainfall from fixture", async () => {
    stubOpenMeteoFetch(warsawFixture);

    const weather = await getWeather(WARSAW_LAT, WARSAW_LNG);

    expect(weather.temperatureC).toBe(22.5);
    expect(weather.weatherCode).toBe(1);
    expect(weather.isDay).toBe(true);
    expect(weather.rainfall7dMm).toBe(44.8);
    expect(weather.lastRainDate).toBe("2026-06-21");
    expect(weather.lastRainMm).toBe(44.6);
  });
});
