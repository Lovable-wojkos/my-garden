---
date: 2026-06-08T14:56:44+02:00
researcher: Copilot (Claude Sonnet 4.6)
git_commit: 14a80df
branch: agents/field-weather-view-10x-research
repository: Lovable-wojkos/my-garden
topic: "Field weather view — full pre-plan audit (S-04)"
tags: [research, codebase, field-weather-view, weather, plantings, s04, s01, s02, s03, f02]
status: complete
last_updated: 2026-06-08T20:51:48+02:00
last_updated_by: Copilot (Claude Sonnet 4.6)
---

# Research: Field Weather View — Full Pre-Plan Audit (S-04)

**Date**: 2026-06-08T14:56:44+02:00  
**Updated**: 2026-06-08T20:51:48+02:00 — post S-03 implementation + roadmap cleanup  
**Researcher**: Copilot (Claude Sonnet 4.6)  
**Git Commit**: e365739  
**Branch**: agents/field-weather-view-10x-research  
**Repository**: Lovable-wojkos/my-garden

## Research Question

Full pre-plan audit for `field-weather-view` (S-04): all upstream contracts (S-01, S-02/S-03, F-02), data models, API shapes, component patterns, and gaps. Goal: understand what exists, what is missing, and what S-04 needs to build.

## Summary

S-04 is the final MVP slice — it combines the field grid view with planted crop details and a live weather panel. **All three prerequisites are now done.**

| Prerequisite | Change ID | Status | Notes |
|---|---|---|---|
| Open-Meteo weather probe | `imgw-weather-probe` (S-01) | **done** (archived) | `WeatherWidget.tsx` fully built; city search, temp/rainfall/last-rain, 30-min refresh, saves user preferences |
| Field creation | `field-creation` (S-02) | **done** (archived) | Field detail page now has FieldGrid React island |
| Planting record | `planting-record` (S-03) | **done** (archived) | `FieldGrid.tsx` + `PlantingDialog.tsx` + API routes + harvest calc fully implemented |
| Nightly weather job | `nightly-weather-job-scaffold` (F-02) | **done** (archived) | Cron route + weather_records table fully wired |

**All blockers cleared.** S-04 can now be planned immediately.

**Remaining gap**: The field detail page (`src/pages/dashboard/fields/[id].astro`) already shows the FieldGrid with planting data, but has **no weather panel**. S-04's sole remaining work is adding a weather panel to this page.

**Coordinate strategy resolved (Option 1)**: Use `user_preferences.latitude/longitude` for the weather panel. This is consistent with how `WeatherWidget` already works on the dashboard, requires no schema changes, and is the correct MVP approach given the "single location per user" scope.

---

## Detailed Findings

### Upstream: S-01 (Open-Meteo Weather Probe) — `src/lib/services/`

**Status**: **done** (archived 2026-06-08 → `context/archive/2026-05-26-imgw-weather-probe/`)

#### Open-Meteo HTTP service — `src/lib/services/open-meteo.ts`

```typescript
export interface GeocodingResult {
  name: string;
  displayName: string;   // e.g. "Kraków, powiat krakowski, Małopolskie, Polska"
  latitude: number;
  longitude: number;
  country_code: string;
}

export interface WeatherData {
  temperatureC: number;         // current temperature
  rainfall7dMm: number;         // sum of daily precip for last 7 days (past-only)
  lastRainDate: string | null;  // ISO date of most recent day with precip > 0
  fetchedAt: string;            // ISO timestamp
}

export interface DailyWeatherRecord {
  date: string;
  temperatureC: number | null;
  rainfallMm: number | null;
}

export async function geocodeCity(city: string): Promise<GeocodingResult[]>
export async function getWeather(lat: number, lng: number): Promise<WeatherData>
export async function getWeatherForCity(city: string): Promise<WeatherData>
export async function getDailyWeather(lat: number, lng: number): Promise<DailyWeatherRecord[]>
```

- Open-Meteo endpoints: no API key required
  - Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=5&language=pl`
  - Forecast: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,precipitation&daily=precipitation_sum&past_days=7&timezone=auto`
- `rainfall7dMm` only counts past days (not today or forecasted days)

