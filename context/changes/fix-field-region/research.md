---
date: 2026-06-17T12:00:00+02:00
researcher: Cursor Agent
git_commit: a074602c1f478a65aac555095b3d45065311feec
branch: development
repository: my-garden
topic: "Fix field region — unify widget location, regions cache, and field creation"
tags: [research, codebase, fields, regions, open-meteo, weather, weather-records, cache]
status: complete
last_updated: 2026-06-17
last_updated_by: Cursor Agent
last_updated_note: "Resolved: exact coords, shared regions, location changeable, no live weather cache"
---

# Research: Fix field region — single region per user

**Date**: 2026-06-17T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `a074602c1f478a65aac555095b3d45065311feec`  
**Branch**: `development`  
**Repository**: my-garden

## Research Question

For the current app state, all user fields should share the same region. Two issues were reported:

1. When creating a field, use the **region list** instead of **Open-Meteo search**.
2. When a region is specified on the **first field**, the user should **not** see the region chooser on subsequent field creation.

## Summary

The codebase has **two disconnected location systems**:

| System | Storage | UI | Used for |
|--------|---------|-----|----------|
| **Field region** | `fields.region_id` → `regions` (16 Polish voivodeships) | `CreateFieldForm` combobox on `/dashboard/fields/new` | Persisted per field at create time; **not** used for weather display |
| **Weather location** | `user_preferences.city_name`, `latitude`, `longitude` | `WeatherWidget` city input + Open-Meteo geocoding on dashboard and field detail | Live weather fetch and nightly cron |

**Issue 1 (region list vs Open-Meteo):** Field creation **already** uses the static voivodeship list from Supabase — not Open-Meteo. Open-Meteo geocoding appears only in `WeatherWidget` (dashboard + field detail). The reported problem is likely **UX confusion** (two separate location pickers) or a desire to **replace WeatherWidget geocoding** with the same region catalog. The combobox placeholder "Search regions…" filters the local list client-side and may feel like an external geocoding search.

**Issue 2 (hide region after first field):** **Not implemented.** Every visit to `/dashboard/fields/new` loads the full region list and always renders the region picker. There is no check for existing fields, no default `region_id` inheritance, and no API enforcement that all fields for a user share one region.

**Product alignment:** PRD states MVP does not support multiple fields in different locations (`context/foundation/prd.md` line 146). Current schema allows different `region_id` per field with no constraint.

## Detailed Findings

### Issue 1 — Field creation region UI vs Open-Meteo

#### Field creation uses region list (not Open-Meteo)

`new.astro` loads all regions server-side and passes them to the form:

```15:28:src/pages/dashboard/fields/new.astro
const { data: regions, error: regionsError } = await getRegions(supabase);
// ...
      <CreateFieldForm client:load regions={regions} />
```

`getRegions` reads the seeded `regions` table ordered by name:

```4:6:src/lib/services/regions.ts
export async function getRegions(client: SupabaseClient) {
  return client.from("regions").select("*").order("name").overrideTypes<RegionRow[], { merge: false }>();
}
```

`CreateFieldForm` renders a Popover + Command combobox over that list (lines 126–166). Submit sends `region_id` UUID to `POST /api/fields`. **No Open-Meteo imports or `/api/geocoding-suggestions` calls** in this flow.

#### Open-Meteo geocoding is only in WeatherWidget

City search uses Open-Meteo geocoding API:

```36:39:src/components/WeatherWidget.tsx
async function doFetchSuggestions(q: string, signal: AbortSignal): Promise<GeocodingResult[]> {
  const res = await fetch(`/api/geocoding-suggestions?q=${encodeURIComponent(q)}`, { signal });
```

`WeatherWidget` is mounted on:

- `src/pages/dashboard.astro` (line 82) — alongside the fields list
- `src/pages/dashboard/fields/[id].astro` (line 73) — field detail sidebar

It is **not** on `/dashboard/fields/new`. A user creating their first field from the dashboard empty state may still see `WeatherWidget` on the dashboard **before** navigating to create — two different location inputs in the same session.

#### Historical split (why two systems exist)

S-01 (`imgw-weather-probe`) explicitly chose coordinate-based Open-Meteo over voivodeship dropdown for weather precision:

> "No voivodeship-level region dropdown (gmina precision requires geocoding)" — `context/archive/2026-05-26-imgw-weather-probe/plan.md`

S-02 (`field-creation`) added required `region_id` on fields using the 16 voivodeship seed from F-01.

S-04 research resolved the gap for MVP by using `user_preferences` coordinates for weather, not `field.region_id`:

> "Fields have `region_id` (FK to voivodeship). Weather data … keyed by `(latitude, longitude)` from `user_preferences`. These two are not directly linked." — `context/archive/2026-06-01-field-weather-view/research.md`

#### Implication for Issue 1

If the goal is **one region concept for the whole garden**, the fix is not "swap Open-Meteo for region list in CreateFieldForm" (already a region list) but rather:

- **Unify** weather location with field region, **or**
- **Remove/hide** WeatherWidget city search when region is set via fields, **or**
- **Clarify UX** so users don't confuse the combobox search with geocoding (e.g. plain `<select>`, different label/copy)

### Issue 2 — Region picker shown on every field create

#### Current behavior: no first-field vs subsequent-field distinction

`CreateFieldForm` always initializes `regionId` to empty and always renders the region block:

```27:27:src/components/fields/CreateFieldForm.tsx
  const [regionId, setRegionId] = useState("");
```

```126:166:src/components/fields/CreateFieldForm.tsx
      <div className="space-y-1.5">
        <Label>Region</Label>
        <Popover open={regionOpen} onOpenChange={setRegionOpen}>
        ...
```

`new.astro` does not load existing user fields or pass a default region.

#### Data model allows multiple regions per user

Each field row has its own `region_id` FK. No `UNIQUE (user_id)` or application check enforces a single region:

```100:109:supabase/migrations/20260525000000_initial_schema.sql
CREATE TABLE fields (
  ...
  region_id  uuid NOT NULL REFERENCES regions(id),
  ...
);
```

`getFieldsByUser` returns all fields ordered by `created_at` — suitable for reading the first field's `region_id`:

```4:10:src/lib/services/fields.ts
export async function getFieldsByUser(client: SupabaseClient, userId: string) {
  return client
    .from("fields")
    .select("*")
    .eq("user_id", userId)
    .order("created_at")
```

`getRegionById` exists but is **unused** outside `regions.ts`.

#### API always requires explicit `region_id`

```8:13:src/pages/api/fields/index.ts
const CreateFieldSchema = z.object({
  name: z.string().min(1).max(50),
  cols: z.number().int().min(1).max(20),
  rows: z.number().int().min(1).max(20),
  region_id: z.uuid(),
});
```

No server-side logic to default `region_id` from the user's existing fields.

#### Implication for Issue 2

To match expected behavior:

| Layer | Change needed |
|-------|---------------|
| **SSR (`new.astro`)** | Load user's existing fields; if any exist, resolve `region_id` from first field (or validate all match) |
| **UI (`CreateFieldForm`)** | Accept optional `defaultRegionId` + `hideRegionPicker`; prefill and omit region UI when set |
| **API (`POST /api/fields`)** | Optionally make `region_id` optional when user already has fields; server assigns inherited region and rejects mismatches |
| **Enforcement** | Consider validating all fields for a user share the same `region_id` on create (400 if client sends a different one) |

### Region catalog

16 Polish voivodeships seeded in migration (`DS`…`ZP`). Read-only for authenticated users via RLS. No `/api/regions` JSON endpoint — catalog exposed only through SSR on the new-field page.

### Weather services still support region-keyed queries (unused by UI)

`src/lib/services/weather.ts` has `getLatestWeather`, `getRainfallLast7Days`, `getLastRainDate` keyed by `region_id`, but the live UI uses coordinate-based helpers and Open-Meteo. Nightly cron (`src/pages/api/cron/weather.ts`) fetches by `user_preferences` coordinates with `region_id: null`.

## Code References

