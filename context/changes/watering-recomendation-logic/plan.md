# Watering Recommendation Logic Implementation Plan

## Overview

Ship a defensible MVP watering heuristic (3 plant-need tiers × 7-day cumulative rainfall mm from cron-backed `weather_records`) and surface recommendations on the **field list** and **per-planting on the field grid**. Pure evaluation logic stays source-agnostic and unit-tested; pages load rainfall once per request from the user's region.

## Current State Analysis

Frame brief and research established:

- Inputs exist: `plants.watering_needs`, field plantings, nightly cron → `weather_records`, live `WeatherWidget` showing `rainfall7dMm` via Open-Meteo.
- No evaluation service, no thresholds, no watering UI affordance.
- `getHarvestDate` in `src/lib/harvest.ts` is the planting→plant join precedent.
- DB helper `getRainfallLast7Days` uses rolling 168h — **differs** from Open-Meteo calendar 7d sum; must not use as-is for threshold comparison.

### Key Discoveries:

- Field detail loads plantings + plants SSR but `FieldGrid` only shows harvest (`src/components/fields/FieldGrid.tsx:67-74`).
- Dashboard field list shows name/size only (`src/pages/dashboard.astro:54-66`); no plantings loaded.
- Cron writes daily `rainfall_mm` per `region_id` (`src/pages/api/cron/weather.ts:37-51`).
- User prefs carry `region_id` used for field creation; widget uses lat/lng for live fetch.
- Frame confidence MEDIUM: threshold values are heuristic placeholders, not agronomy.

## Desired End State

1. **`src/lib/watering.ts`** — normalize `watering_needs`, evaluate per-planting status against `rainfall7dMm`, aggregate field status (worst-case among evaluable plantings).
2. **`src/lib/services/weather.ts`** — calendar-based 7-day rainfall sum from `weather_records` by `region_id` (aligned with cron daily rows).
3. **Dashboard** — each field row shows a compact watering badge when the field has plantings and rainfall data exists; empty fields show nothing.
4. **Field detail** — each planted cell shows per-planting watering badge (`ok` / `water_soon` / `water_now` / hidden for `unknown`).
5. **WeatherWidget** — continues showing **current** conditions from live Open-Meteo; **7-day mm row** uses the same DB sum as watering logic (passed in or fetched once by region).
6. **Polish copy** in `src/lib/copy/pl.ts` for all new status strings.
7. **Unit tests** in `src/test/lib/watering.test.ts` and `src/test/lib/weather-rainfall-calendar.test.ts`.

### Verification

- User with plantings and cron data sees field-list badge and per-cell badges consistent with thresholds.
- Tomato (high) at 15 mm / 7d → `water_soon`; at 5 mm → `water_now`.
- Manual planting (no `plant_id`) → per-cell `unknown` (omit badge; excluded from field aggregation).
- Field with mix: one high-need plant under threshold → field list shows worst status among evaluable cells.
- No `weather_records` rows, fewer than 7 distinct calendar dates in window, or stale cron data (>36h) → no watering badges anywhere (hide, not guess).
- `npm run lint` and `npm run build` pass; `npm run test` passes new unit tests.

## What We're NOT Doing

- FR-013 notification delivery (in-app toast/push infrastructure).
- Admin UI to edit thresholds or watering levels.
- Per-field coordinates / multi-location rainfall.
- Days-since-rain + temperature compound rules (v1 is mm-only per PRD Business Logic).
- Storing precomputed per-field watering status in DB (compute on read).
- Agronomic validation of threshold numbers (documented as tunable heuristic).

## Implementation Approach

**Logic first → DB rainfall helper → SSR data wiring → UI surfaces → widget alignment.**

Evaluation functions accept `rainfall7dMm: number` as input so tests never hit Supabase. Pages perform **one** rainfall query per request via `prefs.region_id`. Dashboard loads all user plantings in one query (`user_id` index exists) and groups by `field_id` for list badges.

### Heuristic (locked in planning)

| `watering_needs` (normalized) | Minimum 7d mm for `ok` |
| --- | --- |
| `low` | 10 |
| `medium` | 20 |
| `high` | 35 |

| Status | Rule |
| --- | --- |
| `ok` | `rainfall7dMm >= threshold[level]` |
| `water_soon` | `rainfall7dMm < threshold[level]` |
| `water_now` | `rainfall7dMm < threshold[level] * 0.5` |
| `unknown` | null/empty needs, unrecognized string, or no `plant_id` |

