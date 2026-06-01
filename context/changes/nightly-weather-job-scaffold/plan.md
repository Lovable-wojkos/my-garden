# Nightly Weather Job Scaffold Implementation Plan (F-02)

## Overview

Create a Vercel Cron job that fetches Open-Meteo weather data for all active user coordinates nightly, stores daily records in `weather_records`, and backfills 7 days of history on first run. This is F-02 — the foundation that enables `S-04 Field Weather View` to display historical rainfall data stored in the database rather than live-fetched.

## Current State Analysis

- F-01 is complete: `weather_records` table exists with columns `id`, `region_id` (required FK to `regions`), `recorded_at`, `temperature_c`, `rainfall_mm`, `created_at`. Unique index on `(region_id, recorded_at DESC)` prevents duplicate entries from cron retries.
- `src/lib/services/weather.ts` exists with three DB read helpers: `getLatestWeather(regionId)`, `getRainfallLast7Days(regionId)`, `getLastRainDate(regionId)`.
- S-01 is plan-reviewed (SOUND) but not yet implemented — `src/lib/services/open-meteo.ts` does not exist; this plan creates it.
- `src/lib/supabase.ts` exports an SSR client factory using `SUPABASE_URL` + `SUPABASE_ANON_KEY`. No service-role client exists.
- `astro.config.mjs` declares `SUPABASE_URL` and `SUPABASE_ANON_KEY` as server-only secrets. No `SUPABASE_SERVICE_ROLE_KEY`.
- No `vercel.json` exists — cron configuration is new.
- `src/middleware.ts` protects `/dashboard` via `PROTECTED_ROUTES`. No exclusion mechanism exists.

### Key Discoveries:

- `supabase/migrations/20260526200000_merge_rls_admin_and_fk_indexes.sql` added `idx_weather_records_region_recorded` unique index on `(region_id, recorded_at DESC)` for cron dedup — indicates region-based dedup was expected, but this plan adds coordinate-based storage.
- S-01 plan specifies Open-Meteo API contracts in `src/lib/services/open-meteo.ts` — this plan reuses that contract for `getWeather()` and adds `getDailyWeather()` for the cron use case.
- `user_preferences` table will exist once S-01 is implemented; the cron queries it for distinct coordinate pairs.
- `weather_records` has `region_id` FK NOT NULL — must be made nullable for coordinate-based rows.

## Desired End State

A Vercel Cron job runs nightly (midnight UTC), queries `user_preferences` for all unique coordinates, fetches daily temperature and precipitation from Open-Meteo for each coordinate, and upserts individual daily records into `weather_records` with lat/lng. On the first run for any coordinate, the last 7 days are backfilled. Each fetch logs success/failure. Historical rainfall queries via `weather.ts` helpers now return stored data for any coordinate that has been populated.

## What We're NOT Doing

- No region-based fetching (coordinate-only per user_preferences)
- No `CRON_SECRET` env var (using Vercel `x-vercel-cron` header)
- No alerting or notification on failure (log-only)
- No UI changes
- No Supabase Edge Function or alternative runtime
- No watering recommendation logic
- No weather data for unfilled locations (no region centroid fallback)
- Not deleting or migrating existing region-based `weather_records` rows

## Implementation Approach

Three sequential phases: (1) schema migration to extend `weather_records` for coordinate storage, (2) shared Open-Meteo HTTP client service, (3) cron API route + `vercel.json` + service-role Supabase client. Each phase is independently testable and gated behind manual verification.

## Phase 1: Schema Migration

### Overview

Extend `weather_records` with latitude/longitude columns, make `region_id` nullable, and add a unique index for coordinate-based dedup. Update TypeScript types and existing service helpers to handle both address modes.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260601000000_add_coords_to_weather_records.sql`

**Intent**: Add `latitude numeric(9,6)` and `longitude numeric(9,6)` columns to `weather_records`. Alter `region_id` to be nullable (coordinate-based rows don't reference a region). Add a unique partial index on `(latitude, longitude, recorded_at)` for coordinate-based dedup. The existing `region_id`-based unique index stays for rows that still use region references.

**Contract**:
```sql
ALTER TABLE weather_records ALTER COLUMN region_id DROP NOT NULL;
ALTER TABLE weather_records ADD COLUMN latitude numeric(9,6);
ALTER TABLE weather_records ADD COLUMN longitude numeric(9,6);
-- Coordinate-based dedup (only applies when lat/lng are non-null)
CREATE UNIQUE INDEX idx_weather_records_coord_recorded
  ON weather_records (latitude, longitude, recorded_at)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Update `WeatherRecordRow`, `WeatherRecordInsert`, `WeatherRecordUpdate` to include optional `latitude: number | null` and `longitude: number | null`. Make `region_id` optional across all three types to reflect the nullable schema.

