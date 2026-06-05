# Open-Meteo Weather Widget Implementation Plan (S-01)

## Overview

Build a dashboard weather widget (S-01) that lets a logged-in user type a Polish city/gmina name, geocode it to coordinates, fetch current temperature + 7-day cumulative rainfall + last-rain date from Open-Meteo, and persist the city preference per user in the database. This is the north-star slice: it validates that the weather data layer can deliver everything FR-006–FR-010 require before any dependent slice is built.

## Current State Analysis

- F-01 is fully complete: `regions` (16 voivodeships), `plants`, `plant_requests`, `fields`, `plantings`, `weather_records` tables exist with RLS. Service scaffolds at `src/lib/services/weather.ts` and `src/lib/services/regions.ts` target DB reads — no HTTP weather client exists yet.
- No external `fetch()` calls exist anywhere in the codebase (`src/pages/api/auth/` routes use Supabase SDK only).
- No `user_preferences` table — needed to persist the user's chosen city/coordinates between sessions.
- Dashboard page exists at `src/pages/dashboard.astro` but is sparse.
- IMGW public API is current-snapshot only — no 7-day rainfall history. **Open-Meteo** (free, IMGW-sourced for Poland, full historical REST API) covers all three weather requirements.

### Key Discoveries:

- `src/lib/supabase.ts:1–24` — SSR client factory; service functions must accept the client as a parameter.
- `src/pages/api/auth/signin.ts:1–20` — API route pattern: export uppercase named function, return `new Response(JSON.stringify(...))`, no `prerender = false` needed (global SSR).
- `src/middleware.ts:4` — `PROTECTED_ROUTES` array; add `/api/weather` and `/api/user-preferences` to gate them behind auth.
- `astro.config.mjs` — new env vars declared via `envField` in `env.schema`; imported via `astro:env/server`.
- F-01 plan note (`supabase/migrations/20260525000000_initial_schema.sql`) — regions seeded with voivodeship names/placeholder codes; S-01 uses Open-Meteo coordinates directly, bypassing the regions table for the weather fetch.
- Open-Meteo geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=5&language=pl&format=json` — no API key, free.
- Open-Meteo weather: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,precipitation&daily=precipitation_sum&past_days=7&timezone=auto` — no API key, free.
- Poland gmina-level precision: ~2500 municipalities — voivodeship-level (16 regions) is too coarse; coordinates-based query is the only viable approach for meaningful weather correlation.

## Desired End State

A logged-in user on `/dashboard` sees a weather widget. They type a Polish city name, pick from geocoded suggestions, and immediately see: current temperature (°C), cumulative rainfall in mm for the last 7 days, and the date of last rain. The chosen city is persisted to the DB so the weather loads automatically on subsequent visits. If the weather API is unavailable, the widget shows the last successfully fetched result with a "last updated" timestamp badge.

Verification: log in, open `/dashboard`, search "Kraków", select the suggestion, confirm all three data points appear, refresh the page — widget reloads with Kraków weather without re-entering the city.

## What We're NOT Doing

