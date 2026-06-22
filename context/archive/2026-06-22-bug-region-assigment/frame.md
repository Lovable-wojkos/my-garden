# Frame Brief: Region assignment vs rainfall display

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

While physically present in the Warszawa / Ogony area during significant rainfall (yesterday), the weather widget showed under-reported precipitation: **7-day rainfall 14 mm** and **last rain yesterday · 0.3 mm** — far below what was observed on the ground. The user had switched regions in the meantime. Two regions exist in the database (Warszawa and Ogony). The mismatch appears in the **app UI only** (database values not yet verified separately).

## Initial Framing (preserved)

- **User's stated cause or approach**: Suspects incorrect region assignment to the user during region editing — the wrong `region_id` may be linked when the city is changed.
- **User's proposed direction**: Investigate and fix region assignment during edit so rainfall and watering logic use the correct region.
- **Pre-dispatch narrowing**:
  - Mismatch location: UI only (DB not checked yet).
  - Timing: Noticed while physically witnessing heavy rain that the system did not reflect; not clearly tied to the exact moment of a region switch.
  - Scope: Not yet separated account-specific vs shared region records.
- **Post-dispatch narrowing**:
  - UI surface: Weather widget on **both dashboard and settings**.
  - Display values: 7-day **14 mm**, last rain **yesterday · 0.3 mm** — not zero / not empty state; city name was not reported as wrong.

## Dimension Map

The observation could originate at any of these dimensions:

1. **User `region_id` assignment during city edit** — `user_preferences.region_id` (and field propagation) points to the wrong shared region row after POST `/api/user-preferences`.  ← initial framing
2. **Split rainfall sources in WeatherWidget** — 7-day total prefers cron-backed DB sum on dashboard (`rainfall7dMmFromDb`) while last-rain always comes from live Open-Meteo; settings page uses live API only for 7-day.
3. **Cron / `weather_records` pipeline** — nightly job missing or under-recording precipitation for the region coordinates; stale or incomplete 7-day calendar window.
4. **Open-Meteo spatial / temporal accuracy** — geocoded coordinates represent a grid cell whose daily `precipitation_sum` understates localized heavy rain; calendar window excludes today and uses daily aggregates.
5. **Geocoding / place selection** — user picked a region label (Warszawa vs Ogony) whose coordinates do not match where rain was witnessed; assignment logic is correct but the chosen pin is wrong.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **A: Wrong `region_id` on edit** | POST handler atomically calls `findOrCreateRegion` → `upsertUserPreferences` with matching lat/lng + `region_id` → `updateFieldsRegionForUser` (`src/pages/api/user-preferences.ts:68-93`). Tests cover region propagation on city change (`src/test/api/user-preferences.test.ts:65-105`). No code path updates city/lat/lng without `region_id`. | **WEAK** — no structural bug found; would not explain identical last-rain on settings (live API by coords, not `region_id`). |
| **B: Split DB vs live sources in widget** | `displayRainfall7dMm = rainfall7dMmFromDb ?? weatherState.data?.rainfall7dMm` (`WeatherWidget.tsx:211`). Last rain always from live fetch (`WeatherWidget.tsx:316-318`). Dashboard passes DB sum (`dashboard.astro:119-124`); settings does **not** pass `rainfall7dMmFromDb` (`settings.astro:32`). | **WEAK for region bug** — explains dashboard vs settings differences in theory, but user reports **same** widget values on both pages; last-rain line is API-only everywhere. |
| **C: Cron / `weather_records` gap** | Cron upserts daily rows per region (`src/pages/api/cron/weather.ts:34-57`). Calendar helper requires 7 distinct past days or returns null (`weather.ts:197`). Could under-report on dashboard if DB rows are low — but settings 7-day uses live API when no DB prop is passed. | **WEAK–MEDIUM** — may affect dashboard 7-day if DB preferred; does not explain settings page matching dashboard unless API and DB agree. |
| **D: Open-Meteo under-reporting** | Live `/api/weather` → `getWeather` sums daily `precipitation_sum` for past days only, excluding today (`open-meteo.ts:89-105`). Last rain 0.3 mm yesterday is exactly what Open-Meteo returned for the stored coordinates — consistent on dashboard and settings because both fetch by lat/lng. | **STRONG** — matches reported numbers (14 mm / 0.3 mm), both UI surfaces, and does not require a region-assignment failure. |
| **E: Wrong place selected (geocoding)** | Warszawa and Ogony are distinct region rows with different coordinates. Heavy rain can be highly localized. User switched between them around the time of observation. | **MEDIUM** — plausible user-facing mismatch without a software assignment bug; needs confirmation that displayed city/coords match where rain was witnessed. |