**Contract**:
```ts
export interface WeatherRecordRow {
  id: string;
  region_id: string | null;
  recorded_at: string;
  temperature_c: number | null;
  rainfall_mm: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}
// Same optional/null pattern for Insert and Update
```

#### 3. Weather service updates

**File**: `src/lib/services/weather.ts`

**Intent**: Add two read helpers that query by coordinates instead of region: `getRainfallLast7DaysByCoords(client, lat, lng)` and `getLastRainDateByCoords(client, lat, lng)`. Keep the existing region-based helpers. Both new helpers filter by `latitude` and `longitude` columns with fuzzy matching (cast to `numeric(9,6)` equality since user_preferences stores at same precision).

**Contract**:
```ts
export async function getRainfallLast7DaysByCoords(
  client: SupabaseClient,
  latitude: number,
  longitude: number,
): Promise<{ data: number | null; error: unknown }>
// Same logic as getRainfallLast7Days but filters by lat/lng instead of region_id

export async function getLastRainDateByCoords(
  client: SupabaseClient,
  latitude: number,
  longitude: number,
)
// Same logic as getLastRainDate but filters by lat/lng instead of region_id
```

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260601000000_add_coords_to_weather_records.sql`
- `npx supabase db push` applies cleanly
- `npm run lint` passes on updated `src/types.ts` and `src/lib/services/weather.ts`
- `tsc --noEmit` passes

#### Manual Verification:

- Supabase dashboard: `weather_records` has `latitude`, `longitude`, and `region_id` is nullable
- Insert a row with lat/lng and no region_id — succeeds
- Insert a duplicate `(lat, lng, recorded_at)` — blocked by unique index
- Existing region-based rows still work (region_id unique index unchanged)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Open-Meteo HTTP Client Service

### Overview

Create the shared `src/lib/services/open-meteo.ts` with two exported functions: `getWeather(lat, lng)` returning aggregate weather data (for S-01's widget), and `getDailyWeather(lat, lng)` returning an array of individual daily records (for the cron job). Include `geocodeCity(city)` for S-01's city search. This is a server-only module (never client-imported).

### Changes Required:

#### 1. Open-Meteo service

**File**: `src/lib/services/open-meteo.ts`

**Intent**: Export three async functions. `getWeather` returns the aggregate `WeatherData` (current temp, 7-day rainfall sum, last rain date) as specified in S-01's plan contract. `getDailyWeather` returns an array of daily records (one per day for the past 7 days) that the cron job upserts into `weather_records`. `geocodeCity` proxies to Open-Meteo geocoding for S-01.

**Contract**:

```ts
// Geocoding (for S-01 — included here to unblock the dependency)
export interface GeocodingResult {
  name: string;
  displayName: string;   // "Kraków, Małopolskie, Polska"
  latitude: number;
  longitude: number;
  country_code: string;
}
export async function geocodeCity(city: string): Promise<GeocodingResult[]>
// Calls Open-Meteo geocoding API; returns []; throws on network error.

// Aggregate weather (for S-01 widget)
export interface WeatherData {
  temperatureC: number;
  rainfall7dMm: number;
  lastRainDate: string | null;
  fetchedAt: string;
}
export async function getWeather(lat: number, lng: number): Promise<WeatherData>
// Calls Open-Meteo forecast API with past_days=7.
// rainfall7dMm and lastRainDate computed only from indices where
// daily.time[i] < today in the response timezone — never includes forecast.

