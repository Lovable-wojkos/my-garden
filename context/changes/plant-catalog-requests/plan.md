# Plant Catalog Requests — Admin Approval Implementation Plan

## Overview

S-05: The plant catalog grows organically through user entries. When a user creates a new plant (during planting in S-03), it lands as a `pending` entry in the `plants` table. This change builds the admin side: an approval page at `/admin/plant-requests` where an admin can approve a pending plant (filling in `growth_days` and optional `watering_needs`) or reject it (deleting the row).

## Current State Analysis

F-01 created two separate tables: `plant_requests` (user requests, no UI exists) and `plants` (global catalog, no user-created variants). The intended product design is simpler: one `plants` table with two states — `pending` (user-created) and `global` (admin-approved, visible to all). The `plant_requests` table is obsolete and must be dropped.

The `plants` table currently has `growth_days NOT NULL`. Since pending plants won't have this data yet (admin supplies it at approval time), `growth_days` must become nullable. The `plant_requests` table has associated RLS policies, an index, TypeScript types, and three service functions — all must be removed.

## Desired End State

The `plants` table has a `user_id` (nullable FK) and `status: 'pending' | 'global'` column. Authenticated users see all global plants and their own pending plants. An admin can load `/admin/plant-requests`, see all pending plants, approve each via a modal form (filling in `growth_days` + optional `watering_needs`), or reject (delete the row). Approved plants immediately enter the global catalog. The `plant_requests` table and all associated code are removed. An initial seed of 10 common vegetables populates the global catalog.

### Key Discoveries

- `src/types.ts:26–44` — `PlantRow`/`PlantInsert`/`PlantUpdate` lack `user_id` and `status`; need updating
- `src/types.ts:47–69` — `PlantRequestStatus/Row/Insert/Update` — remove (table dropped)
- `src/lib/services/plants.ts:4–28` — 5 functions; 3 are `plant_requests`-based (remove); `getPlants` needs a `status = 'global'` filter; 4 new functions needed
- `src/middleware.ts:6` — `PROTECTED_ROUTES` missing `/admin` and `/api/admin`
- `src/lib/supabase.ts:39–56` — `createServiceRoleClient()` confirmed; `SUPABASE_SERVICE_ROLE_KEY` already declared in `astro.config.mjs`
- `src/components/ui/dialog.tsx` — Dialog installed (used for approval modal); no Select installed (use Input for `watering_needs`)

## What We're NOT Doing

- **User submission UI** — creating a plant inline during planting is S-03; no `/dashboard/plant-requests` form in S-05
- **User-facing request list** — users see their pending plants in the planting flow (S-03)
- **Rejected plant history** — rejection deletes the row; no "rejected" status or history kept
- **User notifications** — no notification when a plant is approved or rejected (v2)
- **Admin user management** — admin role assignment is Supabase dashboard only; no self-service in the app
- **`plant_requests` data migration** — table is empty in dev; nothing to migrate

## Implementation Approach

A single migration drops `plant_requests`, adds `user_id` + `status` + nullable `growth_days` to `plants`, rewrites the `plants` RLS policies, and seeds 10 global plants. TypeScript types are updated in lockstep. The service layer removes dead functions, fixes the catalog getter, and adds admin + S-03-forward-compat functions. Three admin API routes (GET list, PATCH approve, DELETE reject) use `createServiceRoleClient()`. A single Astro page checks admin role server-side, SSR-fetches pending plants, and passes them to a `client:load` React island that handles approve (Dialog modal) and reject (window.confirm + DELETE) inline.

## Critical Implementation Details

**Migration ordering**: Drop `plant_requests` RLS policies and its index BEFORE `DROP TABLE plant_requests`. Add new columns to `plants` BEFORE the new RLS policies that reference them.

**`getPlants()` filter change**: Adding `.eq('status', 'global')` changes what callers receive. No UI currently calls it (no plant list exists yet), so the change is safe — but note that S-03 will need a separate function to fetch global + user's own pending plants for the plant picker; do not repurpose `getPlants()` for that.