- `src/components/fields/CreateFieldForm.tsx:126-166` — Region combobox (local list, always visible)
- `src/pages/dashboard/fields/new.astro:15-28` — Loads regions, no existing-field check
- `src/pages/api/fields/index.ts:8-13` — `region_id` required UUID on every create
- `src/lib/services/regions.ts:4-9` — `getRegions`, `getRegionById`
- `src/lib/services/fields.ts:4-10` — `getFieldsByUser` (ordered by `created_at`)
- `src/components/WeatherWidget.tsx:36-39` — Open-Meteo geocoding suggestions
- `src/pages/dashboard.astro:82` — WeatherWidget on dashboard (separate from field create)
- `supabase/migrations/20260525000000_initial_schema.sql:100-109,200-216` — `fields.region_id` FK + region seed
- `src/test/api/fields-index.test.ts:82-88` — Only tests invalid UUID; no inheritance or hide-picker coverage

## Architecture Insights

1. **Dual location model** is intentional historical debt: voivodeship for field metadata, coordinates for weather precision.
2. **PRD single-location constraint** (`prd.md` line 146) is not enforced in schema or application code.
3. **Field `region_id` is write-only today** — stored at create, never read for display or weather after creation.
4. **No dedicated `RegionPicker` component** — region UI is inline in `CreateFieldForm`.
5. **Client-side region "search"** is cmdk filtering over the SSR-provided list, not an API call.

## Historical Context (from prior changes)

| Artifact | Relevance |
|----------|-----------|
| `context/archive/2026-05-25-db-schema-and-migrations/plan-brief.md` | Regions as separate seeded table; per-region weather records |
| `context/archive/2026-06-01-field-creation/plan.md` | `region_id` required at field create |
| `context/archive/2026-05-26-imgw-weather-probe/plan.md` | Open-Meteo geocoding replaces voivodeship for weather |
| `context/archive/2026-06-01-field-weather-view/research.md` | MVP decision: weather uses `user_preferences`, not `field.region_id` |
| `context/foundation/prd.md:146` | MVP: single location per user, no multi-location fields |
| `context/changes/testing-data-integrity/research.md` | Notes 16 seeded regions, no test fixture yet |

## Related Research

- `context/archive/2026-06-01-field-weather-view/research.md` — weather-to-field coordinate gap analysis
- `context/changes/testing-data-integrity/research.md` — region seed inventory

## Open Questions

1. **Scope of Issue 1:** Should the fix only clarify field-creation UX (plain select, hide WeatherWidget city search until region set), or **reconnect weather** to `field.region_id` / voivodeship (larger scope, conflicts with S-01 coordinate precision)?
2. **Source of truth:** When first field sets region, should that also **seed `user_preferences`** for weather, or is hiding the picker + inheriting `region_id` on new fields sufficient for this change?
3. **Mismatch handling:** If a user somehow has fields with different `region_id` values (no constraint today), should the API normalize to the first field's region or reject?
4. **Region immutability:** Can the user ever change their garden region after the first field, or is it set-once for MVP?
5. **Combobox vs select:** Is replacing Command/Popover with a native or shadcn `<Select>` part of the fix, or is the concern specifically about Open-Meteo appearing elsewhere?

## Recommended plan direction (for `/10x-plan`)

**Minimal scope (matches reported issues):**

1. `new.astro`: load existing fields; pass `defaultRegionId` when `fields.length > 0`.
2. `CreateFieldForm`: hide region block when `defaultRegionId` provided; submit inherited id.
3. `POST /api/fields`: when `region_id` omitted, inherit from user's first field; when provided on subsequent create, validate it matches existing fields' region.
4. Optionally simplify region UI to a `<Select>` (no "Search regions…" affordance) on first field only.

**Out of scope unless explicitly expanded:** rewiring `WeatherWidget` / cron from coordinates to voivodeship `region_id`.

---

## Follow-up Research (2026-06-17) — Corrected product intent

### User clarification

The user corrected the framing. The goal is **not** a voivodeship dropdown on field create. Expected behavior:

1. **Region = the location chosen in `WeatherWidget`** (Open-Meteo geocoding result: city name + lat/lng).
2. **`regions` table stores those geocoded locations** — a shared catalog/cache of places users pick, not the 16 static voivodeships.
3. **`weather_records` stores historical data per region** — nightly cron backfill only; avoids duplicate Open-Meteo fetches across users sharing a region.
4. **Fields inherit the user's widget region** — no separate region picker on create; all fields share one region per user.
5. **Live/current weather stays on Open-Meteo** — no DB cache for what the widget shows right now; cache is historical-only via cron.