Field aggregation: worst status among evaluable plantings (`water_now` > `water_soon` > `ok`). `unknown` cells do not affect field-level status. Field with only `unknown` plantings → no field-list badge.

## Critical Implementation Details

**Calendar 7d sum from `weather_records`:** Sum `rainfall_mm` for rows whose `recorded_at` **date prefix** (`YYYY-MM-DD`) matches each of the last 7 **calendar dates strictly before today**. Derive "today" using the same Open-Meteo `timezone=auto` rule as cron: look up the region's `latitude`/`longitude`, compute today via `Intl.DateTimeFormat("sv-SE", { timeZone })` (mirror `getDailyWeather` in `open-meteo.ts`). Do **not** filter by UTC midnight on `recorded_at` — cron stores `${r.date}T00:00:00Z` where `r.date` is the Open-Meteo calendar label. Do not use rolling `Date.now() - 168h` for evaluation — that helper remains for legacy callers but watering must use the new calendar helper.

**Incomplete window:** Return `data: null` when fewer than 7 distinct calendar dates exist in the window (avoids false `water_now` on partial cron backfill). Still return `latestRecordedAt` for stale detection.

**Widget split:** Live `/api/weather` fetch keeps `temperatureC`, `weatherCode`, `lastRainDate` from Open-Meteo. Pass `rainfall7dMm` from SSR (DB sum) into `WeatherWidget` via new optional prop `rainfall7dMmFromDb?: number | null`; when present, display that value in the 7-day row instead of `weatherState.data.rainfall7dMm`. Show stale badge when DB data is older than 36h (use latest `recorded_at` in the 7d window). When `rainfallStale`, hide watering badges (same as null data).

## Phase 1: Watering Domain Logic

### Overview

Pure functions for normalization, per-planting evaluation, and field-level aggregation. No UI, no Supabase.

### Changes Required:

#### 1. Watering module

**File**: `src/lib/watering.ts`

**Intent**: Centralize MVP heuristic so UI and future FR-013 share one rule set.

**Contract**: Export `WateringLevel`, `WateringStatus` (`"ok" | "water_soon" | "water_now" | "unknown"`), `WATERING_THRESHOLDS_MM`, `normalizeWateringNeeds(needs: string | null): WateringLevel | null`, `evaluateWatering(needs: string | null, rainfall7dMm: number): WateringStatus`, `evaluatePlantingWatering(planting: PlantingRow, plants: PlantRow[], rainfall7dMm: number): WateringStatus`, `aggregateFieldWatering(statuses: WateringStatus[]): WateringStatus | null` (returns `null` when no evaluable statuses). Unknown strings and missing `plant_id` → `unknown`.

#### 2. Unit tests

**File**: `src/test/lib/watering.test.ts`

**Intent**: Lock heuristic behavior and edge cases.

**Contract**: Cover normalization (case/trim), each tier at boundary mm, `water_now` at 50% boundary, unknown/null needs, manual planting, field aggregation worst-case, all-unknown field → `null`, empty plantings → `null`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run test -- src/test/lib/watering.test.ts` passes

#### Manual Verification:

- N/A (pure logic phase)

**Implementation Note**: Pause for confirmation that tests pass before Phase 2.

---

## Phase 2: Calendar Rainfall from DB

### Overview

Add a region-scoped 7-day calendar rainfall sum from `weather_records` for evaluation and widget display.

### Changes Required:

#### 1. Rainfall helper

**File**: `src/lib/services/weather.ts`

**Intent**: Provide one DB-backed rainfall value aligned with cron daily rows and threshold semantics.

**Contract**: Export `getRainfall7dCalendarMm(client, regionId): Promise<{ data: number | null; error: unknown; latestRecordedAt: string | null; rainfallStale: boolean }>`. Join `regions` for lat/lng; derive "today" via Open-Meteo auto timezone (same as `getDailyWeather`). Sum `rainfall_mm` for rows whose `recorded_at` date prefix falls on each of the 7 calendar days strictly before today. Returns `null` data when no rows in window **or** fewer than 7 distinct calendar dates (caller hides watering UI). Set `rainfallStale = true` when `latestRecordedAt` is older than 36h. Document in JSDoc that this is the canonical input for watering logic. Extract pure `sumCalendarRainfall(rows, todayDate, timezone)` for unit tests.

#### 2. Unit tests

**File**: `src/test/lib/weather-rainfall-calendar.test.ts` (or extend `src/test/lib/` pattern)

**Intent**: Verify calendar window math with fixture dates.

**Contract**: Tests use mocked Supabase client or extracted pure `sumCalendarRainfall(rows, today, timezone)` if query logic is split for testability.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run test -- src/test/lib/watering.test.ts src/test/lib/weather-rainfall-calendar.test.ts` passes