#### Weather API route — `src/pages/api/weather.ts`

- `GET /api/weather?lat=&lng=` → `WeatherData` JSON
- Returns `400` if lat/lng missing or non-numeric
- Returns `401` if unauthenticated; `502` on Open-Meteo failure; `503` on Supabase down
- Calls `getWeather(lat, lng)` directly (live, no cache)

#### DB weather wrappers — `src/lib/services/weather.ts`

Reads from `weather_records` table (populated by F-02 cron):

```typescript
getLatestWeather(client, regionId)              // by region_id
getRainfallLast7Days(client, regionId)          // sums rainfall_mm, last 7 days
getLastRainDate(client, regionId)               // most recent recorded_at
getRainfallLast7DaysByCoords(client, lat, lng)  // by coordinates
getLastRainDateByCoords(client, lat, lng)       // by coordinates
```

#### User preferences — `src/lib/services/user-preferences.ts`

```typescript
export interface UserPreferencesRow {
  user_id: string;
  city_name: string;    // Display name (e.g. "Kraków, Małopolskie")
  latitude: number;     // numeric(9,6)
  longitude: number;    // numeric(9,6)
  updated_at: string;
}

getUserPreferences(client, userId)   // reads from user_preferences
upsertUserPreferences(client, prefs) // upserts on user_id
```

#### WeatherWidget React component — `src/components/WeatherWidget.tsx`

S-01 Phase 4 is **complete**. The `WeatherWidget` component exists and provides:

- City search input with debounced geocoding suggestions (via `/api/geocoding-suggestions`)
- Displays current temperature, 7-day rainfall (mm), and last-rain date
- 30-minute auto-refresh interval with visibility hygiene (pauses when tab hidden)
- Stale badge when fetch fails but cached data is available
- Saves selected city to `user_preferences` via `POST /api/user-preferences`
- Accepts `initialCity?: { cityName, latitude, longitude }` prop for SSR hydration

Props interface:
```typescript
interface WeatherWidgetProps {
  initialCity?: { cityName: string; latitude: number; longitude: number } | null;
}
```

S-04 can reuse `WeatherWidget` directly on the field detail page by passing the user's stored coordinates as `initialCity`.

---

### Upstream: S-02 (Field Creation) — Complete

**Status**: **done** (archived 2026-06-08 → `context/archive/2026-06-01-field-creation/`)

#### Field data shape — `src/types.ts` (lines 72-81)

```typescript
export interface FieldRow {
  id: string;
  user_id: string;
  name: string;
  cols: number;       // 1-20
  rows: number;       // 1-20
  region_id: string;  // FK → regions(id)
  created_at: string;
  updated_at: string;
}
```

#### Field service — `src/lib/services/fields.ts`

```typescript
getFieldsByUser(client, userId)         // all fields for user
getFieldById(client, fieldId)           // single field
createField(client, insert)             // requires name, cols, rows, region_id, user_id
updateField(client, id, update)
deleteField(client, id)
```

#### Region data — `src/types.ts` (lines 9-14) + `src/lib/services/regions.ts`

```typescript
export interface RegionRow {
  id: string;
  code: string;   // e.g. "MA" (Małopolskie), 16 Polish voivodeships seeded
  name: string;
  created_at: string;
}
```

⚠️ **Regions do NOT store coordinates.** They are voivodeship-level codes only. The weather layer uses `user_preferences.latitude/longitude` — not region codes.

#### Current field detail page — `src/pages/dashboard/fields/[id].astro`

**Fully wired with FieldGrid** (updated as part of S-03). Fetches field, plantings, and plants in parallel; renders `<FieldGrid client:load>` island. Grid cells show plant name, seeding date, and harvest date; clicking a cell opens `PlantingDialog` for create/edit/delete. **No weather panel yet** — this is the sole remaining gap for S-04.

---

### Upstream: S-03 (Planting Record) — Done

**Status**: **done** (archived 2026-06-08 → `context/archive/2026-06-01-planting-record/`)

#### What was implemented

