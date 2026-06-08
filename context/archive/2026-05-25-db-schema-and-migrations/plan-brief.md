# Database Schema and Migrations — Plan Brief

> Full plan: `context/changes/db-schema-and-migrations/plan.md`

## What & Why

Create the initial Supabase database schema for the Garden Management App: six tables (`regions`, `plants`, `plant_requests`, `fields`, `plantings`, `weather_records`) with RLS, TypeScript types, and a service layer scaffold. This is F-01 — the data foundation that unblocks every downstream slice (S-02 field creation, S-03 planting record, S-04 field weather view, S-05 plant catalog, F-02 nightly weather job).

## Starting Point

The `supabase/migrations/` directory is empty; no schema exists. `src/types.ts` and `src/lib/services/` do not exist. The Supabase SSR client (`src/lib/supabase.ts`) is wired and working; auth is functional. This plan writes everything from scratch.

## Desired End State

Six tables exist in Supabase with correct foreign keys, RLS enabled, and per-operation policies for the `authenticated` role. `src/types.ts` provides typed Row/Insert/Update interfaces for every table. `src/lib/services/` contains thin typed query wrappers per domain, ready for API routes to call in downstream slices.

## Key Decisions Made

| Decision             | Choice                                            | Why (1 sentence)                                                                  | Source |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| Plant catalog access | Shared table, all authenticated users can SELECT  | Clean separation from user data; no per-user RLS complexity on the catalog        | Plan   |
| User plant requests  | Separate `plant_requests` table                   | S-05 requires this flow anyway; keeps catalog clean                               | Plan   |
| Planting granularity | Per-cell (`cell_row` + `cell_col` on `plantings`) | FR-002 requires a visual grid; per-cell enables exact rendering                   | Plan   |
| Weather record scope | Per-region (not per-field)                        | Nightly job pulls per-region; avoids duplication across fields in the same region | Plan   |
| Harvest date storage | `growth_days int` on `plants`                     | Simplest; direct calculation (`seeding_date + growth_days`); easy to extend       | Plan   |
| Field grid storage   | `cols` + `rows` on `fields`                       | Grid is implicit; no extra tables needed for MVP                                  | Plan   |
| Regions model        | Separate `regions` table, seeded                  | FK enforcement; enables region dropdown; extensible for S-01 IMGW probe           | Plan   |
| RLS depth            | Full per-operation policies on all tables         | AGENTS.md requirement; secure by default; each operation is explicit              | Plan   |
| TypeScript types     | Hand-written in `src/types.ts`                    | No tooling needed; fits current project setup                                     | Plan   |
| Migration structure  | Single migration file                             | Atomic; first migration in an empty DB; simple to apply or rollback               | Plan   |

## Scope

**In scope:**

- SQL migration: `regions`, `plants`, `plant_requests`, `fields`, `plantings`, `weather_records` + RLS + seed regions
- `src/types.ts` — Row/Insert/Update types for all six tables
- `src/lib/services/` — typed Supabase query wrappers (fields, plants, plantings, weather, regions)

**Out of scope:**

- API route handlers (S-02, S-03, S-05 etc.)
- UI components
- Initial `plants` seed data (deferred to S-05)
- Harvest recording columns (FR-012, v2)
- Watering notification logic (FR-013, v2)

## Architecture / Approach

Single SQL migration creates all tables in FK dependency order with RLS immediately enabled. A seed block inserts Polish IMGW regions. TypeScript types mirror the schema exactly. Service functions are thin wrappers that accept the SSR Supabase client as a parameter (never instantiate it) and return typed Supabase response objects — matching the existing `src/lib/supabase.ts` pattern.

## Phases at a Glance

| Phase                     | What it delivers                                         | Key risk                                                                                     |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. SQL Migration          | All six tables, RLS policies, seeded regions in Supabase | Region codes are placeholders if IMGW structure unknown at migration time (resolved in S-01) |
| 2. TypeScript Types       | `src/types.ts` with Row/Insert/Update per table          | Manual sync required if schema changes later                                                 |
| 3. Service Layer Scaffold | `src/lib/services/` — typed query wrappers per domain    | None — thin wrappers with no business logic                                                  |

**Prerequisites:** Local Supabase CLI or linked Supabase project to apply and verify the migration.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- IMGW region codes are unknown until S-01 lands. Migration seeds voivodeship names with placeholder codes; a follow-up migration updates codes after S-01 probe resolves the IMGW API structure.
- `plantings.plant_id` is nullable (hybrid free-text per FR-003). Application logic must enforce that at least one of `plant_id` or `plant_name` is populated — this is not enforced at DB level in this plan.
- Admin role check on `plants` INSERT/UPDATE/DELETE uses `auth.jwt() ->> 'app_metadata' ->> 'role' = 'admin'`. This assumes the Supabase project is configured to set this claim for admin users.

## Success Criteria (Summary)

- `npx supabase db push` applies the migration with no errors; all six tables visible in the dashboard with RLS ON
- `npm run lint` and `tsc --noEmit` pass after adding `src/types.ts` and service files
- Authenticated user can create a field but cannot read another user's field or write `weather_records` directly
