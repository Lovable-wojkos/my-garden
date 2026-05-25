# Database Schema and Migrations Implementation Plan

## Overview

Create the initial Supabase database schema for the Garden Management App: `regions` (seeded lookup), `plants` (shared catalog), `plant_requests` (user submissions), `fields` (per-user garden fields), `plantings` (per-cell crop assignments), and `weather_records` (per-region nightly weather data). Includes RLS policies, seed data, TypeScript types, and a service layer scaffold. This is F-01 — the foundation all downstream slices depend on.

## Current State Analysis

- `supabase/migrations/` directory was empty — this plan creates the first migration.
- `src/types.ts` does not exist — created in Phase 2.
- `src/lib/services/` does not exist — scaffolded in Phase 3.
- Supabase SSR client exists at `src/lib/supabase.ts` (server-only, returns `SupabaseClient | null`).
- Auth anchor: `auth.users.id` (UUID). Middleware sets `context.locals.user`.
- No business API routes exist; this change is pure data foundation.

## Desired End State

All six tables exist in the Supabase database with correct FKs, indexes, and per-operation RLS policies. Running `supabase db push` (or applying the migration file against a Supabase project) produces a usable schema. TypeScript interfaces in `src/types.ts` cover Row/Insert/Update shapes for every table. Service functions in `src/lib/services/` provide typed Supabase query wrappers, ready for API routes to call.

### Key Discoveries:

- `src/lib/supabase.ts:1–24` — SSR-only client factory; all service functions must accept the client as a parameter (not instantiate it themselves), since the client is bound to request cookies.
- `src/env.d.ts:1–5` — `context.locals.user.id` is the UUID FK anchor for RLS `auth.uid()` comparisons.
- `AGENTS.md` — RLS must have per-operation, per-role policies on every new table; `src/lib/services/` is the designated home for business logic extracted from components.

## What We're NOT Doing

- No API route handlers (those come in S-02, S-03, S-05, etc.)
- No UI components
- No seed data for `plants` catalog (admin adds via S-05 flow; a small initial seed of common plants is a nice-to-have deferred to S-05)
- No harvest recording columns (FR-012, parked for v2)
- No watering notification logic (FR-013, parked)
- No `field_cells` table (grid is implicit from `fields.cols` × `fields.rows`)
- No auto-generated Supabase types (hand-written in `src/types.ts`)

## Implementation Approach

Single SQL migration file applied in dependency order: `regions` → `plants` → `plant_requests` → `fields` → `plantings` → `weather_records`. Each table gets RLS enabled immediately with per-operation policies for the `authenticated` role. A seed block within the same migration inserts the initial Polish IMGW regions. TypeScript types are hand-written to mirror the schema. Service functions are thin typed wrappers (no business logic) that accept the Supabase client and return typed results.

## Critical Implementation Details

- **RLS on `plants` and `regions`:** These are shared/global tables. The `SELECT` policy must allow `TO authenticated` without a `user_id` filter. `INSERT`/`UPDATE`/`DELETE` on `plants` are restricted to users where `auth.jwt() ->> 'role' = 'admin'` (or a custom claim). For MVP, admin role check can use a simple `app_metadata` claim check. `plant_requests` `SELECT` is scoped to the submitting user; admin needs a separate policy or a service-role client for the approval flow.
- **`weather_records` RLS:** No `user_id` column. SELECT is open to all authenticated users (`USING (true)`). INSERT/UPDATE is service-role only (the nightly cron job uses the service role key, bypassing RLS). No DELETE policy needed for MVP.
- **`plantings` uniqueness:** Add a `UNIQUE (field_id, cell_row, cell_col)` constraint to prevent two plants in the same cell.

## Phase 1: SQL Migration

### Overview

Write and apply the single migration file that creates all six tables, enables RLS, adds per-operation policies, and inserts the initial regions seed data.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260525000000_initial_schema.sql`

**Intent**: Create all tables in FK dependency order with RLS enabled and policies attached. Seed the `regions` table with Polish IMGW voivodeship/station regions.

**Contract**: Tables and columns listed below. The implementer writes the SQL following PostgreSQL + Supabase conventions.

```
regions
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  code        text UNIQUE NOT NULL          -- IMGW station/region code
  name        text NOT NULL                 -- Human-readable Polish name
  created_at  timestamptz DEFAULT now()

plants
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name         text NOT NULL
  growth_days  int NOT NULL                 -- Days from seeding to harvest
  watering_needs text                       -- Descriptive (low/medium/high) for display
  created_at   timestamptz DEFAULT now()
  updated_at   timestamptz DEFAULT now()

plant_requests
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  name         text NOT NULL
  notes        text
  status       text NOT NULL DEFAULT 'pending'  -- pending | approved | rejected
  created_at   timestamptz DEFAULT now()
  updated_at   timestamptz DEFAULT now()