**API routes:**
- `POST /api/plantings` — creates a planting (validates `field_id`, `cell_row`, `cell_col`, `seeding_date`; ownership enforced via `user_id`)
- `GET /api/plantings?field_id=` — lists plantings for a field (ownership enforced)
- `PATCH /api/plantings/[id]` — updates a planting (strips ownership/structural fields)
- `DELETE /api/plantings/[id]` — deletes a planting (ownership enforced)

**React components:**
- `src/components/fields/FieldGrid.tsx` — renders `rows×cols` grid; each cell is a button; planted cells show plant name, seeding date, and harvest date; empty cells show "Empty"; clicking any cell opens PlantingDialog
- `src/components/fields/PlantingDialog.tsx` — Dialog for create/edit/delete; catalog combobox + free-text entry; seeding date picker; notes textarea; live harvest date preview; two-step delete confirmation

**Library:**
- `src/lib/harvest.ts` — `getHarvestDate(planting, plants)` — adds `plant.growth_days` to `seeding_date`; returns `"–"` for free-text (no catalog match)

**Tests:**
- `src/test/api/plantings-index.test.ts`, `src/test/api/plantings-id.test.ts`, `src/test/components/FieldGrid.test.tsx`, `src/test/lib/harvest.test.ts`

#### Planting data shape — `src/types.ts`

```typescript
export interface PlantingRow {
  id: string;
  field_id: string;
  user_id: string;
  plant_id: string | null;    // optional catalog reference
  plant_name: string | null;  // optional free-text name
  cell_row: number;           // 0-indexed
  cell_col: number;           // 0-indexed
  seeding_date: string;       // ISO date
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

- DB constraint: `UNIQUE (field_id, cell_row, cell_col)` — one planting per cell
- `CASCADE` delete on `field_id` and `user_id`

#### Planting service — `src/lib/services/plantings.ts`

```typescript
getPlantingsByField(client, fieldId)    // list all plantings for a field
getPlantingById(client, id)             // single planting by id
createPlanting(client, insert)          // requires field_id, user_id, cell_row, cell_col, seeding_date
updatePlanting(client, id, update)      // strips user_id/field_id from update
deletePlanting(client, id)
```

---

### Upstream: F-02 (Nightly Weather Job) — Done

**Status**: archived as done

#### Weather records schema — `supabase/migrations/`

Final `weather_records` table after all migrations:

```sql
CREATE TABLE weather_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     uuid REFERENCES regions(id),  -- nullable since migration 4
  latitude      numeric(9,6),                 -- added migration 20260601
  longitude     numeric(9,6),                 -- added migration 20260601
  recorded_at   timestamptz NOT NULL,
  temperature_c numeric(5,2),
  rainfall_mm   numeric(6,2),
  created_at    timestamptz DEFAULT now()
);
-- Indexes:
-- UNIQUE idx_weather_records_region_recorded ON (region_id, recorded_at DESC)
-- UNIQUE idx_weather_records_coord_recorded ON (latitude, longitude, recorded_at)
--   WHERE latitude IS NOT NULL AND longitude IS NOT NULL
```

**RLS**: SELECT open to authenticated users; INSERT/UPDATE via service role only.

#### Cron job — `src/pages/api/cron/weather.ts`

- Runs nightly at midnight UTC (`vercel.json`: `"schedule": "0 0 * * *"`)
- Queries `user_preferences` for all distinct `(latitude, longitude)` pairs
- Fetches `getDailyWeather(lat, lng)` from Open-Meteo (7-day backfill per coordinate)
- Upserts to `weather_records` on conflict `(latitude, longitude, recorded_at)`
- Auth: validates `x-vercel-cron` header
- Response: `{ fetched, failed, locations, backfilled }`

#### Query patterns for S-04

```sql
-- Latest weather for user's coordinates
SELECT * FROM weather_records
WHERE latitude = $1 AND longitude = $2
ORDER BY recorded_at DESC LIMIT 1;

-- 7-day rainfall sum
SELECT SUM(rainfall_mm) FROM weather_records
WHERE latitude = $1 AND longitude = $2
  AND recorded_at >= NOW() - INTERVAL '7 days';

-- Last rain date
SELECT recorded_at FROM weather_records
WHERE latitude = $1 AND longitude = $2
  AND rainfall_mm > 0
