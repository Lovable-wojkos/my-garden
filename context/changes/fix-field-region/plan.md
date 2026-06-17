# Fix Field Region — Implementation Plan

## Overview

Unify the garden location into a single concept: the Open-Meteo geocoded place chosen in `WeatherWidget`. Reshape `regions` from static voivodeships into a shared catalog of geocoded coordinates, link `user_preferences` and `fields` to it, wire the nightly cron to cache historical weather by `region_id`, and remove the separate region picker from field creation.

## Current State Analysis

Two disconnected location systems coexist:

| System | Storage | UI | Used for |
|--------|---------|-----|----------|
| Field region | `fields.region_id` → 16 seeded voivodeships | `CreateFieldForm` combobox on `/dashboard/fields/new` | Stored at create; never read for weather |
| Weather location | `user_preferences.city_name`, `latitude`, `longitude` | `WeatherWidget` Open-Meteo geocoding | Live weather + cron (with `region_id: null`) |

The PRD single-location constraint (`context/foundation/prd.md` line 146) is not enforced in schema or application code.

### Key Discoveries:

- `CreateFieldForm` always shows a voivodeship combobox and requires client-sent `region_id` (`src/components/fields/CreateFieldForm.tsx:126-166`, `src/pages/api/fields/index.ts:8-13`).
- `WeatherWidget` saves prefs without creating a `regions` row (`src/components/WeatherWidget.tsx:152-160`, `src/pages/api/user-preferences.ts:66-71`).
- Cron dedupes by user coordinate strings and writes `weather_records` with `region_id: null` (`src/pages/api/cron/weather.ts:21-44`).
- Live weather path (`/api/weather` → `getWeather`) never reads `weather_records` — this stays unchanged.
- `idx_weather_records_region_recorded` unique index on `(region_id, recorded_at DESC)` already exists from `20260526200000_merge_rls_admin_and_fk_indexes.sql` — cron can upsert on this key once `region_id` is populated.
- `regions` RLS currently allows SELECT only for authenticated users — INSERT policy needed for `findOrCreateRegion`.

## Desired End State

1. User opens dashboard with no location → full-screen `WeatherWidget` is the only content; fields list and "+ New field" are hidden.
2. User picks a city → `regions` row upserted (exact lat/lng dedup), `user_preferences.region_id` set, all existing user fields updated to that `region_id`, page auto-reloads to normal dashboard.
3. User creates a field → no region UI; server assigns `region_id` from `user_preferences`; 400 if unset.
4. User visits `/dashboard/fields/new` without a region → redirect to dashboard.
5. User changes city later → new/existing region linked, prefs updated, all user's fields bulk-updated.
6. Nightly cron fetches Open-Meteo once per distinct `regions.id` and writes `weather_records` with `region_id` set (historical only).
7. Live widget weather continues calling Open-Meteo directly — no current-weather DB cache.

### Verification

- Pick city on dashboard → reload → create field without region picker → field row has same `region_id` as prefs.
- Two users pick same coordinates → one shared `regions` row.
- Change city → all user fields get new `region_id`.
- Cron response shows `region_id` populated in `weather_records` (not null).
- `npm run lint` and `npm run build` pass; new/updated unit tests pass.

## What We're NOT Doing

- Caching live/current weather in the database.
- Blending widget 7-day rainfall with `weather_records` history (widget keeps live Open-Meteo response).
- Mapping old voivodeship IDs to geocoded regions (dev data truncated instead).
- Periodic orphan-region cleanup (deferred — see roadmap Parked item).
- E2E Playwright scenarios for this change (unit/integration only per test-plan phase scope).

## Implementation Approach

Three incremental phases: schema + region upsert first (unblocks everything), cron rewire second (historical cache), field create + dashboard gating third (user-visible unification). Each phase is independently verifiable.

`user_preferences` keeps `city_name`, `latitude`, and `longitude` alongside new `region_id` so `WeatherWidget` live fetch path needs no join.

## Critical Implementation Details

**Dashboard gating reload:** After a successful city selection in the full-screen widget flow, trigger a full page reload (`window.location.reload()` or equivalent) once `POST /api/user-preferences` returns 200 — do not rely on React state alone to reveal the fields panel, because SSR gates on `prefs.region_id`.