## Narrowing Signals

- UI shows **non-zero but low** rainfall (14 mm / 0.3 mm), not “no data” — rules out incomplete 7-day window as the primary symptom on settings (which uses live API).
- **Same widget values on dashboard and settings** — last-rain line is always live Open-Meteo by coordinates; strongly suggests the fetch target (lat/lng) is consistent and returning low values, not a silent `region_id` swap.
- User has **not verified DB** `weather_records` for Warszawa/Ogony — cannot yet rule out cron gap for dashboard-only DB path.
- Region switch is **correlated in time** but not proven causal; user has not confirmed wrong city name displayed.

## Cross-System Convention

Prior change `fix-field-region` established: shared `regions` catalog deduped on exact lat/lng; `weather_records` filled by nightly cron; widget uses **live Open-Meteo for current conditions and last rain**, DB calendar sum for watering consistency on dashboard/field pages (`context/archive/2026-06-17-fix-field-region/change.md`). The architecture intentionally separates live display from cron-backed logic — a region-assignment bug would mainly affect DB-backed paths, not the last-rain line that both pages share via live API.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: verify whether rainfall is wrong because of **data source / coordinate accuracy** (Open-Meteo daily aggregates and geocoded pin vs observed local rain), not because **`region_id` is mis-assigned during city edit**.

The user’s numbers (14 mm / 0.3 mm yesterday) are consistent with Open-Meteo returning low daily totals for the stored coordinates on both dashboard and settings. Region assignment code paths appear coherent and tested; a wrong `region_id` would not cleanly explain the last-rain display on the settings page, which never reads `region_id` for that field. The original “nothing fell” impression likely means “far less than observed,” not literally zero.

If verification shows DB `weather_records` for the user’s `region_id` also show ~0.3 mm for yesterday while Open-Meteo at the same coords matches, the fix space is **data fidelity / UX expectations**, not region linking. If DB shows heavy rain but UI shows 14 mm, revisit hypothesis B (DB vs API selection on dashboard).

## Confidence

**MEDIUM** — strong code evidence against region-assignment as root cause for the reported widget numbers, but DB rows for Warszawa/Ogony and the user’s current `user_preferences.region_id` vs lat/lng have not been inspected in this session.

**Verification before /10x-plan:**

1. Query `user_preferences` for the user: confirm `region_id`, `city_name`, `latitude`, `longitude` are mutually consistent.
2. Query `weather_records` for both region IDs for yesterday’s date — compare to widget values.
3. Call Open-Meteo for the stored coordinates and confirm 0.3 mm / 14 mm totals match the widget.

## What Changes for /10x-plan

Do **not** plan a region-assignment fix as the default. Plan around **reproducing the rainfall mismatch with traced data** (prefs → region row → `weather_records` → live API → widget fields), then decide whether the gap is external data accuracy, geocoding precision, cron timing, or a genuine assignment bug — only the last warrants editing the preferences/region flow.

## References

- `src/pages/api/user-preferences.ts:68-93` — region find-or-create + prefs upsert + field propagation
- `src/lib/services/regions.ts:8-35` — coordinate dedup for shared regions
- `src/components/WeatherWidget.tsx:211,316-318` — DB-preferring 7-day vs live last-rain
- `src/pages/dashboard.astro:31-39,119-124` — DB rainfall for widget + watering
- `src/pages/dashboard/settings.astro:32` — settings widget without DB rainfall prop
- `src/lib/services/open-meteo.ts:89-105` — past-only daily precipitation aggregation
- `src/pages/api/cron/weather.ts:34-57` — nightly weather upsert per region
- `context/archive/2026-06-17-fix-field-region/change.md` — intended region/weather architecture