- No IMGW direct integration (current-snapshot only; Open-Meteo covers the same data with history)
- No server-side weather caching (in-memory React state cache only for S-01; persistent caching is F-02's job)
- No voivodeship-level region dropdown (gmina precision requires geocoding)
- No offline/PWA caching (PRD NFR deferred to v2)
- No weather for multiple locations simultaneously
- No watering recommendations (depends on S-03 plant data)
- No nightly cron job (F-02)
- No `weather_records` DB writes (F-02 owns that; S-01 fetches live from Open-Meteo)
- Not deleting `src/lib/services/weather.ts` — its three DB-read helpers (`getLatestWeather`, `getRainfallLast7Days`, `getLastRainDate`) stay in place; F-02 will repurpose them when nightly caching lands.

## Implementation Approach

Four sequential phases: (1) add a `user_preferences` DB table via migration so the city preference survives sessions; (2) build a server-side Open-Meteo HTTP client service that handles geocoding and weather fetching; (3) expose two API routes — one for weather data, one for reading/writing user preferences; (4) build the React `WeatherWidget` component (city search, suggestion picker, weather display, 30-min auto-refresh, stale badge on failure) and wire it into the dashboard page.

All external HTTP calls live in the service layer (`src/lib/services/`), not in components or API routes directly. API routes are thin: validate input, call service, return JSON.

## Critical Implementation Details

- **Open-Meteo `past_days` parameter:** The weather endpoint returns `daily.precipitation_sum` as an array. With `past_days=7` and no `forecast_days` override, Open-Meteo's default still includes today and the next 6 forecast days. Treat the array conservatively: identify "today" using `daily.time[i] === <today's ISO date in the response's timezone>`, sum precipitation only for the 7 indices strictly before today (the past-days window), and scan that same past-only window from the end for the last non-zero value to compute `lastRainDate`. Never let a forecast index leak into `rainfall7dMm` or `lastRainDate`. `current.precipitation` is the current hour's precipitation and is separate.
- **Geocoding language:** Pass `language=pl` to Open-Meteo geocoding to get Polish place names in suggestions; display `name`, `admin2` (powiat), `admin1` (voivodeship) in the suggestion list so users can distinguish cities with the same name.
- **Stale badge:** The React component stores `{ data, fetchedAt }` in state. On 30-min interval failure, keep the previous `data` and set a `stale: true` flag — display "dane z HH:MM" below the widget.

---

## Phase 1: User Preferences Migration

### Overview

Add a `user_preferences` table so the user's chosen city and its geocoded coordinates persist between sessions. This is a minimal addition to the F-01 schema.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260526000000_user_preferences.sql`

**Intent**: Create `user_preferences` table keyed on `user_id` (one row per user) storing the preferred city display name, latitude, and longitude. Enable RLS with per-user SELECT/INSERT/UPDATE/DELETE policies.

**Contract**:
```
user_preferences
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  city_name     text NOT NULL          -- display name from geocoding (e.g. "Kraków, Małopolskie")
  latitude      numeric(9,6) NOT NULL
  longitude     numeric(9,6) NOT NULL
  updated_at    timestamptz DEFAULT now()
```
RLS: SELECT/INSERT/UPDATE/DELETE all scoped to `user_id = auth.uid()`. No admin override needed.

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Add `UserPreferencesRow`, `UserPreferencesInsert`, `UserPreferencesUpdate` interfaces following the existing Row/Insert/Update pattern for the other five tables.

**Contract**: `UserPreferencesRow { user_id: string; city_name: string; latitude: number; longitude: number; updated_at: string }`. Insert/Update shapes mirror Phase 3 of F-01.

#### 3. User preferences service

**File**: `src/lib/services/user-preferences.ts`

**Intent**: Thin typed wrappers for `user_preferences` CRUD — `getUserPreferences(client, userId)` and `upsertUserPreferences(client, prefs: UserPreferencesInsert)`.

**Contract**: Both functions accept `SupabaseClient` as first argument and return Supabase `{ data, error }` shape. `upsert` uses `onConflict: 'user_id'` to handle the insert-or-update case.

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260526000000_user_preferences.sql`
- `npx supabase db push` applies cleanly with no errors
- `npm run lint` passes on `src/types.ts` and `src/lib/services/user-preferences.ts`

#### Manual Verification:

- `user_preferences` table visible in Supabase dashboard with correct columns
- RLS enabled; reading another user's row returns empty
- `upsertUserPreferences` called twice with the same `user_id` — second call updates, not duplicates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Open-Meteo HTTP Client Service

### Overview

Build a server-side service module that wraps Open-Meteo's geocoding and forecast APIs. No UI, no routes — pure typed HTTP wrappers that the API routes will call.

### Changes Required:

#### 1. Open-Meteo service

**File**: `src/lib/services/open-meteo.ts`

**Intent**: Export three async functions: `geocodeCity`, `getWeather`, and a convenience `getWeatherForCity`. These are the only places in the codebase that call Open-Meteo — centralising error handling and response shaping.

**Contract**:

```ts
// Geocoding
export interface GeocodingResult {
  name: string;           // city name
  displayName: string;    // "Kraków, Małopolskie, Polska"
  latitude: number;
  longitude: number;
  country_code: string;
}
export async function geocodeCity(city: string): Promise<GeocodingResult[]>
// Calls: https://geocoding-api.open-meteo.com/v1/search?name={city}&count=5&language=pl&format=json
// Returns up to 5 results; throws on network error; returns [] on no match.

// Weather
export interface WeatherData {
  temperatureC: number;        // current temperature
  rainfall7dMm: number;        // sum of daily precipitation over last 7 days
  lastRainDate: string | null; // ISO date of most recent day with precipitation > 0, or null
  fetchedAt: string;           // ISO timestamp of this fetch
}
export async function getWeather(lat: number, lng: number): Promise<WeatherData>
// Calls: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}
//        &current=temperature_2m,precipitation&daily=precipitation_sum
//        &past_days=7&timezone=auto&format=json
// Throws on network error or non-2xx response.
// `rainfall7dMm` and `lastRainDate` MUST be computed only from the
// past-only slice of `daily.precipitation_sum` (indices where
// `daily.time[i] < today` in the response's timezone) — never include
// today or any forecast day. See "Critical Implementation Details".
```

#### 2. No env vars needed

Open-Meteo requires no API key. No changes to `astro.config.mjs` or `.env.example` for this service.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on `src/lib/services/open-meteo.ts`
- TypeScript compiles without errors (`tsc --noEmit` or `npm run build`)

#### Manual Verification:

- Call `geocodeCity("Kraków")` from a temporary test route or Node script — returns at least one result with lat/lng
- Call `getWeather(50.06, 19.94)` — returns an object with `temperatureC`, `rainfall7dMm`, `lastRainDate`, `fetchedAt`
- Call `geocodeCity("xyznonexistent")` — returns empty array without throwing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: API Routes

### Overview

Expose two API routes: one for fetching weather data by coordinates, one for reading and saving the user's city preference.

### Changes Required:

#### 1. Weather API route

**File**: `src/pages/api/weather.ts`

**Intent**: `GET /api/weather?lat=&lng=` calls `getWeather(lat, lng)` and returns `WeatherData` as JSON. Auth-gated. This is the only route the frontend calls for weather — it never calls Open-Meteo directly.

**Contract**: Export `export const prerender = false;` at the top of the file (per AGENTS.md hard rule, even though `astro.config.mjs` is globally `output: "server"`). Export `GET: APIRoute`. Validate `lat` and `lng` query params are present and numeric (return 400 if not). Call `getWeather`. On Open-Meteo failure, return 502 with `{ error: "upstream_unavailable" }`. On success, return 200 with `WeatherData` JSON.

#### 2. User preferences API route

**File**: `src/pages/api/user-preferences.ts`

**Intent**: `GET /api/user-preferences` returns the current user's saved city preference (or 404 if none). `POST /api/user-preferences` with JSON body `{ city_name, latitude, longitude }` upserts the preference.

**Contract**: Export `export const prerender = false;` at the top of the file. Export `GET: APIRoute` and `POST: APIRoute`. Both require `context.locals.user` (return 401 if null). GET calls `getUserPreferences`. POST validates body fields (city_name non-empty string, lat/lng numeric), calls `upsertUserPreferences`, returns 200 on success or 400 on invalid input.

#### 3. Middleware protection

**File**: `src/middleware.ts`

**Intent**: Add `"/api/weather"` and `"/api/user-preferences"` to `PROTECTED_ROUTES` so unauthenticated requests are redirected to sign-in rather than returning 500.

**Contract**: Append the two path strings to the `PROTECTED_ROUTES` array at line 4.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on new route files and updated middleware
- `npm run build` succeeds

#### Manual Verification:

- `GET /api/weather?lat=50.06&lng=19.94` (authenticated) — returns JSON with three weather fields
- `GET /api/weather` (no params) — returns 400
- `GET /api/weather` (unauthenticated) — redirects to sign-in
- `POST /api/user-preferences` with valid body — returns 200; row upserted in DB
- `GET /api/user-preferences` — returns saved city data
- `GET /api/user-preferences` (unauthenticated) — redirects to sign-in

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Weather Widget UI + Dashboard Integration

### Overview

Build the `WeatherWidget` React component and integrate it into the dashboard page. The widget handles: city search with geocoded suggestions, weather display, 30-minute auto-refresh, in-memory stale data badge, and loading/error states.

### Changes Required:

#### 0. Install required shadcn/ui primitives

Only `src/components/ui/button.tsx` exists today. Before building `WeatherWidget`, install the missing primitives:

```bash
npx shadcn@latest add card input badge
```

This creates `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, and `src/components/ui/badge.tsx` (new-york variant). Verify `npm run lint` passes afterwards.

#### 1. WeatherWidget component

**File**: `src/components/WeatherWidget.tsx`

**Intent**: React island component that manages city search, suggestion display, weather fetch, 30-min refresh interval, and stale data display. Receives `initialCity` (from server-side preferences load) as a prop so the first render can immediately fetch weather without a loading state.

**Contract**:
```ts
interface WeatherWidgetProps {
  initialCity?: {
    cityName: string;
    latitude: number;
    longitude: number;
  } | null;
}
export default function WeatherWidget({ initialCity }: WeatherWidgetProps)
```
Internal state: `{ city, suggestions, weather: WeatherData | null, stale: boolean, loading, error }`. On mount, if `initialCity` is present, immediately call `GET /api/weather?lat=&lng=` and set weather state. Search input calls `GET /api/geocoding-suggestions?q=` (see item 2) on debounce (300ms). On suggestion select: save preference via `POST /api/user-preferences`, then fetch weather. Refresh interval: `setInterval` every 30 minutes — on failure, keep previous `weather` and set `stale: true`. Display: card with city name, temperature (°C), 7-day rainfall (mm), last rain date; stale badge shows "dane z HH:MM" when `stale`.

**Interval & visibility hygiene** (mandatory):

- Clear the interval in the `useEffect` cleanup so unmount / HMR doesn't leak timers.
- Inside the interval tick, skip the fetch when `document.hidden === true` — background tabs must not hit Open-Meteo or `/api/weather`.
- Attach a `visibilitychange` listener: when the tab becomes visible, if `Date.now() - new Date(fetchedAt).getTime() > 30 * 60 * 1000`, fetch immediately so the stale badge flips without waiting for the next 30-min tick.
- Remove the `visibilitychange` listener in the same cleanup.
- Suggestion search must use an `AbortController`: store the current controller in a ref, abort it before issuing the next debounced request, and treat `AbortError` as a no-op. Combined with the route's `q.length >= 2` check, this caps Open-Meteo geocoding traffic to roughly one call per user pause.

Use `cn()` from `@/lib/utils` for Tailwind class merging. Use shadcn/ui `Card`, `Input`, `Badge` components.

#### 2. Geocoding suggestions API route

**File**: `src/pages/api/geocoding-suggestions.ts`

**Intent**: `GET /api/geocoding-suggestions?q={city}` proxies to Open-Meteo geocoding and returns an array of `GeocodingResult`. Separate from the weather route to keep concerns distinct and allow independent caching in future.

**Contract**: Export `export const prerender = false;` at the top of the file. Export `GET: APIRoute`. Validate `q` param is present and `q.trim().length >= 2` — return 400 `{ error: "query_too_short" }` otherwise (prevents one-key-held-down flooding of Open-Meteo's free tier). Call `geocodeCity(q)`. Return JSON array. The widget must use an `AbortController` so each new debounced request cancels the previous in-flight one (see Phase 4 item 1).

#### 3. Dashboard page update

**File**: `src/pages/dashboard.astro`

**Intent**: Load the current user's saved city preference server-side and pass it as `initialCity` prop to `WeatherWidget`. This avoids a loading flash on first render — the widget starts with data if a preference exists.

**Contract**: In the Astro frontmatter, construct the Supabase client (the page does not receive one from `Astro.locals` — only `user` is exposed by middleware) and load the preference:

```ts
import { createClient } from "@/lib/supabase";
import { getUserPreferences } from "@/lib/services/user-preferences";

const { user } = Astro.locals;
const supabase = createClient(Astro.request.headers, Astro.cookies);
const { data: prefs } = user && supabase
  ? await getUserPreferences(supabase, user.id)
  : { data: null };

const initialCity = prefs
  ? { cityName: prefs.city_name, latitude: prefs.latitude, longitude: prefs.longitude }
  : null;
```

Then render `<WeatherWidget initialCity={initialCity} client:load />`. The `client:load` directive makes it a React island that hydrates immediately on page load.

#### 4. Middleware update for geocoding route

**File**: `src/middleware.ts`

**Intent**: Add `"/api/geocoding-suggestions"` to `PROTECTED_ROUTES`.

**Contract**: Append to the array alongside the Phase 3 additions.

### Success Criteria:

#### Automated Verification:

- `npx shadcn@latest add card input badge` creates `src/components/ui/{card,input,badge}.tsx`
- `npm run lint` passes on all new/modified files
- `npm run build` succeeds with no type errors

#### Manual Verification:

- Log in → navigate to `/dashboard` → weather widget is visible
- Type "Wrocław" → suggestion list appears with at least one result
- Select a suggestion → weather card shows temperature, 7-day rainfall, last rain date
- Refresh the page → widget loads with Wrocław weather (no re-entry needed)
- Disconnect network, wait 30 min (or trigger manually) → widget shows last data with stale badge
- Type a nonsense city → suggestion list is empty, no crash

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not applicable — no unit test runner configured in the project.

### Integration Tests:

- Not applicable — no integration test runner configured.

### Manual Testing Steps:

1. Apply migration: `npx supabase db push` — confirm `user_preferences` table appears
2. Log in via magic link → `/dashboard` — confirm widget renders (empty state if no preference)
3. Type "Kraków" → confirm geocoding suggestions appear with Polish names
4. Select "Kraków, Małopolskie" → confirm all three weather values display
5. Refresh page → confirm Kraków loads automatically
6. Open Supabase dashboard → `user_preferences` table → confirm row exists for user
7. Sign in as a different user → their preferences don't show the first user's city
8. Simulate Open-Meteo downtime (block URL in browser devtools) → stale badge appears with timestamp
9. Mobile: verify widget is readable on 375px screen

## Performance Considerations

Open-Meteo geocoding and weather endpoints typically respond in < 300ms from Poland. No server-side caching in S-01 — acceptable for a single widget on one page. If response times degrade, a short-TTL Vercel Edge cache header (`Cache-Control: s-maxage=3600`) can be added to `/api/weather` without touching component logic.

## Migration Notes

`user_preferences` is append-only for S-01. No existing data to migrate. If the Open-Meteo coordinate format ever changes (unlikely — they are stable), the stored lat/lng can be re-geocoded by re-saving the city name through the widget.

## References

- Roadmap S-01: `context/foundation/roadmap.md:93–105`
- F-01 plan (schema baseline): `context/changes/db-schema-and-migrations/plan.md`
- PRD FR-006–FR-010: `context/foundation/prd.md:83–95`
- Supabase SSR client: `src/lib/supabase.ts`
- Middleware auth guard: `src/middleware.ts:4`
- API route pattern: `src/pages/api/auth/signin.ts`
- Open-Meteo geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Open-Meteo forecast: `https://api.open-meteo.com/v1/forecast`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: User Preferences Migration

#### Automated

- [x] 1.1 Migration file exists at `supabase/migrations/20260526000000_user_preferences.sql` — ae8bbd4
- [x] 1.2 `npx supabase db push` applies cleanly with no errors — ae8bbd4
- [x] 1.3 `npm run lint` passes on `src/types.ts` and `src/lib/services/user-preferences.ts` — ae8bbd4

#### Manual

- [x] 1.4 `user_preferences` table visible in Supabase dashboard with correct columns — ae8bbd4
- [ ] 1.5 RLS enabled; reading another user's row returns empty
- [ ] 1.6 `upsertUserPreferences` called twice with same `user_id` — updates, not duplicates

### Phase 2: Open-Meteo HTTP Client Service

#### Automated

- [x] 2.1 `npm run lint` passes on `src/lib/services/open-meteo.ts` — 46fd80f
- [x] 2.2 `tsc --noEmit` passes (no type errors) — 46fd80f

#### Manual

- [ ] 2.3 `geocodeCity("Kraków")` returns at least one result with lat/lng
- [ ] 2.4 `getWeather(50.06, 19.94)` returns object with `temperatureC`, `rainfall7dMm`, `lastRainDate`, `fetchedAt`
- [ ] 2.5 `geocodeCity("xyznonexistent")` returns empty array without throwing

### Phase 3: API Routes

#### Automated

- [x] 3.1 `npm run lint` passes on new route files and updated middleware — 346bfb7
- [x] 3.2 `npm run build` succeeds — 346bfb7

#### Manual

- [x] 3.3 `GET /api/weather?lat=50.06&lng=19.94` (authenticated) returns JSON with three weather fields
- [x] 3.4 `GET /api/weather` (no params) returns 400
- [x] 3.5 `GET /api/weather` (unauthenticated) redirects to sign-in
- [x] 3.6 `POST /api/user-preferences` with valid body returns 200 and row is upserted
- [x] 3.7 `GET /api/user-preferences` returns saved city data
- [x] 3.8 `GET /api/user-preferences` (unauthenticated) redirects to sign-in

### Phase 4: Weather Widget UI + Dashboard Integration

#### Automated

- [x] 4.1 `npx shadcn@latest add card input badge` creates `src/components/ui/{card,input,badge}.tsx`
- [x] 4.2 `npm run lint` passes on all new/modified files
- [x] 4.3 `npm run build` succeeds with no type errors

#### Manual

- [x] 4.4 `/dashboard` shows weather widget for logged-in user
- [x] 4.5 Type "Wrocław" → suggestion list appears
- [x] 4.6 Select suggestion → weather card shows temperature, 7-day rainfall, last rain date
- [x] 4.7 Refresh page → widget loads with saved city (no re-entry)
- [x] 4.8 API failure → stale badge with timestamp
- [x] 4.9 Nonsense city → empty suggestions, no crash
- [x] 4.10 Mobile (375px) → widget is readable