ORDER BY recorded_at DESC LIMIT 1;
```

---

### UI Component Patterns

#### Page layout conventions

All pages use `<Layout title="...">` from `src/layouts/Layout.astro`. The glassmorphic container pattern used consistently:

```html
<div class="min-h-screen bg-cosmic p-8">
  <div class="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl p-6">
    <!-- content -->
  </div>
</div>
```

Gradient heading text:
```html
<h1 class="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
```

#### React island pattern

Server data is passed as props to React islands via `client:load`:

```astro
---
const regions = await getRegions(supabase);
---
<CreateFieldForm client:load regions={regions} />
```

No `"use client"` directives — this is Astro, not Next.js.

#### React form state pattern — `src/components/fields/CreateFieldForm.tsx`

- `useState` for each form field
- `fetch` POST to API route on submit
- `window.location.href` redirect on success
- Error object keyed by field name for inline validation display
- Combobox via `Popover` + `Command` composition (shadcn/ui)

#### Available shadcn/ui components

| Component | File | Used in |
|---|---|---|
| `Button` | `src/components/ui/button.tsx` | All interactive elements |
| `Input` | `src/components/ui/input.tsx` | CreateFieldForm, PlantingDialog, WeatherWidget |
| `Label` | `src/components/ui/label.tsx` | CreateFieldForm, PlantingDialog |
| `Popover` | `src/components/ui/popover.tsx` | Region combobox, plant catalog combobox |
| `Command` | `src/components/ui/command.tsx` | Region combobox, plant catalog combobox |
| `Dialog` | `src/components/ui/dialog.tsx` | PlantingDialog |
| `Badge` | `src/components/ui/badge.tsx` | WeatherWidget stale indicator |
| `Card` / `CardContent` / `CardHeader` / `CardTitle` | `src/components/ui/card.tsx` | WeatherWidget |

**Not yet installed**: Table, Skeleton, Progress — potentially useful for S-04 loading states but not required.

#### Known issues from `field-creation` impl review

- `F1`: Combobox trigger missing `type="button"` — can accidentally submit form (pattern to avoid)
- `F2`: Raw Supabase errors leaked to browser in API route — use generic error messages
- `F3`: Backend failures silently swallowed in Astro pages — handle errors explicitly
- `F6`: `"use client"` in `popover.tsx` and `command.tsx` — harmless but inconsistent; don't add more

---

## Architecture Insights

### The weather-to-field coordinate gap — **resolved for MVP**

Fields have `region_id` (FK to voivodeship). Weather data in `weather_records` is keyed by `(latitude, longitude)` from `user_preferences`. These two are not directly linked.

**Decision for S-04 MVP: Option 1 — use `user_preferences` coordinates.**

Rationale:
- `WeatherWidget.tsx` already uses `user_preferences` lat/lng. The field detail page weather panel is a read-only display of the same data — no new coordinate logic needed.
- The roadmap explicitly parks "Multiple garden locations per user" as out of MVP scope (single location per user for MVP). Option 1 is architecturally consistent with this.
- Zero schema changes required. The `getUserPreferences(client, userId)` service call is all that's needed.
- Options 2 (add lat/lng to fields) and 3 (hardcode region centroids) remain valid future enhancements but add scope with no MVP benefit.

**Server-side pattern for `[id].astro`:**
```astro
const [{ data: field }, { data: plantings }, { data: plants }, { data: userPrefs }] = await Promise.all([
  getFieldById(supabase, id),
  getPlantingsByField(supabase, id),
  getPlants(supabase),
  getUserPreferences(supabase, user.id),
]);
```

Pass `userPrefs` to the weather panel component as `initialCity`.

### Weather data source: live call via WeatherWidget

**Decision for S-04 MVP: reuse `WeatherWidget` with `initialCity` prop (live call strategy).**

The `WeatherWidget` component already handles the full lifecycle: initial SSR-seeded render via `initialCity`, live fetch on mount, 30-min refresh, stale indicator. S-04 simply needs to pass `initialCity` from the server-loaded `userPrefs`.

No new weather API routes or stored-record queries are needed for S-04.

### S-04 scope is now minimal

With S-01, S-02, S-03 all done, S-04 is a **composition task**, not a build task:

1. Fetch `userPrefs` server-side in `[id].astro` (one new `await`)
2. Add a two-column layout to the field detail page (grid + weather side panel)
3. Embed `<WeatherWidget client:load initialCity={...} />` in the side panel
4. Handle `userPrefs === null` gracefully (prompt user to set city on dashboard)

No new components, no new API routes, no schema changes are required.

---

## Code References

- `src/lib/services/open-meteo.ts` — Open-Meteo HTTP client (geocoding + weather + daily records)
- `src/lib/services/weather.ts` — Supabase `weather_records` read wrappers (by region or coords)
- `src/lib/services/user-preferences.ts` — User city preference (lat/lng storage) — **key for S-04 server-side fetch**
- `src/lib/services/fields.ts` — Field CRUD (`getFieldById`, `getFieldsByUser`)
- `src/lib/services/plantings.ts` — Planting CRUD (`getPlantingsByField`, `getPlantingById`, `createPlanting`, `updatePlanting`, `deletePlanting`)
- `src/lib/services/plants.ts` — Plant catalog reads
- `src/lib/services/regions.ts` — Region reads (voivodeships, no coords)
- `src/lib/harvest.ts` — `getHarvestDate(planting, plants)` — harvest date calculation
- `src/pages/api/weather.ts` — `GET /api/weather?lat=&lng=` → `WeatherData`
- `src/pages/api/cron/weather.ts` — Vercel Cron nightly weather fetch
- `src/pages/api/fields/index.ts` — `POST /api/fields` (field creation)
- `src/pages/api/plantings/index.ts` — `GET /api/plantings?field_id=` + `POST /api/plantings`
- `src/pages/api/plantings/[id].ts` — `PATCH /api/plantings/[id]` + `DELETE /api/plantings/[id]`
- `src/pages/dashboard/fields/[id].astro` — **S-04 target page** — already has FieldGrid; needs weather panel added
- `src/components/WeatherWidget.tsx` — **ready to embed** — accepts `initialCity` prop; handles live fetch, 30-min refresh, stale badge
- `src/components/fields/FieldGrid.tsx` — Interactive grid (already on field detail page)
- `src/components/fields/PlantingDialog.tsx` — Cell create/edit/delete dialog
- `src/types.ts` — All domain types (FieldRow, PlantingRow, PlantRow, WeatherRecordRow, UserPreferencesRow, RegionRow)
- `supabase/migrations/20260525000000_initial_schema.sql` — Core schema
- `supabase/migrations/20260601000000_add_coords_to_weather_records.sql` — Lat/lng on weather_records
- `vercel.json` — Cron schedule (`0 0 * * *`)

---

## Open Questions

1. **Layout on field detail page**: Should the weather panel be a sidebar (grid left, weather right), or stacked below the grid? Sidebar works well for wider screens; stacked is safer for mobile. The field grid can be very wide for large fields (e.g. 20 cols).

2. **No user_preferences set**: If `getUserPreferences` returns `null` (user has never set a city), what should the weather panel show? Options: (a) prompt to set location on the dashboard, (b) show the full interactive WeatherWidget with empty city input (allowing them to set it inline), (c) hide the weather panel entirely. Option (b) is lowest friction and most consistent — WeatherWidget already handles this state gracefully.

3. **Offline behavior**: Roadmap notes "should the weather panel show cached data when offline?" — parked as MVP can show "no connection" state. WeatherWidget already handles this with the stale badge and error display.

~~4. **Weather-to-field coordinate strategy**: Resolved — use `user_preferences` lat/lng (Option 1).~~

~~5. **S-03 dependency scope for S-04**: Resolved — S-03 is done; no phasing needed.~~

~~6. **WeatherWidget reuse**: Resolved — `WeatherWidget.tsx` exists and can be embedded directly.~~

~~7. **Live vs stored weather for panel**: Resolved — reuse WeatherWidget (live call with 30-min refresh).~~

~~8. **Grid cell interaction for planting**: Resolved by S-03 — FieldGrid and PlantingDialog handle this.~~
