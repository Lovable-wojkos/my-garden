# Frame Brief: UI Data Display Fixes

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Three issues visible in the UI:
1. Temperature showed -4.3°C when the actual temperature was ~23°C (Warsaw)
2. Last rain display shows only a date, no rainfall volume
3. Location stored at voivodeship level — user wanted town-level selection

## Initial Framing (preserved)

- **User's stated cause or approach**: These are UI display bugs / missing data — things visible in the UI that are wrong or incomplete.
- **User's proposed direction**: Fix each issue as a group of UI data display corrections under one change.
- **Pre-dispatch narrowing**: All three issues are equally important. Temperature appears on the current weather widget. Location issue: "skip, this is working — wrong initial location passed, also display of wrong temperature disappeared."

## Dimension Map

The observations could originate at any of these dimensions:

1. **Wrong data stored** — bad coordinates in `user_preferences` cause the weather API to return data for the wrong location
2. **Data fetched but not passed through** — the API returns rainfall volume but the processing layer drops it before it reaches the UI ← **rain volume issue**
3. **Data not in the type** — `WeatherData` interface missing a field, so there's nowhere to carry the value even if fetched
4. **UI rendering gap** — the component receives data but doesn't render a particular field
5. **Location granularity — UI missing feature** — no city-level picker exists

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Wrong stored coordinates caused wrong temperature | `dashboard.astro:13,16` passes `user_preferences` lat/lng directly to `WeatherWidget`. User confirmed wrong temp disappeared after location corrected. No code defect — data defect. | STRONG (resolved) |
| `open-meteo.ts` drops rainfall volume when capturing last rain date | `open-meteo.ts:89-98`: loop finds first date with `rMm > 0`, stores only `lastRainDate` string. `precipitation_sum` array value at that index is discarded. | STRONG |
| `WeatherData` type has no volume field | `open-meteo.ts:42-47`: `WeatherData` interface contains `lastRainDate: string \| null` and `rainfall7dMm` but no per-event volume field. | STRONG |
| UI renders date-only because no volume field available | `WeatherWidget.tsx:228-233`: renders `lastRainDate` formatted as locale date string. No volume to render — type doesn't carry it. | STRONG |
| Historical `weather_records` table already stores `rainfall_mm` | `src/lib/services/weather.ts:30-39`: `getLastRainDate()` returns `{ recorded_at, rainfall_mm }` from Supabase — not wired to the widget. | STRONG (unused path) |
| Location granularity (voivodeship vs town) is a missing feature | User confirmed: "skip, this is working." | NONE (resolved/out of scope) |

## Narrowing Signals

- Temperature issue: user confirmed it disappeared once location was corrected → **not a code bug, was a data bug in stored preferences**.
- Location granularity: user confirmed out of scope for this change.
- Rain volume: the Open-Meteo API already returns `daily.precipitation_sum[]`; the processing loop at `open-meteo.ts:89-98` already iterates over it but reads only the index, not the value.
- There is a parallel unused code path: `weather.ts:getLastRainDate()` returns both date and volume from historical records — a potential alternative or complement to the live API approach.

## Cross-System Convention

The app fetches live weather from Open-Meteo and also maintains a historical `weather_records` table populated by a cron job (`src/pages/api/cron/weather.ts`). The `WeatherWidget` currently uses only the live path. The historical path already models the `lastRain` concept with volume (`rainfall_mm`) but is not consumed by the UI. Both paths are consistent with the pattern: extend the live path's data model to carry volume, and update the UI.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the `WeatherData` type and the processing logic in `open-meteo.ts` capture only the date of the last rain event, discarding the precipitation volume that the Open-Meteo API already returns — so the `WeatherWidget` has no volume to display.

The temperature issue was a one-time data defect (wrong stored coordinates) and is already resolved. The location granularity item is out of scope. The single remaining code problem is the missing `lastRainMm` field through the entire chain: `open-meteo.ts` processing → `WeatherData` type → `WeatherWidget` render.

## Confidence

- **HIGH** — strong evidence at every layer (processing, type, UI) + matches the live API data model + decisive user narrowing signal ruling out two of three original observations.

## What Changes for /10x-plan

The plan should address one fix only: extend the last-rain data chain to carry volume. This means: capture the `precipitation_sum` value alongside the date in `open-meteo.ts:89-98`, add `lastRainMm: number | null` to the `WeatherData` interface, and update `WeatherWidget.tsx:228-233` to display it. The unused `weather.ts:getLastRainDate()` path may be noted but is a separate decision.

## References

- Processing logic: [`src/lib/services/open-meteo.ts:89-98`](src/lib/services/open-meteo.ts)
- Type definition: [`src/lib/services/open-meteo.ts:42-47`](src/lib/services/open-meteo.ts)
- UI rendering: [`src/components/WeatherWidget.tsx:228-233`](src/components/WeatherWidget.tsx)
- Dashboard page (passes prefs): [`src/pages/dashboard.astro:13,16`](src/pages/dashboard.astro)
- Unused historical path: [`src/lib/services/weather.ts:30-39`](src/lib/services/weather.ts)
