import { describe, expect, it } from "vitest";
import {
  displayRainfall7dMm,
  prefsMatchLinkedRegion,
  type PrefsRegionSnapshot,
  type RegionSnapshot,
} from "@/lib/weather-display";

/** Realistic coords from the reported Warszawa / Ogony scenario. */
const WARSZAWA: RegionSnapshot = {
  id: "region-warszawa",
  latitude: 52.229676,
  longitude: 21.012229,
};

const OGONY: RegionSnapshot = {
  id: "region-ogony",
  latitude: 52.154789,
  longitude: 21.045123,
};

describe("displayRainfall7dMm (WeatherWidget 7-day source selection)", () => {
  it("prefers DB cron sum on dashboard when available", () => {
    expect(displayRainfall7dMm(14, 40)).toBe(14);
  });

  it("falls back to live Open-Meteo when DB sum is null (settings / incomplete window)", () => {
    expect(displayRainfall7dMm(null, 14)).toBe(14);
    expect(displayRainfall7dMm(undefined, 14)).toBe(14);
  });

  it("uses DB zero instead of live API when cron recorded 0 mm for all 7 days", () => {
    expect(displayRainfall7dMm(0, 14)).toBe(0);
  });

  it("does not mix DB rainfall from one region with live coords of another", () => {
    const dbSumForWarszawa = 14;
    const liveApiForOgonyCoords = 40;
    const shownOnDashboard = displayRainfall7dMm(dbSumForWarszawa, liveApiForOgonyCoords);
    expect(shownOnDashboard).toBe(14);
    expect(shownOnDashboard).not.toBe(liveApiForOgonyCoords);
  });
});

describe("prefsMatchLinkedRegion (region assignment invariant)", () => {
  it("passes when prefs region_id and coordinates align with the linked region row", () => {
    const prefs: PrefsRegionSnapshot = {
      region_id: WARSZAWA.id,
      latitude: WARSZAWA.latitude,
      longitude: WARSZAWA.longitude,
    };
    expect(prefsMatchLinkedRegion(prefs, WARSZAWA)).toBe(true);
  });

  it("fails when region_id points to Warszawa but coordinates are Ogony (feared mis-assignment)", () => {
    const prefs: PrefsRegionSnapshot = {
      region_id: WARSZAWA.id,
      latitude: OGONY.latitude,
      longitude: OGONY.longitude,
    };
    expect(prefsMatchLinkedRegion(prefs, WARSZAWA)).toBe(false);
    expect(prefsMatchLinkedRegion(prefs, OGONY)).toBe(false);
  });

  it("passes after switching from Warszawa to Ogony when all fields update together", () => {
    const prefs: PrefsRegionSnapshot = {
      region_id: OGONY.id,
      latitude: OGONY.latitude,
      longitude: OGONY.longitude,
    };
    expect(prefsMatchLinkedRegion(prefs, WARSZAWA)).toBe(false);
    expect(prefsMatchLinkedRegion(prefs, OGONY)).toBe(true);
  });
});