fields
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  name         text NOT NULL
  cols         int NOT NULL
  rows         int NOT NULL
  region_id    uuid NOT NULL REFERENCES regions(id)
  created_at   timestamptz DEFAULT now()
  updated_at   timestamptz DEFAULT now()

plantings
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  field_id     uuid NOT NULL REFERENCES fields(id) ON DELETE CASCADE
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  plant_id     uuid REFERENCES plants(id)   -- nullable: hybrid free-text entry
  plant_name   text                         -- free-text fallback when plant_id is null
  cell_row     int NOT NULL
  cell_col     int NOT NULL
  seeding_date date NOT NULL
  notes        text
  created_at   timestamptz DEFAULT now()
  updated_at   timestamptz DEFAULT now()
  UNIQUE (field_id, cell_row, cell_col)

weather_records
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  region_id     uuid NOT NULL REFERENCES regions(id)
  recorded_at   timestamptz NOT NULL
  temperature_c numeric(5,2)
  rainfall_mm   numeric(6,2)
  created_at    timestamptz DEFAULT now()
```

RLS policies:
- `regions`: SELECT open to `authenticated`; no INSERT/UPDATE/DELETE for authenticated (service role only).
- `plants`: SELECT open to `authenticated`; INSERT/UPDATE/DELETE restricted to admin claim check.
- `plant_requests`: SELECT/INSERT/UPDATE scoped to `user_id = auth.uid()`; DELETE for owner.
- `fields`: SELECT/INSERT/UPDATE/DELETE scoped to `user_id = auth.uid()`.
- `plantings`: SELECT/INSERT/UPDATE/DELETE scoped to `user_id = auth.uid()`.
- `weather_records`: SELECT open to `authenticated`; no INSERT/UPDATE/DELETE for authenticated.

Seed `regions` with at minimum the 16 Polish voivodeships (or IMGW station codes if known at migration time). Use placeholder codes if exact IMGW codes are resolved in S-01.

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260525000000_initial_schema.sql`
- `npx supabase db push` applies cleanly with no errors (requires local Supabase or linked project)
- All six tables appear in `supabase db diff` as created (no unexpected drift)

#### Manual Verification:

- Connect to Supabase dashboard → Table Editor: all six tables visible with correct columns and FKs
- RLS is enabled (shown as ON) for every table in the dashboard
- Inserting a row as an authenticated user only succeeds for user-owned tables with matching `user_id`
- Inserting a `weather_records` row as an authenticated user is blocked (service role required)
- `regions` seed data present (16 rows minimum)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: TypeScript Types

### Overview

Create `src/types.ts` with Row, Insert, and Update TypeScript interfaces for all six tables, plus any shared enums (`plant_request_status`).

### Changes Required:

#### 1. src/types.ts

**File**: `src/types.ts`

**Intent**: Define TypeScript interfaces that mirror the DB schema. Three variants per table: `Row` (what SELECT returns), `Insert` (what INSERT accepts — `id`/`created_at`/`updated_at` optional), `Update` (partial Insert). Export a `PlantRequestStatus` string union. These types are consumed by service functions and API route handlers.

**Contract**:
```ts
// Example shape — implement for all six tables
export interface RegionRow { id: string; code: string; name: string; created_at: string }
export interface RegionInsert { id?: string; code: string; name: string; created_at?: string }

export type PlantRequestStatus = 'pending' | 'approved' | 'rejected'
// ... repeat for plants, plant_requests, fields, plantings, weather_records
```

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with no type errors on `src/types.ts`
- `tsc --noEmit` passes (or equivalent via the build)

#### Manual Verification:

- Every table from Phase 1 has a corresponding Row/Insert type in `src/types.ts`
- `PlantRequestStatus` union covers all values used in the migration

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Service Layer Scaffold

### Overview

Create typed service functions in `src/lib/services/` — one file per domain — that accept the Supabase client and return typed query results. No business logic; pure DB access wrappers.

### Changes Required:

#### 1. src/lib/services/fields.ts

**File**: `src/lib/services/fields.ts`

**Intent**: CRUD wrappers for the `fields` table. Functions: `getFieldsByUser(client, userId)`, `getFieldById(client, fieldId)`, `createField(client, insert: FieldInsert)`, `updateField(client, id, update: FieldUpdate)`, `deleteField(client, id)`.

**Contract**: Each function accepts a `SupabaseClient` as first argument, returns `{ data, error }` (Supabase response shape). Return types use `FieldRow` from `src/types.ts`.

#### 2. src/lib/services/plants.ts

**File**: `src/lib/services/plants.ts`