**Migration ordering:** Truncate dependent tables (`weather_records`, `fields` — plantings cascade via FK) before dropping voivodeship rows and altering `regions` columns, since existing `fields.region_id` values reference seed IDs that will be deleted.

**Cron upsert key:** Switch from `onConflict: "latitude, longitude, recorded_at"` to `onConflict: "region_id, recorded_at"` (matches existing unique index). Populate `latitude`/`longitude` on inserts from the region row for backward compatibility with coord-based helpers.

## Phase 1: Schema + Region Upsert on Widget Select

### Overview

Reshape the `regions` table, add `user_preferences.region_id`, implement `findOrCreateRegion`, and wire city selection to upsert region + update all user fields.

### Changes Required:

#### 1. Database migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_reshape_regions_geocoded.sql`

**Intent**: Replace voivodeship semantics with geocoded-place catalog; reset dev data that references old region IDs; add prefs FK.

**Contract**:
- `DELETE`/`TRUNCATE` `weather_records` and `fields` (plantings cascade).
- `DELETE` all rows from `regions`.
- Drop `code` column; add `latitude numeric(9,6) NOT NULL`, `longitude numeric(9,6) NOT NULL`, `display_name text NOT NULL`.
- `UNIQUE (latitude, longitude)` — exact Open-Meteo coordinates, no rounding.
- `ALTER TABLE user_preferences ADD COLUMN region_id uuid REFERENCES regions(id)`.
- RLS: add `regions_insert_authenticated` policy (`INSERT TO authenticated WITH CHECK (true)`) for shared catalog growth.

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: Reflect new `RegionRow` shape and `region_id` on user preferences types.

**Contract**: `RegionRow` drops `code`, adds `latitude`, `longitude`, `display_name`. `UserPreferencesRow`/`Insert`/`Update` gain optional-then-required `region_id: string | null` (nullable in DB until user picks city).

#### 3. Region service

**File**: `src/lib/services/regions.ts`

**Intent**: Replace voivodeship list helpers with find-or-create for geocoded places.

**Contract**:
- `findOrCreateRegion(client, { latitude, longitude, displayName })` — SELECT by exact lat/lng; INSERT on miss; return `{ data: RegionRow, error }`.
- Remove or deprecate `getRegions()` (no longer needed for field create).
- Keep `getRegionById()` for lookups.

#### 4. Fields bulk-update helper

**File**: `src/lib/services/fields.ts`

**Intent**: When user changes city, update all their fields atomically.

**Contract**: `updateFieldsRegionForUser(client, userId, regionId)` — `UPDATE fields SET region_id = $regionId WHERE user_id = $userId`.

#### 5. User preferences API

**File**: `src/pages/api/user-preferences.ts`

**Intent**: City selection creates/links region and propagates to fields.

**Contract**: In `POST` handler, after validating city_name/lat/lng:
1. Call `findOrCreateRegion`.
2. Call `upsertUserPreferences` with city_name, lat, lng, **and** `region_id`.
3. Call `updateFieldsRegionForUser`.
4. Return updated prefs including `region_id`.

#### 6. User preferences service

**File**: `src/lib/services/user-preferences.ts`

**Intent**: Pass through `region_id` on upsert.

**Contract**: `UserPreferencesInsert` accepts `region_id`; upsert includes it.

#### 7. Unit tests — region upsert + field propagation

**Files**: `src/test/lib/regions.test.ts` (new), `src/test/api/user-preferences.test.ts` (new)

**Intent**: Lock coordinate dedup and field bulk-update behavior.

**Contract**:
- Two calls with identical lat/lng → same region id (mock Supabase).
- POST user-preferences with new city → `updateFieldsRegionForUser` invoked.
- POST user-preferences with different city → fields updated to new region id.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (local Docker) or `npx supabase migration up`
- Unit tests pass: `npx vitest run src/test/lib/regions.test.ts src/test/api/user-preferences.test.ts`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Pick a city in WeatherWidget → `user_preferences.region_id` populated in Supabase dashboard
- Pick same city as another test user with identical coords → single shared `regions` row
- User with existing fields changes city → all `fields.region_id` values update

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Cron Historical Cache Wired to Regions