#### Manual Verification:

- N/A

**Implementation Note**: Pause before Phase 3.

---

## Phase 3: SSR Data Wiring

### Overview

Load rainfall once and plantings for dashboard field-list evaluation; pass rainfall into field detail.

### Changes Required:

#### 1. Plantings by user

**File**: `src/lib/services/plantings.ts`

**Intent**: Support dashboard field-list aggregation without N+1 field queries.

**Contract**: Export `getPlantingsByUser(client, userId)` selecting all plantings for the user.

#### 2. Dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Compute per-field watering status for list badges.

**Contract**: When `prefs.region_id` exists, parallel-fetch `getRainfall7dCalendarMm`, `getPlantingsByUser`, `getPlants`. Group plantings by `field_id`. For each field with plantings, compute `aggregateFieldWatering` from per-planting statuses. Pass `rainfall7dMm` and `fieldWateringStatuses: Record<fieldId, WateringStatus>` to a small React island or inline badge in the list row. Pass `rainfall7dMmFromDb` and `rainfallStale` to `WeatherWidget`. When rainfall `data` is null or `rainfallStale`, omit all watering badges.

#### 3. Field detail page

**File**: `src/pages/dashboard/fields/[id].astro`

**Intent**: Supply rainfall and keep existing plantings/plants load.

**Contract**: Fetch `getRainfall7dCalendarMm` when `userPrefs.region_id` exists. Pass `rainfall7dMm` to `FieldGrid` only when `data` is non-null and not stale; pass `rainfall7dMmFromDb` and `rainfallStale` to `WeatherWidget`.

#### 4. FieldGrid props

**File**: `src/components/fields/FieldGrid.tsx`

**Intent**: Accept rainfall for per-cell evaluation.

**Contract**: Add optional `rainfall7dMm: number | null` prop. When null, no watering badges on cells.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Dashboard SSR does not call Open-Meteo for watering (network tab: no extra weather calls for list logic)
- Field detail receives rainfall prop when region is set

**Implementation Note**: Pause before Phase 4.

---

## Phase 4: Watering UI (Field List + Grid)

### Overview

Surface three-tier watering status with compact badges per DESIGN.md (`text-sm`, accent sparingly).

### Changes Required:

#### 1. Polish copy

**File**: `src/lib/copy/pl.ts`

**Intent**: User-visible strings for watering recommendations.

**Contract**: Add `pl.watering` keys: status labels for `ok`, `water_soon`, `water_now`, optional short list variants, `unknown` if shown. Examples: "Podlej dziś", "Podlej wkrótce", "Wystarczające opady". Keep commit-sized strings; follow Polish-first rules.

#### 2. Watering badge component

**File**: `src/components/fields/WateringBadge.tsx`

**Intent**: Reusable status chip for list and grid.

**Contract**: Props: `status: WateringStatus`, `variant?: "compact" | "default"`. Map status to `Badge` variant/colors per DESIGN.md (terracotta accent for `water_now`, muted for `ok`). Do not render for `unknown` unless explicitly passed.

#### 3. Field list badges

**File**: `src/pages/dashboard.astro` and/or `src/components/dashboard/FieldListItem.tsx` (new small React island if needed)

**Intent**: Show worst-case field status on each row.

**Contract**: Badge appears only when field has ≥1 planting and aggregated status is not `null`. Empty fields: no badge.

#### 4. Field grid per-cell badges

**File**: `src/components/fields/FieldGrid.tsx`

**Intent**: Show per-planting recommendation near harvest line.

**Contract**: When `rainfall7dMm` is set, render `WateringBadge` for evaluable statuses; `unknown` (manual planting, missing needs) → omit badge.

#### 5. DESIGN.md touch-up (minimal)

**File**: `context/foundation/DESIGN.md`

**Intent**: Document watering badge placement on field grid and list rows.

**Contract**: Short subsection under field grid / dashboard: badge sizes, status colors, hide-when-no-data rule.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Field list shows badge only on fields with plantings
- Grid cells show per-plant status; manual planting has no watering badge
- Copy is Polish throughout

**Implementation Note**: Pause before Phase 5.

---