**Intent**: Read-only access to the shared `plants` catalog and CRUD for `plant_requests`. Functions: `getPlants(client)`, `getPlantById(client, id)`, `createPlantRequest(client, insert: PlantRequestInsert)`, `getPlantRequestsByUser(client, userId)`, `updatePlantRequestStatus(client, id, status: PlantRequestStatus)` (admin only — called with service-role client).

#### 3. src/lib/services/plantings.ts

**File**: `src/lib/services/plantings.ts`

**Intent**: CRUD for `plantings` scoped to a field. Functions: `getPlantingsByField(client, fieldId)`, `createPlanting(client, insert: PlantingInsert)`, `updatePlanting(client, id, update: PlantingUpdate)`, `deletePlanting(client, id)`.

#### 4. src/lib/services/weather.ts

**File**: `src/lib/services/weather.ts`

**Intent**: Read-only queries for `weather_records` by region. Functions: `getLatestWeather(client, regionId)`, `getRainfallLast7Days(client, regionId)` (sums `rainfall_mm` for records in the last 7 days), `getLastRainDate(client, regionId)` (most recent record where `rainfall_mm > 0`).

#### 5. src/lib/services/regions.ts

**File**: `src/lib/services/regions.ts`

**Intent**: Read-only lookup for `regions`. Function: `getRegions(client)`, `getRegionById(client, id)`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes across all new service files
- `tsc --noEmit` passes — no type errors in service functions
- All service functions reference types from `src/types.ts` (no inline `any`)

#### Manual Verification:

- Call `getRegions` from a test page or Supabase dashboard query — returns the seeded regions
- Call `createField` with a valid `user_id` and `region_id` — row is inserted and returned
- Attempt to call `createField` with a mismatched `user_id` — RLS blocks the insert

---

## Testing Strategy

### Unit Tests:

- Not applicable for this change — no business logic exists in the service layer yet; functions are thin wrappers.

### Integration Tests:

- Not applicable in this phase — no API routes exist to exercise end-to-end.

### Manual Testing Steps:

1. Apply migration via `npx supabase db push` or Supabase dashboard SQL editor
2. Open Table Editor — verify all six tables with correct columns
3. Verify RLS ON for all tables
4. Create a test user via magic link; use Supabase client to `createField` — succeeds
5. Try to read another user's field — RLS blocks it (returns empty, not an error)
6. Try to insert a `weather_records` row as authenticated user — blocked
7. Insert as service role — succeeds
8. Verify `plantings` unique constraint: inserting two plantings at same cell_row/cell_col/field_id fails

## Migration Notes

- This is the first migration; no existing data to migrate.
- If IMGW station codes are unknown at migration time, seed `regions` with voivodeship names and placeholder codes. S-01 resolves the actual IMGW structure — region codes can be updated in a follow-up migration once S-01 lands.
- `plantings.plant_id` is nullable to support the hybrid free-text plant entry (FR-003). `plant_name` is the fallback. Application logic should populate one or the other but not require both.

## References

- Roadmap F-01: `context/foundation/roadmap.md:64–75`
- PRD functional requirements: `context/foundation/prd.md:66–115`
- Supabase SSR client: `src/lib/supabase.ts`
- Auth env declarations: `src/env.d.ts`
- AGENTS.md — RLS rule and services convention

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: SQL Migration

#### Automated

- [ ] 1.1 Migration file exists at `supabase/migrations/20260525000000_initial_schema.sql`
- [ ] 1.2 `npx supabase db push` applies cleanly with no errors
- [ ] 1.3 All six tables appear in `supabase db diff` with no unexpected drift

#### Manual

- [ ] 1.4 All six tables visible in Supabase dashboard with correct columns and FKs
- [ ] 1.5 RLS enabled (ON) for every table
- [ ] 1.6 Authenticated user INSERT blocked for mismatched `user_id`
- [ ] 1.7 Authenticated user INSERT into `weather_records` blocked
- [ ] 1.8 `regions` seed data present (16 rows minimum)

### Phase 2: TypeScript Types

#### Automated

- [ ] 2.1 `npm run lint` passes with no type errors on `src/types.ts`
- [ ] 2.2 `tsc --noEmit` passes

#### Manual

- [ ] 2.3 Every table has Row/Insert type in `src/types.ts`
- [ ] 2.4 `PlantRequestStatus` union covers all migration values

### Phase 3: Service Layer Scaffold

#### Automated

- [ ] 3.1 `npm run lint` passes across all new service files
- [ ] 3.2 `tsc --noEmit` passes — no type errors in service functions
- [ ] 3.3 All service functions use types from `src/types.ts` (no inline `any`)

#### Manual

- [ ] 3.4 `getRegions` returns seeded regions
- [ ] 3.5 `createField` with valid data — row inserted and returned
- [ ] 3.6 `createField` with mismatched `user_id` — RLS blocks insert