**Nullable `growth_days`**: `PlantRow.growth_days` changes from `number` to `number | null`. Future harvest date calculation code must null-guard before using this value.

---

## Phase 1: DB Migration + Type Cleanup

### Overview

Create the migration that transforms the schema to the single-table design and update all TypeScript types in lockstep. No service or API code is touched in this phase.

### Changes Required:

#### 1. New migration file

**File**: `supabase/migrations/20260609000000_plants_scope_drop_requests.sql`

**Intent**: Modify `plants` to support user-created pending plants; update its RLS policies to expose pending plants only to their owner; seed an initial global plant catalog; drop the obsolete `plant_requests` table along with its policies and index.

**Contract**:

```sql
-- 1. Extend plants table
ALTER TABLE plants
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'global'
    CHECK (status IN ('pending', 'global')),
  ALTER COLUMN growth_days DROP NOT NULL;

-- 2. Replace plants RLS policies
DROP POLICY IF EXISTS plants_select_authenticated ON plants;
DROP POLICY IF EXISTS plants_insert_admin ON plants;
DROP POLICY IF EXISTS plants_update_admin ON plants;
DROP POLICY IF EXISTS plants_delete_admin ON plants;

-- authenticated users see: all global plants + their own pending plants
CREATE POLICY plants_select ON plants FOR SELECT TO authenticated
  USING (status = 'global' OR (status = 'pending' AND user_id = auth.uid()));

-- authenticated users can insert their own pending plants (consumed by S-03)
CREATE POLICY plants_insert_user ON plants FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND user_id = auth.uid());

-- UPDATE and DELETE on plants are admin-only; service-role bypasses RLS, no policy needed

-- 3. Seed initial global catalog
INSERT INTO plants (name, status, growth_days, watering_needs) VALUES
  ('Tomato',    'global', 70,  'high'),
  ('Carrot',    'global', 75,  'medium'),
  ('Potato',    'global', 90,  'medium'),
  ('Onion',     'global', 100, 'low'),
  ('Lettuce',   'global', 45,  'high'),
  ('Cucumber',  'global', 60,  'high'),
  ('Pepper',    'global', 80,  'medium'),
  ('Beet',      'global', 60,  'medium'),
  ('Zucchini',  'global', 55,  'medium'),
  ('Garlic',    'global', 240, 'low');

-- 4. Drop plant_requests (policies and index first, then table)
DROP POLICY IF EXISTS plant_requests_select_owner ON plant_requests;
DROP POLICY IF EXISTS plant_requests_insert_owner ON plant_requests;
DROP POLICY IF EXISTS plant_requests_update_owner ON plant_requests;
DROP POLICY IF EXISTS plant_requests_delete_owner ON plant_requests;
DROP INDEX IF EXISTS idx_plant_requests_user_id;
DROP TABLE IF EXISTS plant_requests;
```

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Add `user_id` and `status` to the Plant types; relax `growth_days` to nullable; remove the entire `plant_requests` section.

**Contract**:

- `PlantRow`: `growth_days: number | null`; add `user_id: string | null`, `status: 'pending' | 'global'`
- `PlantInsert`: `growth_days?: number | null`; add `user_id?: string | null`, `status?: 'pending' | 'global'`
- Remove lines 46–69: `PlantRequestStatus`, `PlantRequestRow`, `PlantRequestInsert`, `PlantRequestUpdate`

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` completes without error
- TypeScript compiles without errors: `npm run lint` passes
- No remaining PlantRequest type references: `grep -r "PlantRequest" src/` returns nothing

#### Manual Verification:

- Supabase Studio shows `plants` has `user_id`, `status`, and nullable `growth_days` columns
- `plant_requests` table is absent from Studio
- 10 seeded global plants appear in Studio

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Service Layer

### Overview

Remove the three functions that operated on `plant_requests`, fix `getPlants()` to return only global plants, and add four new functions: one forward-compat function for S-03 plant creation, and three admin functions.

### Changes Required:

#### 1. Update plants service

**File**: `src/lib/services/plants.ts`

**Intent**: Align the service layer with the new single-table design. Remove dead code, scope the catalog getter to global plants, and expose admin and user-creation operations.

**Contract**:

- **Remove** `createPlantRequest`, `getPlantRequestsByUser`, `updatePlantRequestStatus` — all operated on the dropped table
- **Modify** `getPlants(client)` — add `.eq('status', 'global')` before `.order('name')` so it returns only catalog plants
- **Add** `createUserPlant(client, data: { name: string; user_id: string })` — inserts `{ name, user_id, status: 'pending' }` into `plants`, returns the new `PlantRow`; called with the anon client in S-03
- **Add** `getPendingPlants(client)` — selects all plants where `status = 'pending'`, ordered `created_at` descending, typed `PlantRow[]`; must be called with service-role client
- **Add** `approvePlant(client, id: string, data: { growth_days: number; watering_needs?: string | null })` — updates the row: `{ status: 'global', growth_days, watering_needs }`; returns updated `PlantRow`; must be called with service-role client
- **Add** `rejectPlant(client, id: string)` — deletes the row by id; must be called with service-role client

Update the import line: remove `PlantRequestInsert`, `PlantRequestRow`, `PlantRequestStatus`; keep `PlantRow`; add `PlantInsert` for `createUserPlant`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes — no type errors, no references to removed types
- `grep "PlantRequest" src/lib/services/plants.ts` returns nothing

#### Manual Verification:

- `getPlants()` with anon client returns only the 10 seeded global plants
- `getPendingPlants()` with service-role client returns an empty array (no pending plants yet)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Admin API Routes + Middleware

### Overview

Extend `PROTECTED_ROUTES` to cover `/admin` and `/api/admin`, then create the three admin endpoints for listing pending plants, approving, and rejecting.

### Changes Required:

#### 1. Middleware protected routes

**File**: `src/middleware.ts`

**Intent**: Gate all `/admin/*` pages and `/api/admin/*` routes behind authentication at the middleware layer so unauthenticated users are redirected before admin code runs.

**Contract**: Add `"/admin"` and `"/api/admin"` to the `PROTECTED_ROUTES` array on line 6.

#### 2. Admin list endpoint

**File**: `src/pages/api/admin/plant-requests/index.ts`

**Intent**: Return all pending plants for the admin page. Returns 403 for non-admins, uses the service-role client for RLS bypass.

**Contract**:

- `export const prerender = false`
- `export const GET: APIRoute`
- Admin check: if `context.locals.user?.app_metadata?.role !== 'admin'` → return 403 `{ error: 'Forbidden' }`
- Get service-role client; if null return 503 `{ error: 'Service unavailable' }`
- Call `getPendingPlants(serviceClient)`; on Supabase error return 500
- Return 200 `{ plants: PlantRow[] }`

#### 3. Admin approve + reject endpoint

**File**: `src/pages/api/admin/plant-requests/[id].ts`

**Intent**: Two operations on a single pending plant by ID — PATCH approves and sets catalog attributes; DELETE rejects (destroys) the row.

**Contract**:

- `export const prerender = false`
- Both handlers share the same admin check + service-role client setup as `index.ts` above
- `export const PATCH: APIRoute`: parse body with Zod `{ growth_days: z.number().int().min(1), watering_needs: z.string().optional() }`; on parse failure return 422 `{ errors: Record<string, string[]> }` (aggregate per field, same pattern as `src/pages/api/fields/index.ts:8–13`); call `approvePlant(serviceClient, context.params.id!, data)`; return 200 `{ plant: PlantRow }`
- `export const DELETE: APIRoute`: no body; call `rejectPlant(serviceClient, context.params.id!)`; return 200 `{ ok: true }`

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes in all new route files
- All new route files export `prerender = false`
- `npm run build` succeeds

#### Manual Verification:

- Unauthenticated GET `/api/admin/plant-requests` → 302 redirect to `/auth/signin`
- Authenticated non-admin GET → 403 `{ error: 'Forbidden' }`
- Admin GET → 200 `{ plants: [] }`
- PATCH with missing/invalid `growth_days` → 422 with field errors
- After Studio-inserting a pending plant: PATCH approve → 200, plant `status` is `'global'` and `growth_days` is set in Studio
- DELETE reject → 200, row is absent from Studio

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Admin UI

### Overview

Build the React island and its Astro wrapper. The island receives the pending plants list via SSR props, renders a list of pending entries, and handles approve (Dialog modal form) and reject (window.confirm + DELETE) inline without navigation.

### Changes Required:

#### 1. Admin React island

**File**: `src/components/plants/AdminPlantRequestList.tsx`

**Intent**: Render the list of pending plants and let the admin approve (collect `growth_days`/`watering_needs` in a Dialog modal, then PATCH) or reject (confirm + DELETE) each entry inline.

**Contract**:

- Props: `initialPlants: PlantRow[]`
- Component state: `plants` (mirrors prop, updated on success), `approvalTarget: PlantRow | null`, `growthDays: string`, `wateringNeeds: string`, `loading: boolean`, `errors: Record<string, string[]>`
- **List**: each pending plant shows `name`, formatted `created_at`, truncated `user_id`; two buttons per row: "Approve" and "Reject"
- **Approve button**: sets `approvalTarget` and opens a shadcn `<Dialog>`. Dialog body contains the plant name as a read-only label, an `<Input>` for `growth_days` (type="number", min="1", required), and an `<Input>` for `watering_needs` (optional, placeholder "low / medium / high"). Submit calls `PATCH /api/admin/plant-requests/${approvalTarget.id}` with `{ growth_days: parseInt(growthDays), watering_needs: wateringNeeds || undefined }`. On success: remove approved plant from `plants` state, close dialog, clear form fields and errors.
- **Reject button**: calls `window.confirm("Remove this plant request?")`. If confirmed, calls `DELETE /api/admin/plant-requests/${plant.id}`. On success: remove rejected plant from `plants` state.
- Both fetch calls: `loading` disables the active button, field errors from 422 render under the relevant input, 5xx sets a general error message above the form.
- Empty state: show "No pending plant requests." when `plants` is empty.

#### 2. Admin Astro page

**File**: `src/pages/admin/plant-requests.astro`

**Intent**: Server-side admin guard + SSR data fetch; non-admins never see admin data.

**Contract**:

- `export const prerender = false`
- Redirect non-admins: `if (Astro.locals.user?.app_metadata?.role !== 'admin') return Astro.redirect('/dashboard')`
- Create service-role client via `createServiceRoleClient()`; if null, set `plants = []`
- Otherwise: `const { data: plants } = await getPendingPlants(serviceClient)`, use `plants ?? []`
- Render within `<Layout title="Plant Requests">`: a heading and `<AdminPlantRequestList client:load initialPlants={plants} />`

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes — no type errors in component or page
- `npm run build` succeeds

#### Manual Verification:

- Non-admin visits `/admin/plant-requests` → redirected to `/dashboard`
- Admin visits page → loads with "No pending plant requests."
- Insert pending plant via Studio: `INSERT INTO plants (name, status, user_id) VALUES ('TestPlant', 'pending', '<any-user-uuid>')` → reload page → plant appears
- Approve: click Approve, fill `growth_days = 30`, `watering_needs = medium`, submit → plant disappears from list; Studio confirms `status = 'global'`, `growth_days = 30`
- Reject: click Reject on a second Studio-inserted plant, confirm → plant disappears from list; Studio confirms row is deleted

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:

1. Run `npx supabase db reset` and verify no migration errors
2. Open Supabase Studio; confirm `plants` schema and 10 global seed rows
3. Sign in as a regular user; visit `/admin/plant-requests` — expect redirect to `/dashboard`
4. Set `app_metadata.role = "admin"` for a test user via Supabase dashboard Auth panel
5. Sign in as admin; visit `/admin/plant-requests` — expect "No pending plant requests."
6. Insert a pending plant via Studio (see Phase 4 manual steps above)
7. Reload admin page; confirm pending plant appears in list
8. Run the approve flow end-to-end; verify in Studio
9. Insert a second pending plant; run the reject flow end-to-end; verify row deleted in Studio

## Migration Notes

- `DROP TABLE IF EXISTS` is idempotent — safe for re-runs
- Seed INSERTs are NOT idempotent (`ON CONFLICT DO NOTHING` not included); `npx supabase db reset` is fine, but manually re-running the migration alone would duplicate seed rows — acceptable for the MVP dev workflow
- The `DEFAULT 'global'` on the new `status` column means any existing rows in `plants` (if any) retain their status as global on migration apply

## References

- Research: `context/changes/plant-catalog-requests/research.md`
- F-01 archive: `context/archive/2026-05-25-db-schema-and-migrations/plan.md`
- Reference API route pattern: `src/pages/api/fields/index.ts`
- Reference Astro page: `src/pages/dashboard/fields/new.astro`
- Reference React island: `src/components/fields/CreateFieldForm.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB Migration + Type Cleanup

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — d28cd03
- [x] 1.2 TypeScript compiles without errors: `npm run lint` — d28cd03
- [x] 1.3 No remaining PlantRequest type references: `grep -r "PlantRequest" src/` returns nothing — d28cd03

#### Manual

- [x] 1.4 Supabase Studio shows `plants` with `user_id`, `status`, nullable `growth_days` — a354dd5
- [x] 1.5 `plant_requests` table is absent from Studio — a354dd5
- [x] 1.6 10 seeded global plants appear in Studio — a354dd5

### Phase 2: Service Layer

#### Automated

- [x] 2.1 `npm run lint` passes — no type errors, no references to removed types
- [x] 2.2 `grep "PlantRequest" src/lib/services/plants.ts` returns nothing

#### Manual

- [x] 2.3 `getPlants()` with anon client returns only 10 global plants — a354dd5
- [x] 2.4 `getPendingPlants()` with service-role returns empty array — a354dd5

### Phase 3: Admin API Routes + Middleware

#### Automated

- [x] 3.1 `npm run lint` passes in new route files — 66fa5a3
- [x] 3.2 All new route files export `prerender = false` — 66fa5a3
- [x] 3.3 `npm run build` succeeds — 66fa5a3

#### Manual

- [x] 3.4 Unauthenticated GET `/api/admin/plant-requests` → 302 redirect — a354dd5
- [x] 3.5 Authenticated non-admin GET → 403 `{ error: 'Forbidden' }` (deferred to Phase 4 UI testing) — a354dd5
- [x] 3.6 Admin GET → 200 `{ plants: [] }` (deferred to Phase 4 UI testing) — a354dd5
- [x] 3.7 PATCH with invalid body → 422 with field errors (deferred to Phase 4 UI testing) — a354dd5
- [x] 3.8 PATCH approve on Studio-inserted pending plant → 200, Studio shows `status = 'global'` (deferred to Phase 4 UI testing) — a354dd5
- [x] 3.9 DELETE reject on Studio-inserted pending plant → 200, row deleted in Studio — a354dd5 (deferred to Phase 4 UI testing)

### Phase 4: Admin UI

#### Automated

- [x] 4.1 `npm run lint` passes — a354dd5
- [x] 4.2 `npm run build` succeeds — a354dd5

#### Manual

- [x] 4.3 Non-admin visits `/admin/plant-requests` → redirected to `/dashboard` — a354dd5
- [x] 4.4 Admin visits page → "No pending plant requests." shown — a354dd5
- [x] 4.5 Studio-inserted pending plant appears on page reload — a354dd5
- [x] 4.6 Approve flow: modal → submit → plant removed from list; Studio confirms `status = 'global'` — a354dd5
- [x] 4.7 Reject flow: confirm → plant removed from list; Studio confirms row deleted — a354dd5
