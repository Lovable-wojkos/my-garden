import { describe, expect, it } from "vitest";
import {
  getCalendarWindowDates,
  isRainfallStale,
  sumCalendarRainfall,
  type CalendarRainfallRow,
} from "@/lib/services/weather";

describe("getCalendarWindowDates", () => {
  it("returns 7 dates strictly before today", () => {
    expect(getCalendarWindowDates("2026-06-18", 7)).toEqual([
      "2026-06-17",
      "2026-06-16",
      "2026-06-15",
      "2026-06-14",
      "2026-06-13",
      "2026-06-12",
      "2026-06-11",
    ]);
  });
});

describe("sumCalendarRainfall", () => {
  const today = "2026-06-18";
  const fullWindowRows: CalendarRainfallRow[] = [
    { recorded_at: "2026-06-17T00:00:00Z", rainfall_mm: 5 },
    { recorded_at: "2026-06-16T00:00:00Z", rainfall_mm: 2.5 },
    { recorded_at: "2026-06-15T00:00:00Z", rainfall_mm: 0 },
    { recorded_at: "2026-06-14T00:00:00Z", rainfall_mm: 1 },
    { recorded_at: "2026-06-13T00:00:00Z", rainfall_mm: 3 },
    { recorded_at: "2026-06-12T00:00:00Z", rainfall_mm: 0.5 },
    { recorded_at: "2026-06-11T00:00:00Z", rainfall_mm: 4 },
  ];

  it("sums rainfall for all 7 calendar days before today", () => {
    const result = sumCalendarRainfall(fullWindowRows, today, "Europe/Warsaw");
    expect(result.sum).toBe(16);
    expect(result.distinctDates).toBe(7);
    expect(result.latestRecordedAt).toBe("2026-06-17T00:00:00Z");
  });

  it("ignores rows outside the 7-day window", () => {
    const rows = [
      ...fullWindowRows,
      { recorded_at: "2026-06-10T00:00:00Z", rainfall_mm: 99 },
      { recorded_at: "2026-06-18T00:00:00Z", rainfall_mm: 99 },
    ];
    const result = sumCalendarRainfall(rows, today);
    expect(result.sum).toBe(16);
    expect(result.distinctDates).toBe(7);
  });

  it("treats null rainfall_mm as zero", () => {
    const rows = fullWindowRows.map((row, index) => (index === 0 ? { ...row, rainfall_mm: null } : row));
    const result = sumCalendarRainfall(rows, today);
    expect(result.sum).toBe(11);
    expect(result.distinctDates).toBe(7);
  });

  it("returns fewer than 7 distinct dates when window is incomplete", () => {
    const partialRows = fullWindowRows.slice(0, 3);
    const result = sumCalendarRainfall(partialRows, today);
    expect(result.distinctDates).toBe(3);
    expect(result.sum).toBe(7.5);
  });

  it("returns zero sum and zero distinct dates for empty rows", () => {
    const result = sumCalendarRainfall([], today);
    expect(result.sum).toBe(0);
    expect(result.distinctDates).toBe(0);
    expect(result.latestRecordedAt).toBeNull();
  });

  it("counts duplicate rows on the same calendar date once", () => {
    const rows = [...fullWindowRows, { recorded_at: "2026-06-17T12:00:00Z", rainfall_mm: 1 }];
    const result = sumCalendarRainfall(rows, today);
    expect(result.distinctDates).toBe(7);
    expect(result.sum).toBe(17);
    expect(result.latestRecordedAt).toBe("2026-06-17T12:00:00Z");
  });
});

describe("isRainfallStale", () => {
  it("returns true when latestRecordedAt is null", () => {
    expect(isRainfallStale(null)).toBe(true);
  });

  it("returns true when latest record is older than 36 hours", () => {
    const now = Date.parse("2026-06-18T12:00:00Z");
    const latest = "2026-06-16T23:00:00Z";
    expect(isRainfallStale(latest, now)).toBe(true);
  });

  it("returns false when latest record is within 36 hours", () => {
    const now = Date.parse("2026-06-18T12:00:00Z");
    const latest = "2026-06-17T12:00:00Z";
    expect(isRainfallStale(latest, now)).toBe(false);
  });
});

describe("getRainfall7dCalendarMm hide behavior", () => {
  it("caller should hide watering UI when distinctDates < 7", () => {
    const partial = sumCalendarRainfall([{ recorded_at: "2026-06-17T00:00:00Z", rainfall_mm: 5 }], "2026-06-18");
    expect(partial.distinctDates).toBeLessThan(7);
  });

  it("caller should hide watering UI when no rows", () => {
    const empty = sumCalendarRainfall([], "2026-06-18");
    expect(empty.distinctDates).toBe(0);
    expect(empty.sum).toBe(0);
  });
});