// Daily records (for F-02 cron job)
export interface DailyWeatherRecord {
  date: string;           // ISO date string (YYYY-MM-DD)
  temperatureC: number | null;
  rainfallMm: number | null;
}
export async function getDailyWeather(lat: number, lng: number): Promise<DailyWeatherRecord[]>
// Calls same Open-Meteo endpoint as getWeather but returns the raw daily
// breakdown instead of aggregates. Returns exactly past_days=7 records
// (indices where daily.time[i] < today). One record per day.
```

**Critical implementation detail**: Both `getWeather` and `getDailyWeather` use the same Open-Meteo API call internally. The response contains `daily.time[]`, `daily.temperature_2m_max[]` (or `temperature_2m_mean`), and `daily.precipitation_sum[]`. Identify "today" by matching `daily.time[i]` against today's local date in the response timezone. `getDailyWeather` returns the 7 strictly past indices; `getWeather` reduces the same slice. This avoids redundant HTTP calls and keeps the past-only window contract in one place.

#### 2. No env vars needed

Open-Meteo requires no API key. No changes to `astro.config.mjs` or `.env.example`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on `src/lib/services/open-meteo.ts`
- `tsc --noEmit` passes with no type errors

#### Manual Verification:

- Call `getDailyWeather(50.06, 19.94)` from a temporary test route — returns an array of 7 `{ date, temperatureC, rainfallMm }` records, all with dates before today
- Call `getWeather(50.06, 19.94)` — returns aggregate `WeatherData` with `rainfall7dMm` matching the sum of `getDailyWeather` rainfalls
- Call `geocodeCity("Kraków")` — returns at least one result with lat/lng
- Call `geocodeCity("xyznonexistent")` — returns `[]` without throwing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Cron Job

### Overview

Wire the full cron pipeline: service-role Supabase client, the cron API route, Vercel config, and env var declaration. The route fetches all distinct coordinates from `user_preferences`, calls `getDailyWeather` for each, and upserts records into `weather_records`. On first run per coordinate, backfills 7 days.

### Changes Required:

#### 1. Service-role Supabase client factory

**File**: `src/lib/supabase.ts`

**Intent**: Add a second export `createServiceRoleClient()` that creates a Supabase client using `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_ANON_KEY`. This client bypasses RLS and is used only by the cron route. It is never imported in page components or user-facing API routes.

**Contract**:
```ts
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";
// Extend the existing createClient factory or add a sibling.
// Must handle the case where SUPABASE_SERVICE_ROLE_KEY is undefined
// (e.g., local dev): return null in that case.
```

#### 2. Env var declaration

**File**: `astro.config.mjs`

**Intent**: Add `SUPABASE_SERVICE_ROLE_KEY` to the `env.schema` as a server-only secret. Follows the existing pattern for `SUPABASE_URL`/`SUPABASE_ANON_KEY`.

**Contract**:
```js
SUPABASE_SERVICE_ROLE_KEY: envField.string({
  context: "server",
  access: "secret",
  optional: true,
})
```

#### 3. Cron API route

**File**: `src/pages/api/cron/weather.ts`

**Intent**: `GET /api/cron/weather` is called by Vercel Cron nightly. It:
1. Validates the `x-vercel-cron` header (rejects with 401 if absent)
2. Creates a service-role Supabase client (rejects with 500 if missing env var)
3. Queries `user_preferences` for all distinct `(latitude, longitude)` pairs
4. For each coordinate, calls `getDailyWeather(lat, lng)` 
5. For each `DailyWeatherRecord` in the result, upserts into `weather_records`:
   - Sets `latitude`, `longitude`, `recorded_at` to the date at midnight UTC
   - Sets `temperature_c` and `rainfall_mm` from the daily record
   - Leaves `region_id` null
   - Uses `onConflict: "(latitude, longitude, recorded_at)"` with `merge: true` or equivalent, relying on the unique index for dedup
6. Logs per-location success/failure via `console.log`/`console.error`
7. Returns 200 with JSON `{ fetched: number, failed: number, locations: number, backfilled: boolean }`

**Backfill logic**: The Open-Meteo `past_days=7` parameter returns the last 7 days on every call. The cron always fetches all 7 days and upserts them into `weather_records`. The upsert naturally handles backfill (if no rows exist for this coordinate, all 7 are inserted) and subsequent runs (duplicates are silently merged). No separate "is first run" check needed.

**Contract**:
```ts
export const prerender = false;
export async function GET(context: APIContext): Promise<Response> {
  const cronHeader = context.request.headers.get("x-vercel-cron");
  if (!cronHeader) return new Response(JSON.stringify({ error: "forbidden" }), { status: 401 });

  const supabase = createServiceRoleClient();
  if (!supabase) return new Response(JSON.stringify({ error: "service_role_key_not_configured" }), { status: 500 });

  const { data: prefs } = await supabase.from("user_preferences").select("latitude, longitude");
  // ... iterate, fetch, upsert, log, return summary
}
```

#### 4. Vercel Cron configuration

**File**: `vercel.json`

**Intent**: Configure a nightly cron job that calls `GET /api/cron/weather` at midnight UTC.

**Contract**:
```json
{
  "crons": [
    {
      "path": "/api/cron/weather",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Schedule note**: `0 0 * * *` is midnight UTC. For Poland winter (UTC+1) this is 1am; for summer (UTC+2) this is 2am — well within the "nightly" window.

#### 5. Middleware exclusion

**File**: `src/middleware.ts`

**Intent**: Do NOT add `/api/cron` to `PROTECTED_ROUTES` — the cron endpoint handles its own auth via `x-vercel-cron` header. No code change needed; the exclusion is implicit. Document this in a comment above `PROTECTED_ROUTES` for clarity.

**Contract**:
```ts
// PROTECTED_ROUTES: user-facing paths that require auth.
// /api/cron/* routes authenticate via x-vercel-cron header, NOT middleware — do not add them here.
const PROTECTED_ROUTES = ["/dashboard"];
```

### Success Criteria:

#### Automated Verification:

- `vercel.json` exists at project root with valid JSON and cron schedule
- `astro.config.mjs` declares `SUPABASE_SERVICE_ROLE_KEY` in env schema
- `npm run lint` passes on all new/modified files
- `npm run build` succeeds

#### Manual Verification:

- Local: call `GET /api/cron/weather` without `x-vercel-cron` header — returns 401
- Local: call `GET /api/cron/weather` with `x-vercel-cron: 1` header — returns 500 if `SUPABASE_SERVICE_ROLE_KEY` not set; returns 200 with summary if configured
- Local with service role key: confirm `weather_records` has new rows with lat/lng populated
- Run the cron route twice for the same coordinate — duplicate-upsert check: no duplicate rows created
- Deploy with `vercel.json`: confirm the cron schedule appears in Vercel dashboard → Cron Jobs
- Wait for nightly trigger (or manually trigger via Vercel dashboard) — confirm rows appear in `weather_records`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

Not applicable — no unit test runner configured in the project.

### Integration Tests:

- Run the cron route locally with test coordinates — confirm rows in `weather_records`
- Run twice for same coordinates — confirm no duplicate rows (unique index enforcement)
- Open-Meteo error simulation (block URL in devtools) — confirm per-coordinate failure is logged, others continue

### Manual Testing Steps:

1. Apply migration: `npx supabase db push`
2. Verify `weather_records` columns in Supabase dashboard
3. Manually insert a `user_preferences` row with known coordinates directly in Supabase
4. Call `GET /api/cron/weather` with `x-vercel-cron: 1` header
5. Check `weather_records` for new rows with lat/lng populated
6. Call the route again — verify no duplicate rows
7. Call without cron header — verify 401 response
8. Deploy to Vercel — confirm cron schedule in Vercel dashboard

## Performance Considerations

- Open-Meteo has no stated rate limit but is free-tier. At MVP scale (tens of users, tens of coordinates), the nightly fetch is inconsequential. If user count grows to hundreds, the 16 fetches per coordinate pair × 365 days = ~6k calls/year remains within Open-Meteo's generous free tier (10k/day).
- Each coordinate costs ~1 HTTP call per night. The route loops sequentially — acceptable for <100 coordinates. If scale exceeds 100, a `Promise.all` batch (concurrency 5-10) can be added without changing the architecture.

## Migration Notes

- This migration makes `region_id` nullable. Existing region-based `weather_records` rows are unaffected.
- The new unique index is partial (`WHERE latitude IS NOT NULL`) so it doesn't conflict with the existing region-based unique index.
- If downgrading: revert the migration, delete the coordinate-based rows first.

## References

- Roadmap F-02: `context/foundation/roadmap.md:77–89`
- S-01 plan (open-meteo service contract): `context/changes/imgw-weather-probe/plan.md`
- F-01 plan (weather_records schema baseline): `context/changes/db-schema-and-migrations/plan.md`
- PRD FR-007: `context/foundation/prd.md:87–89`
- Environment schema pattern: `astro.config.mjs:16-21`
- Existing Supabase client factory: `src/lib/supabase.ts`
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Open-Meteo API: https://open-meteo.com/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema Migration

#### Automated

- [x] 1.1 Migration file at `supabase/migrations/20260601000000_add_coords_to_weather_records.sql`
- [x] 1.2 `npx supabase db push` applies cleanly
- [x] 1.3 `npm run lint` passes on `src/types.ts` and `src/lib/services/weather.ts`
- [x] 1.4 `tsc --noEmit` passes

#### Manual

- [ ] 1.5 Dashboard: `weather_records` has lat/lng columns, region_id nullable
- [ ] 1.6 Insert with lat/lng succeeds; duplicate blocked by unique index
- [ ] 1.7 Existing region-based rows unaffected

### Phase 2: Open-Meteo HTTP Client Service

#### Automated

- [ ] 2.1 `npm run lint` passes on `src/lib/services/open-meteo.ts`
- [ ] 2.2 `tsc --noEmit` passes

#### Manual

- [ ] 2.3 `getDailyWeather(50.06, 19.94)` returns 7 records, all dates before today
- [ ] 2.4 `getWeather(50.06, 19.94)` aggregate matches sum of daily records
- [ ] 2.5 `geocodeCity("Kraków")` returns results; nonsense returns `[]`

### Phase 3: Cron Job

#### Automated

- [ ] 3.1 `vercel.json` exists with valid cron schedule
- [ ] 3.2 `astro.config.mjs` declares `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 3.3 `npm run lint` passes on all new/modified files
- [ ] 3.4 `npm run build` succeeds

#### Manual

- [ ] 3.5 `GET /api/cron/weather` without cron header → 401
- [ ] 3.6 `GET /api/cron/weather` with cron header + service role key → 200 with summary
- [ ] 3.7 `weather_records` has new rows with lat/lng after cron run
- [ ] 3.8 Second cron run: no duplicate rows created
- [ ] 3.9 Vercel dashboard shows cron schedule after deploy
