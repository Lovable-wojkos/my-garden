# UI Data Display Fixes — Plan Brief

> Full plan: `context/changes/ui-data-display-fixes/plan.md`
> Frame brief: `context/changes/ui-data-display-fixes/frame.md`

## What & Why

The `WeatherWidget` "Ostatni deszcz" row shows only a date because the processing layer in `open-meteo.ts` discards the precipitation volume while capturing the date. The reframed problem: extend the last-rain data chain to carry `lastRainMm` from the API response through the type to the UI.

## Starting Point

`open-meteo.ts` already reads `rMm` from `precip[i]` to test `> 0` before setting `lastRainDate` — it just doesn't store it. The `WeatherData` interface and `WeatherWidget` render block have no volume field today.

## Desired End State

The "Ostatni deszcz" row displays both date and volume inline — e.g. `5 cze · 3.2 mm`. The "Brak danych" fallback is unchanged for locations with no rain in the 7-day window.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Volume display format | Inline: `{date} · {volume} mm` | Compact, matches existing row layout — no new DOM structure | Plan |
| Edge case: volume when date present | Always show mm value | `rMm > 0` guard guarantees non-zero value whenever `lastRainDate` is set | Plan |
| Temperature fix | Out of scope | Was a data defect (wrong stored coords), already resolved | Frame |
| Location granularity | Out of scope | User confirmed skip | Frame |

## Scope

**In scope:**
- Add `lastRainMm: number | null` to `WeatherData` interface
- Capture precipitation value in `open-meteo.ts` processing loop
- Update `WeatherWidget.tsx` render to show date + volume inline

**Out of scope:**
- Historical `weather.ts:getLastRainDate()` path (unused by widget)
- City-level location picker
- Temperature display (resolved as data defect)

## Architecture / Approach

Straight data-chain extension: the value already exists in the API response at the same array index used to set `lastRainDate`. Three files, two phases — no new components, no API changes, no migrations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extend Type & Processing | `WeatherData.lastRainMm` populated from API | None — purely additive change |
| 2. Update Widget Render | Date + volume shown inline in UI | None — single span update |

**Prerequisites:** None — all data already available from Open-Meteo API  
**Estimated effort:** ~1 session, 2 small file changes

## Open Risks & Assumptions

- Open-Meteo `precipitation_sum` values are assumed non-null for days with `> 0` rain — the existing null guard (`rMm != null`) on line 92 already handles the null case safely.

## Success Criteria (Summary)

- "Ostatni deszcz" row shows `{date} · {volume} mm` for any location with rain in the past 7 days
- "Brak danych" shown for dry locations — no regression
- Build and lint pass with no type errors
