# UI Data Display Fixes — Implementation Plan

## Overview

Extend the last-rain data chain so the rainfall volume captured by the Open-Meteo API is carried through to the UI. Currently `open-meteo.ts` finds the most recent rain date but discards the precipitation value at that index; `WeatherWidget` therefore has no volume to display.

## Current State Analysis

- `open-meteo.ts:42-47` — `WeatherData` interface holds `lastRainDate: string | null` and `rainfall7dMm` but no per-event volume field.
- `open-meteo.ts:89-98` — processing loop finds the last rain date, reads `rMm` for the `> 0` guard, then drops it.
- `WeatherWidget.tsx:228-233` — renders `lastRainDate` as a locale date string with no volume.
- The Open-Meteo API already returns `daily.precipitation_sum[]` — the value is available at the exact index where `lastRainDate` is set.

### Key Discoveries:

- `open-meteo.ts:94`: `rMm` is already read from `precip[i]` — only needs to be stored alongside the date.
- `WeatherWidget.tsx:225`: `rainfall7dMm` is displayed as `{value} mm` — same pattern to follow for inline volume.
- `rMm > 0` guard on line 94 ensures `lastRainMm` will always be a positive number when set; it will never be `0` when `lastRainDate` is set.

## Desired End State

The "Ostatni deszcz" row in `WeatherWidget` shows both the date and the volume of that rain event inline — e.g. `3 cze · 12.4 mm`. When no rain event was found in the 7-day window, the row continues to show "Brak danych".

### Verification:

Load the dashboard with a location that had rain in the past 7 days and confirm the row shows a date and a mm value. Load with a dry location and confirm "Brak danych" is shown.

## What We're NOT Doing

- Changing the historical `weather.ts:getLastRainDate()` path — unused by the widget, separate decision.
- Adding a city-level location picker — explicitly out of scope per frame brief.
- Fixing the temperature display — resolved as a data defect (wrong stored coordinates), not a code bug.

## Implementation Approach

Three-file change following the data chain from source to render: capture the value in the processor, add the field to the type, display it in the widget.

## Phase 1: Extend Type and Processing Logic

### Overview

Add `lastRainMm: number | null` to `WeatherData` and capture the precipitation value when the last rain date is set.

### Changes Required:

#### 1. WeatherData interface

**File**: `src/lib/services/open-meteo.ts`

**Intent**: Add `lastRainMm: number | null` to `WeatherData` so the volume can be carried from the processing function to all consumers.

**Contract**: New field `lastRainMm: number | null` added to the `WeatherData` interface at `open-meteo.ts:42-47`.

#### 2. Processing loop — capture volume

**File**: `src/lib/services/open-meteo.ts`

**Intent**: When the last rain date is set inside the loop (`open-meteo.ts:94-96`), also capture `rMm` as `lastRainMm` so the value is not discarded.

**Contract**: A companion variable `let lastRainMm: number | null = null` is declared alongside `lastRainDate`. Inside the `if (rMm > 0 && !lastRainDate)` block, set `lastRainMm = rMm`.

#### 3. Return value

**File**: `src/lib/services/open-meteo.ts`

**Intent**: Include `lastRainMm` in the object returned by `getWeather()`.

**Contract**: Add `lastRainMm: lastRainMm != null ? Number(lastRainMm.toFixed(1)) : null` to the return statement at `open-meteo.ts:100-105`, matching the rounding pattern used for `rainfall7dMm`.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- No type errors in the IDE for `WeatherData` consumers.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Update WeatherWidget Render

### Overview

Update the "Ostatni deszcz" row to display date and volume inline: `{date} · {value} mm`.

### Changes Required:

#### 1. Last rain row render

**File**: `src/components/WeatherWidget.tsx`

**Intent**: Update `WeatherWidget.tsx:228-233` to show the precipitation volume alongside the date. When `lastRainDate` is set, display `{localeDateString} · {lastRainMm} mm`. The "Brak danych" fallback is unchanged.

**Contract**: The `span` at line 230-232 renders `weatherState.data.lastRainDate` formatted as a date. Extend the truthy branch to also read `weatherState.data.lastRainMm` and append ` · {lastRainMm} mm` inline. When `lastRainDate` is set, `lastRainMm` will always be a positive number (guaranteed by the `rMm > 0` guard in Phase 1), so no separate null guard for the volume is needed.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Dashboard shows `{date} · {volume} mm` in the "Ostatni deszcz" row for a location with rain in the last 7 days.
- Dashboard shows "Brak danych" for a location with no rain in the last 7 days.
- No regressions in the temperature or 7-day rainfall rows.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:

1. Open dashboard with Warsaw (or any city with recent rain) — confirm "Ostatni deszcz" row shows e.g. `5 cze · 3.2 mm`.
2. Open dashboard with a dry location or adjust to a date range with no rain — confirm "Brak danych" is shown.
3. Verify temperature and "Opady (7 dni)" rows are unchanged.

## References

- Frame brief: `context/changes/ui-data-display-fixes/frame.md`
- Processing logic: `src/lib/services/open-meteo.ts:89-98`
- Type definition: `src/lib/services/open-meteo.ts:42-47`
- UI rendering: `src/components/WeatherWidget.tsx:228-233`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extend Type and Processing Logic

#### Automated

- [x] 1.1 TypeScript compilation passes: `npm run build`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [ ] 1.3 No type errors in the IDE for `WeatherData` consumers

### Phase 2: Update WeatherWidget Render

#### Automated

- [ ] 2.1 TypeScript compilation passes: `npm run build`
- [ ] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 "Ostatni deszcz" shows `{date} · {volume} mm` for location with recent rain
- [ ] 2.4 "Ostatni deszcz" shows "Brak danych" for dry location
- [ ] 2.5 No regressions in temperature or 7-day rainfall rows