### Overview

Nightly cron iterates distinct geocoded regions instead of user coordinate strings; writes `weather_records` with `region_id` set.

### Changes Required:

#### 1. Cron handler

**File**: `src/pages/api/cron/weather.ts`

**Intent**: Fetch historical weather once per region, not once per user coordinate pair.

**Contract**:
- Query distinct rows from `regions` (or regions referenced by any `user_preferences.region_id`).
- For each region: `getDailyWeather(region.latitude, region.longitude)`.
- Insert/upsert with `region_id` set, `latitude`/`longitude` copied from region, `onConflict: "region_id, recorded_at"`.
- Response JSON keeps `fetched`, `failed`, `locations` shape; `locations` = region count.

#### 2. Unit/integration test

**File**: `src/test/api/cron-weather.test.ts` (new)

**Intent**: Verify cron writes non-null `region_id`.

**Contract**: Mock Supabase + Open-Meteo; assert upsert payload includes `region_id` matching the region being processed.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run src/test/api/cron-weather.test.ts`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Trigger cron locally with `CRON_SECRET` → new `weather_records` rows have non-null `region_id`
- Two users sharing a region → cron fetches that region once (check logs / response `locations` count)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Field Creation Unified + Dashboard Gating

### Overview

Remove voivodeship picker from field create; server derives region from prefs; gate dashboard and `/fields/new` when no location is set.

### Changes Required:

#### 1. Field create API

**File**: `src/pages/api/fields/index.ts`

**Intent**: Server owns region assignment; reject create without prefs region.

**Contract**:
- Remove `region_id` from `CreateFieldSchema` (client no longer sends it).
- Load `getUserPreferences(supabase, user.id)` before create.
- If `!prefs?.region_id` → 400 `{ error: "location_required" }` (or structured errors).
- Pass `region_id: prefs.region_id` to `createField`.

#### 2. Create field form

**File**: `src/components/fields/CreateFieldForm.tsx`

**Intent**: Remove region UI entirely; simplify props.

**Contract**: Drop `regions` prop, region state, combobox block (lines 126–166), and `region_id` from fetch body. Form submits name/cols/rows only.

#### 3. New field page

**File**: `src/pages/dashboard/fields/new.astro`

**Intent**: Redirect users without a location; stop loading voivodeship catalog.

**Contract**:
- Remove `getRegions` import and call.
- Load `getUserPreferences`; if `!prefs?.region_id` → `Astro.redirect("/dashboard?location=required")`.
- Pass no `regions` prop to `CreateFieldForm`.

#### 4. Dashboard gating UX

**File**: `src/pages/dashboard.astro`

**Intent**: Full-screen location picker when no region; normal layout after selection.

**Contract**:
- If `!prefs?.region_id`: render only full-viewport `WeatherWidget` (no fields list, no "+ New field" link).
- If `prefs.region_id` set: current two-column layout unchanged.
- Optional: show flash message when `Astro.url.searchParams.get("location") === "required"`.

#### 5. WeatherWidget reload after first pick

**File**: `src/components/WeatherWidget.tsx`

**Intent**: After saving prefs when dashboard is in gating mode, reload to reveal fields UI.

**Contract**: In `handleSelectSuggestion`, after successful `POST /api/user-preferences`, call `window.location.reload()` (or redirect to `/dashboard`). Only when gating applies — if widget is embedded on field detail page with existing city, keep current behavior (no reload).

**Contract detail**: Accept optional prop `reloadOnSelect?: boolean`; dashboard gating passes `true`, field detail passes `false`/omits.

#### 6. Field create tests

**File**: `src/test/api/fields-index.test.ts`

**Intent**: Replace region_id validation tests with server-assignment behavior.

**Contract**:
- Remove test for invalid client `region_id` UUID.
- Add: 400 when user prefs have no `region_id` (mock `getUserPreferences`).
- Add: 201 when prefs have `region_id`; assert `createField` called with that id.
- Update `VALID_BODY` to omit `region_id`.

#### 7. Dashboard empty-state link

**File**: `src/pages/dashboard.astro`

**Intent**: "Create your first field" link only visible when region is set (implicit in gating — when no region, full-screen widget replaces empty state).

**Contract**: No separate empty-state CTA when gating; after region set, empty state shows "Create your first field →" as today.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run src/test/api/fields-index.test.ts`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Fresh user → dashboard shows only full-screen weather widget → pick city → page reloads → fields panel and "+ New field" appear
- Navigate to `/dashboard/fields/new` without region → redirected to dashboard
- Create field → no region picker → field created with correct `region_id`
- Change city in widget → all fields update region (from Phase 1, re-verify in full flow)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `findOrCreateRegion` — exact coordinate dedup, insert on miss
- `POST /api/user-preferences` — region upsert + field bulk update
- `POST /api/fields` — server-assigned region, rejection without prefs region
- Cron — non-null `region_id` in upsert payload