### Intended architecture (target state)

```
User types city in WeatherWidget
  → Open-Meteo geocoding (one-time per search)
  → upsert regions row (lat, lng, display name) — find-or-create by coordinates
  → user_preferences.region_id → regions.id  (replaces raw lat/lng as primary link, or alongside)
  → cron fetches Open-Meteo daily per unique region → weather_records.region_id (historical only)
  → GET /api/weather still calls Open-Meteo live (no current-weather DB cache)

User creates field
  → region_id taken from user_preferences.region_id
  → no region UI on CreateFieldForm
  → block or prompt if no region chosen yet

User changes city in widget (any time)
  → new regions row (or existing match by exact coords)
  → user_preferences.region_id updated
  → all user's fields.region_id updated to match
```

### Current state vs target — gap analysis

| Concern | Current implementation | Target |
|---------|------------------------|--------|
| **`regions` meaning** | 16 seeded Polish voivodeships (`code`, `name` only; no coordinates) | Dynamic rows for Open-Meteo geocoded places (`latitude`, `longitude`, `display_name`; dedupe by coords) |
| **Widget selection persistence** | `user_preferences`: `city_name`, `latitude`, `longitude` — **no `region_id`** | Link prefs to `regions.id` when user picks a city |
| **Historical weather cache** | Cron writes `weather_records` with `region_id: null` + lat/lng (`cron/weather.ts:37-44`) | Cron writes with `region_id` set; keyed by region; **historical only** |
| **Live weather API** | `/api/weather` always calls Open-Meteo (`open-meteo.ts:getWeather`) | **Unchanged** — keep live Open-Meteo; no current-weather DB cache |
| **Field create region** | Separate voivodeship combobox; unrelated to widget | Auto-assign user's `region_id`; remove picker entirely |
| **Region change** | N/A (disconnected systems) | User can change city anytime; prefs + all fields updated to new `region_id` |
| **Dedup across users** | Cron dedupes by `user_preferences` lat/lng strings (`cron/weather.ts:21-28`) | One `regions` row per exact Open-Meteo coordinates; shared across users |

### Evidence — live path bypasses the cache

**Widget always hits Open-Meteo for display data:**

```30:33:src/components/WeatherWidget.tsx
async function doFetchWeather(lat: number, lng: number, signal: AbortSignal): Promise<WeatherData> {
  const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, { signal });
```

```28:30:src/pages/api/weather.ts
  try {
    const weatherData = await getWeather(lat, lng);
```

No query to `weather_records` anywhere in the live weather path.

**Cron stores history but disconnects from `regions`:**

```37:44:src/pages/api/cron/weather.ts
      const inserts = dailyRecords.map((r) => ({
        latitude: lat,
        longitude: lng,
        recorded_at: `${r.date}T00:00:00Z`,
        temperature_c: r.temperatureC,
        rainfall_mm: r.rainfallMm,
        region_id: null,
      }));
```

**Region-keyed weather helpers exist but are unused by UI:**

```4:11:src/lib/services/weather.ts
export async function getLatestWeather(client: SupabaseClient, regionId: string) {
  return client
    .from("weather_records")
    .select("*")
    .eq("region_id", regionId)
```

These were built for the original F-01 voivodeship model; S-01/F-02 pivoted to coordinates without reconnecting `region_id`.

**Widget saves prefs without creating a region:**

```152:160:src/components/WeatherWidget.tsx
    await fetch("/api/user-preferences", {
      method: "POST",
      ...
      body: JSON.stringify({
        city_name: suggestion.displayName,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      }),
    });
```

`POST /api/user-preferences` (`user-preferences.ts:66-71`) stores only city + coords — no `regions` upsert.

### Schema changes likely required

The current `regions` table cannot represent Open-Meteo locations:

```9:14:supabase/migrations/20260525000000_initial_schema.sql
CREATE TABLE regions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

A migration would need to (at minimum):

- Add `latitude numeric(9,6)`, `longitude numeric(9,6)`, and `display_name text` (or repurpose `name`)
- **`UNIQUE (latitude, longitude)`** — exact Open-Meteo coordinates, no rounding
- Drop voivodeship seed rows (or migrate if any prod data exists)
- Add `region_id` FK to `user_preferences`
- Cron upsert `weather_records` by `(region_id, recorded_at)` — primary historical key
- `fields.region_id` FK stays; values repointed to new geocoded regions; bulk-update on user location change

### Field creation — revised UX

| Scenario | Expected behavior |
|----------|-------------------|
| User has not picked a city in widget | Field create blocked or redirected ("choose your garden location first") |
| User picked city in widget | `region_id` resolved from `user_preferences.region_id`; create form has **no region field** |
| User adds 2nd+ field | Same `region_id` auto-applied from prefs; no picker |
| User changes city in widget | `user_preferences.region_id` updated; **all existing fields** get new `region_id` |

Remove from field create flow:

- `getRegions()` on `new.astro`
- Region combobox block in `CreateFieldForm` (lines 126–166)
- Client sending `region_id` — server derives from authenticated user's prefs

### API call reduction — what is and isn't cached

| Call site | Today | After fix |
|-----------|-------|-----------|
| Widget load / 30-min refresh | Open-Meteo every time | **Unchanged** — live Open-Meteo (no current-weather cache) |
| Nightly cron | Open-Meteo per unique user coord | Open-Meteo per unique `regions.id` (shared across users) |
| Historical queries (future) | Not used in UI today | Read `weather_records` by `region_id` |
| Geocoding search | Open-Meteo per keystroke (debounced) | Unchanged |
| City selection | Saves prefs only | Upsert `regions` (exact coords) + link prefs; update all user fields' `region_id` |

### Conflict with prior archived decisions

S-01 explicitly rejected voivodeship dropdown for weather and chose coordinate geocoding. **This change aligns with S-01's coordinate precision** while **reverting F-01's voivodeship seed semantics** for `regions`. The original F-01 design (regions + `weather_records.region_id`) is actually **closer to the user's intent** than the current coordinate-orhpan state — but regions must be **geocoded places**, not administrative voivodeships.

### Resolved decisions (2026-06-17)

| Question | Decision |
|----------|----------|
| **Region dedup key** | Exact `latitude` + `longitude` as returned by Open-Meteo (`numeric(9,6)`); no rounding |
| **Shared across users** | Yes — one `regions` row per unique coordinate pair; cron fetches once per region |
| **Changing location** | Allowed after field creation; updating widget city updates `user_preferences.region_id` **and** all user's `fields.region_id` |
| **Live weather cache** | **No** — `/api/weather` keeps calling Open-Meteo for current widget data; `weather_records` is historical-only (cron) |
| **Voivodeship seed** | Drop — replace with dynamic geocoded regions (plan to confirm in migration) |
| **Field create gate** | Block (or redirect) if user has no `region_id` in prefs yet |

### Remaining open questions

1. **Field create gate UX:** Hard error on API vs redirect to dashboard with message?
2. **Orphan regions:** Delete unused region rows when no user/field references them, or keep indefinitely?
3. **Widget 7-day rainfall:** Keep computing from live Open-Meteo response, or eventually blend with `weather_records` history? (Out of scope if live path unchanged.)

### Revised recommended plan direction

**Phase 1 — Schema + region upsert on widget select**

- Migration: reshape `regions` (`latitude`, `longitude`, `display_name`; `UNIQUE(lat, lng)` exact); drop voivodeship seed; add `user_preferences.region_id`
- Service: `findOrCreateRegion(lat, lng, displayName)` — match on exact coordinates
- `POST /api/user-preferences`: upsert region, set `region_id`, update all user's fields to new region

**Phase 2 — Cron historical cache wired to regions**

- Cron: iterate distinct `regions` (or regions referenced by any user), write `weather_records` with `region_id`
- **Do not change** `/api/weather` or `WeatherWidget` live fetch path

**Phase 3 — Field creation unified**

- Remove region picker from `CreateFieldForm`
- `POST /api/fields`: derive `region_id` from `user_preferences`; 400 if unset
- No client-sent `region_id`

**Tests to add/update**

- Region upsert on exact-coordinate match (shared row for two users same coords)
- Region change updates all user fields
- Field create without `region_id` in body (server-assigned)
- Field create rejected when no prefs region
- Cron writes `weather_records.region_id` (not null)