## Phase 5: WeatherWidget 7d mm Alignment

### Overview

Display DB-backed 7-day mm in the widget while keeping live current conditions.

### Changes Required:

#### 1. WeatherWidget props

**File**: `src/components/WeatherWidget.tsx`

**Intent**: Show cron-sourced 7d mm consistent with watering logic.

**Contract**: Add optional `rainfall7dMmFromDb?: number | null` and `rainfallStale?: boolean`. In the 7-day rainfall row, prefer `rainfall7dMmFromDb` when `!== null`; else fall back to live `weatherState.data.rainfall7dMm`. **Settings page** (`src/pages/dashboard/settings.astro`) keeps live 7d mm fallback only — no SSR rainfall props. Show stale badge when `rainfallStale` or existing stale logic applies.

#### 2. Stale detection

**File**: `src/lib/services/weather.ts` (returned from `getRainfall7dCalendarMm`)

**Intent**: Flag outdated cron data; pages use `rainfallStale` to hide watering badges.

**Contract**: `rainfallStale = true` when `latestRecordedAt` is older than 36 hours from now. Dashboard and field detail omit watering badges when stale (consistent with null data).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npm run test` passes (full suite)

#### Manual Verification:

- Widget 7d mm matches value used for watering badges on same page
- Current temp/condition still updates from live API
- Stale badge appears when cron data is old

---

## Testing Strategy

### Unit Tests:

- `watering.test.ts` — all status tiers, normalization, aggregation, edge cases
- `weather-rainfall-calendar.test.ts` — calendar window summation

### Integration Tests:

- Optional: dashboard SSR smoke via existing API test patterns if lightweight; not required for MVP if unit coverage is strong

### Manual Testing Steps:

1. User with region, cron data, tomato planted — verify `water_soon` / `water_now` at test mm values
2. Field with two plants (low ok, high needs water) — list shows worst case
3. Empty field — no list badge
4. Manual planting cell — no watering badge; field list ignores it
5. New user / empty or partial `weather_records` (<7 days) — no badges; widget falls back or hides 7d row gracefully
6. Stale cron data (>36h) — widget shows stale badge; watering badges hidden
7. Mobile layout: badges readable on field grid cells

## Performance Considerations

- One `getRainfall7dCalendarMm` query per page load (dashboard and field detail).
- One `getPlantingsByUser` on dashboard (indexed `user_id`).
- No per-cell or per-field Open-Meteo calls for watering.
- Evaluation is in-memory O(cells) on already-loaded data.

## Migration Notes

No schema migration. Existing cron job populates `weather_records`; watering badges appear once cron has written **7 distinct calendar days** for the user's region (typically ~7 days after first successful run). Document in plan-brief that new users may see no badges during the warm-up window.

## References

- Frame brief: `context/changes/watering-recomendation-logic/frame.md`
- Research: `context/changes/watering-recomendation-logic/research.md`
- PRD Business Logic: `context/foundation/prd.md:125-129`
- Harvest join pattern: `src/lib/harvest.ts:3-9`
- Cron weather: `src/pages/api/cron/weather.ts`
- DESIGN.md badges: `context/foundation/DESIGN.md:58,168`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Watering Domain Logic

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run test -- src/test/lib/watering.test.ts` passes

#### Manual

- [x] 1.3 Confirm heuristic table matches plan before Phase 2

### Phase 2: Calendar Rainfall from DB

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 Calendar rainfall unit tests pass

#### Manual

- [x] 2.3 Confirm helper returns null when no rows or <7 distinct dates (hide behavior)

### Phase 3: SSR Data Wiring

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `npm run build` passes

#### Manual

- [x] 3.3 Dashboard loads plantings + rainfall without per-field API calls
- [x] 3.4 Field detail passes `rainfall7dMm` to FieldGrid

### Phase 4: Watering UI (Field List + Grid)

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm run build` passes

#### Manual

- [ ] 4.3 Field list badges on planted fields only
- [ ] 4.4 Grid per-cell badges; manual planting omitted
- [ ] 4.5 Polish copy complete

### Phase 5: WeatherWidget 7d mm Alignment

#### Automated

- [x] 5.1 `npm run lint` passes
- [x] 5.2 `npm run build` passes
- [x] 5.3 Full `npm run test` passes

#### Manual

- [ ] 5.4 Widget 7d mm matches watering logic on same page
- [ ] 5.5 Live temp/condition still works
- [ ] 5.6 Stale badge when cron data old
