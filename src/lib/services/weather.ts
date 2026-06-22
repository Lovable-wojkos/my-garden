import type { SupabaseClient } from "@supabase/supabase-js";
import { getAutoTimezone } from "@/lib/services/open-meteo";
import type { RegionRow, WeatherRecordRow } from "@/types";

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

export async function getRainfallLast7DaysByCoords(
  client: SupabaseClient,
  latitude: number,
  longitude: number,
): Promise<{ data: number | null; error: unknown }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("weather_records")
    .select("rainfall_mm")
    .eq("latitude", latitude)
    .eq("longitude", longitude)
    .gte("recorded_at", since)
    .overrideTypes<Pick<WeatherRecordRow, "rainfall_mm">[], { merge: false }>();
  if (error) return { data: null, error };
  const total = data.reduce((sum, r) => sum + (r.rainfall_mm ?? 0), 0);
  return { data: total, error: null };
}

export async function getLastRainDateByCoords(client: SupabaseClient, latitude: number, longitude: number) {
  return client
    .from("weather_records")
    .select("recorded_at, rainfall_mm")
    .eq("latitude", latitude)
    .eq("longitude", longitude)
    .gt("rainfall_mm", 0)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single<Pick<WeatherRecordRow, "recorded_at" | "rainfall_mm">>();
}

export interface CalendarRainfallRow {
  recorded_at: string;
  rainfall_mm: number | null;
}

export interface CalendarRainfallResult {
  sum: number;
  distinctDates: number;
  latestRecordedAt: string | null;
}

const RAINFALL_STALE_MS = 36 * 60 * 60 * 1000;
const CALENDAR_WINDOW_DAYS = 7;

/** Last N calendar dates strictly before today (YYYY-MM-DD). */
export function getCalendarWindowDates(todayDate: string, days: number = CALENDAR_WINDOW_DAYS): string[] {
  const dates: string[] = [];
  let current = todayDate;
  for (let i = 0; i < days; i++) {
    current = subtractCalendarDay(current);
    dates.push(current);
  }
  return dates;
}

function subtractCalendarDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Sum rainfall_mm for rows whose recorded_at date prefix falls on each of the
 * 7 calendar days strictly before todayDate. Canonical input for watering logic.
 */
export function sumCalendarRainfall(
  rows: CalendarRainfallRow[],
  todayDate: string,
  _timezone?: string,
): CalendarRainfallResult {
  const windowDates = new Set(getCalendarWindowDates(todayDate, CALENDAR_WINDOW_DAYS));
  let sum = 0;
  const seenDates = new Set<string>();
  let latestRecordedAt: string | null = null;

  for (const row of rows) {
    const datePrefix = row.recorded_at.slice(0, 10);

    // Track freshness across all rows (including today's) so the stale check
    // reflects the last actual cron run, not the last window date at midnight.
    if (!latestRecordedAt || row.recorded_at > latestRecordedAt) {
      latestRecordedAt = row.recorded_at;
    }

    if (!windowDates.has(datePrefix)) continue;

    sum += row.rainfall_mm ?? 0;
    seenDates.add(datePrefix);
  }

  return {
    sum: Number(sum.toFixed(1)),
    distinctDates: seenDates.size,
    latestRecordedAt,
  };
}

export function isRainfallStale(latestRecordedAt: string | null, nowMs: number = Date.now()): boolean {
  if (!latestRecordedAt) return true;
  return nowMs - new Date(latestRecordedAt).getTime() > RAINFALL_STALE_MS;
}

export function getTodayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(now);
}

/**
 * Calendar-based 7-day rainfall sum from weather_records for a region.
 * Returns null data when the window is incomplete (<7 distinct dates) so callers hide watering UI.
 * `windowDates` is an intentional extension point for consumers needing the 7-day window boundary dates.
 * `todayInTz` is the region's current calendar date for same-day queries (e.g. manual watering events).
 */
export async function getRainfall7dCalendarMm(
  client: SupabaseClient,
  regionId: string,
): Promise<{
  data: number | null;
  error: unknown;
  latestRecordedAt: string | null;
  rainfallStale: boolean;
  windowDates: string[];
  todayInTz: string;
}> {
  const { data: region, error: regionError } = await client
    .from("regions")
    .select("latitude, longitude")
    .eq("id", regionId)
    .single<Pick<RegionRow, "latitude" | "longitude">>();

  if (regionError) {
    return {
      data: null,
      error: regionError,
      latestRecordedAt: null,
      rainfallStale: true,
      windowDates: [],
      todayInTz: "",
    };
  }

  let timezone: string;
  try {
    timezone = await getAutoTimezone(region.latitude, region.longitude);
  } catch (error) {
    return {
      data: null,
      error,
      latestRecordedAt: null,
      rainfallStale: true,
      windowDates: [],
      todayInTz: "",
    };
  }

  const todayInTz = getTodayInTimezone(timezone);
  const windowDates = getCalendarWindowDates(todayInTz, CALENDAR_WINDOW_DAYS);
  const oldestDate = windowDates[windowDates.length - 1];
  const since = `${oldestDate}T00:00:00Z`;

  const { data: rows, error: rowsError } = await client
    .from("weather_records")
    .select("recorded_at, rainfall_mm")
    .eq("region_id", regionId)
    .gte("recorded_at", since)
    .overrideTypes<Pick<WeatherRecordRow, "recorded_at" | "rainfall_mm">[], { merge: false }>();

  if (rowsError) {
    return {
      data: null,
      error: rowsError,
      latestRecordedAt: null,
      rainfallStale: true,
      windowDates: [],
      todayInTz: "",
    };
  }

  const { sum, distinctDates, latestRecordedAt } = sumCalendarRainfall(rows, todayInTz, timezone);
  const rainfallStale = isRainfallStale(latestRecordedAt);
  const data = distinctDates >= CALENDAR_WINDOW_DAYS ? sum : null;

  return { data, error: null, latestRecordedAt, rainfallStale, windowDates, todayInTz };
}
