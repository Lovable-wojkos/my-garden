/**
 * Rainfall display rules for WeatherWidget.
 * Kept pure so region-assignment / data-source regressions are testable.
 */

/** 7-day total: cron-backed DB sum wins over live Open-Meteo when present. */
export function displayRainfall7dMm(
  fromDb: number | null | undefined,
  fromLiveApi: number | undefined,
): number | null | undefined {
  return fromDb ?? fromLiveApi;
}

export interface PrefsRegionSnapshot {
  region_id: string;
  latitude: number;
  longitude: number;
}

export interface RegionSnapshot {
  id: string;
  latitude: number;
  longitude: number;
}

/**
 * Invariant after city edit: user_preferences.region_id must reference a region
 * row whose coordinates match the stored latitude/longitude.
 */
export function prefsMatchLinkedRegion(prefs: PrefsRegionSnapshot, region: RegionSnapshot): boolean {
  return prefs.region_id === region.id && prefs.latitude === region.latitude && prefs.longitude === region.longitude;
}
