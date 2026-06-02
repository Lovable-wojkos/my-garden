<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Database Schema and Migrations

- **Plan**: context/changes/db-schema-and-migrations/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-05-26
- **Verdict**: REJECTED → APPROVED after triage fixes
- **Findings**: 2 critical  5 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | FAIL |
| Success Criteria | FAIL |

## Findings

### F1 — npm run lint fails: CRLF line endings + unsafe argument

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria / Pattern Consistency
- **Location**: src/types.ts, src/lib/services/*.ts, src/lib/supabase.ts, src/lib/config-status.ts, astro.config.mjs
- **Detail**: 332 lint errors. 331 CRLF line endings on all new files (Windows \\r\\n). One TS error: supabase.ts:9 `@typescript-eslint/no-unsafe-argument` — astro:env types not yet generated via `astro sync`.
- **Fix**: Run `npm run lint:fix` to clear 330 CRLF errors; run `npx astro sync` to generate astro:env types; use local variables to enable TS narrowing past the null guard.
- **Decision**: FIXED via Fix A — lint:fix run, astro sync run, supabase.ts refactored to use local vars for TS narrowing.

### F2 — config-status.ts imports server secrets at module level

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Scope Discipline
- **Location**: src/lib/config-status.ts:1,14
- **Detail**: SUPABASE_URL and SUPABASE_ANON_KEY imported into a module with no `.server.ts` suffix. Currently only a boolean is stored, but structural risk if the file is imported by a client component or extended with raw values. File was also unplanned.
- **Fix A ⭐ Recommended**: Rename to `config-status.server.ts`; update the one importer (src/layouts/Layout.astro:4).
- **Decision**: FIXED via Fix A — file renamed, importer updated.

### F3 — UPDATE policies missing WITH CHECK on three tables

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260525000000_initial_schema.sql:88,124,164
- **Detail**: plant_requests, fields, and plantings UPDATE policies lack WITH CHECK, allowing a user to change their row's user_id to another user's UUID.
- **Fix**: Follow-up migration `20260526171029_fix_rls_update_with_check.sql` — DROP + CREATE for all three policies with WITH CHECK (user_id = auth.uid()).
- **Decision**: FIXED — migration created.

### F4 — updatePlanting and updateField accept user_id/field_id in payload

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/plantings.ts:12, src/lib/services/fields.ts:21
- **Detail**: PlantingUpdate and FieldUpdate include user_id/field_id. Passing { user_id: 'other-uuid' } to updatePlanting would be accepted.
- **Fix A ⭐ Recommended**: Destructure and strip user_id (and field_id for plantings) before calling .update().
- **Decision**: FIXED via Fix A — both service functions now strip ownership fields.

### F5 — updatePlantRequestStatus admin enforcement is comment-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/plants.ts:26
- **Detail**: A logged-in user could call updatePlantRequestStatus with their own session client and set their own request status to 'approved'.
- **Fix A ⭐ Recommended**: Add WITH CHECK subquery to plant_requests UPDATE policy preventing users from changing status. Admins use service-role (bypasses RLS).
- **Decision**: FIXED via Fix A — migration 20260526171029 updated with subquery: `WITH CHECK (user_id = auth.uid() AND status = (SELECT pr.status FROM plant_requests pr WHERE pr.id = plant_requests.id))`.

### F6 — createClient returns null on missing config — silent crash risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/supabase.ts:6-8
- **Detail**: createClient returns SupabaseClient | null. Null return is intentional and handled by all 4 callers (middleware + 3 auth routes), but undocumented.
- **Fix**: Added JSDoc to createClient documenting the null contract and the requirement for callers to null-check before passing to service functions.
- **Decision**: FIXED (revised — documented null contract; throw approach would break intentional null handling in middleware/auth routes).

### F7 — getRainfallLast7Days returns rows, not a pre-aggregated sum

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/weather.ts:14-22
- **Detail**: Plan says "sums rainfall_mm for last 7 days". Implementation returned raw rows; aggregation was left to callers.
- **Fix A ⭐ Recommended**: Aggregate in the service via reduce; return `{ data: number | null, error }`.
- **Decision**: FIXED via Fix A — function now returns a numeric sum.

### F8 — fields.region_id is NOT NULL; plan schema implied nullable

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260525000000_initial_schema.sql:106
- **Detail**: False finding — plan spec already reads `region_id uuid NOT NULL REFERENCES regions(id)`. No actual drift.
- **Decision**: SKIPPED — no drift found upon closer inspection.

### F9 — JWT double-cast in admin policies — non-idiomatic

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260525000000_initial_schema.sql:49,54,58
- **Detail**: Admin policies use `(auth.jwt() ->> 'app_metadata')::jsonb ->> 'role'`. Idiomatic form: `(auth.jwt() -> 'app_metadata' ->> 'role')`.
- **Fix**: Migration `20260526195254_fix_admin_jwt_claim.sql` — DROP + CREATE for plants INSERT/UPDATE/DELETE admin policies with correct JWT extraction.
- **Decision**: FIXED — migration created.

### F10 — No indexes on FK columns; no UNIQUE on weather_records(region_id, recorded_at)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: supabase/migrations/20260525000000_initial_schema.sql
- **Detail**: PostgreSQL does not auto-index FK columns. Seq scans on common filter columns. No UNIQUE on weather_records(region_id, recorded_at) — cron retries would silently insert duplicates.
- **Fix**: Migration `20260526195651_add_fk_indexes.sql` — indexes on fields.user_id, plant_requests.user_id, plantings.field_id, plantings.user_id; UNIQUE index on weather_records(region_id, recorded_at DESC).
- **Decision**: FIXED — migration created.