### Integration Tests:

- Deferred to test-plan phase 2 (Supabase local) — not required for this change's unit coverage

### Manual Testing Steps:

1. Reset local DB, sign in as fresh user → confirm full-screen widget gating
2. Pick "Warszawa" (or any Polish city) → reload → create 5×4 field → verify `fields.region_id` matches prefs
3. Create second field → confirm no region UI, same `region_id`
4. Change city to different place → verify both fields updated
5. Run cron → verify `weather_records.region_id` populated

## Performance Considerations

- `findOrCreateRegion` is one SELECT + optional INSERT per city pick — negligible.
- Cron fetches per distinct region (shared across users) — strictly fewer Open-Meteo calls than current per-user coord dedup when users share locations.
- Bulk field update on city change is one UPDATE per user — fine for MVP field counts.

## Migration Notes

- **Dev/MVP only:** migration truncates `fields` and `weather_records`. Users must re-pick city and recreate fields.
- **Production (if ever):** would need a data migration strategy — out of scope; document in migration comment.
- After migration, run `npx supabase db reset` locally to verify clean apply.

## References

- Related research: `context/changes/fix-field-region/research.md`
- Change notes: `context/changes/fix-field-region/change.md`
- PRD single-location constraint: `context/foundation/prd.md` (line 146)
- Prior weather pivot: `context/archive/2026-05-26-imgw-weather-probe/plan.md`
- Roadmap parked item (orphan cleanup): `context/foundation/roadmap.md` — Parked section

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema + Region Upsert on Widget Select

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` (local Docker) or `npx supabase migration up` — a9e37cb — a9e37cb
- [x] 1.2 Unit tests pass: `npx vitest run src/test/lib/regions.test.ts src/test/api/user-preferences.test.ts` — a9e37cb — a9e37cb
- [x] 1.3 Linting passes: `npm run lint` — a9e37cb — a9e37cb
- [x] 1.4 Build passes: `npm run build` — a9e37cb — a9e37cb

#### Manual

- [x] 1.5 Pick a city in WeatherWidget → `user_preferences.region_id` populated in Supabase dashboard — a9e37cb — a9e37cb
- [x] 1.6 Pick same city as another test user with identical coords → single shared `regions` row — a9e37cb — a9e37cb
- [x] 1.7 User with existing fields changes city → all `fields.region_id` values update — a9e37cb — a9e37cb

### Phase 2: Cron Historical Cache Wired to Regions

#### Automated

- [ ] 2.1 Unit tests pass: `npx vitest run src/test/api/cron-weather.test.ts`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 Trigger cron locally with `CRON_SECRET` → new `weather_records` rows have non-null `region_id`
- [ ] 2.5 Two users sharing a region → cron fetches that region once (check logs / response `locations` count)

### Phase 3: Field Creation Unified + Dashboard Gating

#### Automated

- [ ] 3.1 Unit tests pass: `npx vitest run src/test/api/fields-index.test.ts`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Fresh user → dashboard shows only full-screen weather widget → pick city → page reloads → fields panel and "+ New field" appear
- [ ] 3.5 Navigate to `/dashboard/fields/new` without region → redirected to dashboard
- [ ] 3.6 Create field → no region picker → field created with correct `region_id`
- [ ] 3.7 Change city in widget → all fields update region (from Phase 1, re-verify in full flow)
