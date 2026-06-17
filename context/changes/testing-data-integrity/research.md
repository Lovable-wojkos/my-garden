---
date: 2026-06-17T12:00:00+00:00
researcher: Auto
git_commit: 71f67cef9b9d0bbcf992b6db214d88f07d6de3bf
branch: development
repository: my-garden
topic: "Phase 3 data integrity — migration review and seed smoke tests (Risk #5)"
tags: [research, codebase, supabase, migrations, seed-data, test-plan]
status: complete
last_updated: 2026-06-17
last_updated_by: Auto
---

# Research: Phase 3 Data Integrity — Migration Review and Seed Smoke Tests

**Date**: 2026-06-17
**Researcher**: Auto
**Git Commit**: `71f67cef9b9d0bbcf992b6db214d88f07d6de3bf`
**Branch**: `development`
**Repository**: my-garden

## Research Question

What must Phase 3 (`testing-data-integrity`) deliver to protect against Risk #5 — DB migration corrupts existing records — and what does the codebase already provide as foundation?

## Summary

Phase 3 should produce a **repeatable migration review checklist/script** plus **post-`db reset` smoke queries** that verify seed data and table integrity. The repo has five ordered migrations with all seed data embedded in SQL (16 regions, 10 global plants), a Vitest fixture (`EXPECTED_CATALOG`) that mirrors plant attributes but not DB UUIDs, and documented local/prod deploy paths — but **no migration review tooling, no seed smoke tests, and a broken `db reset` config** (`supabase/seed.sql` referenced but missing). CI and Vercel never touch migrations; prod schema changes are manual `supabase db push` before app deploy.

**Top blockers for implementation:**

1. Missing `supabase/seed.sql` while `[db.seed] enabled = true` in `config.toml`
2. No `scripts/` folder or npm targets for reset + smoke workflow
3. Plant seed INSERTs are non-idempotent (duplicates on re-run); region INSERTs fail on unique `code`
4. `playwright/tests/seed.spec.ts` is misnamed — it tests admin page reload, not DB seed

## Detailed Findings

### Migration inventory

| # | File | Purpose | Destructive ops | Seed data |
|---|------|---------|-----------------|-----------|
| 1 | `20260525000000_initial_schema.sql` | Core tables + RLS | None | 16 regions (lines 200–216) |
| 2 | `20260526000000_user_preferences.sql` | `user_preferences` + owner RLS | None | — |
| 3 | `20260526200000_merge_rls_admin_and_fk_indexes.sql` | RLS hardening, FK indexes, weather dedup index | `DROP POLICY` + recreate | — |
| 4 | `20260601000000_add_coords_to_weather_records.sql` | Nullable `region_id`, lat/lng columns | `ALTER COLUMN region_id DROP NOT NULL` | — |
| 5 | `20260609000000_plants_scope_drop_requests.sql` | Plants scoped (`user_id`, `status`), seed catalog | `DROP TABLE plant_requests` | 10 global plants (lines 25–35) |

**Final table set:** `regions`, `plants`, `fields`, `plantings`, `weather_records`, `user_preferences`. `plant_requests` is dropped in migration 5.

Migration order respects FK dependencies: `regions`/`plants` before `fields`/`plantings`; `user_preferences` after `auth.users`.

### Seed data and idempotency

| Dataset | Count | Location | ON CONFLICT | Re-run risk |
|---------|-------|----------|-------------|-------------|
| Regions | 16 | `initial_schema.sql:200–216` | No | Unique violation on `code` |
| Plants | 10 | `plants_scope_drop_requests.sql:25–35` | No | Silent duplicate rows (no UNIQUE on `name`) |

All seed data lives in migrations — there is no separate seed file with content. Archive lesson from plant-catalog-requests: `db reset` is the safe verification path; re-running only the plants migration duplicates rows.

### `EXPECTED_CATALOG` fixture (Phase 1 reuse)

`src/test/fixtures/expected-catalog.ts` mirrors the 10 plant names, `growth_days`, and `watering_needs` from migration 5. IDs are synthetic (`seed-plant-tomato`) — suitable for mocked Vitest, **not** for post-reset UUID assertions. Match live DB rows by `name` + attributes.

**Gap:** No `EXPECTED_REGIONS` fixture for the 16 voivodeship codes (`DS`…`ZP`).

### `db reset` blocker: missing `seed.sql`

`supabase/config.toml:60–65` enables `[db.seed]` with `sql_paths = ["./seed.sql"]`, but **`supabase/seed.sql` does not exist**. `npx supabase db reset` likely fails at the seed step after migrations succeed. README documents `db reset` without noting this (`README.md:96`).

**Resolution options for `/10x-plan`:**

- Add empty/no-op `supabase/seed.sql` (migrations already carry seed data)
- Disable `[db.seed]` or set `sql_paths = []`
- Add `seed.sql` with idempotent checks only (not duplicate INSERTs)

### RLS and cross-table integrity (review checklist items)

Not Phase 2 scope, but migration review should flag:

- `plantings_insert_owner` checks `user_id = auth.uid()` but not that `field_id` belongs to that user (`initial_schema.sql:158–161`)
- No authenticated UPDATE/DELETE on `plants` after migration 5 — admin flows must use service role
- `weather_records` rows with null `region_id` and null coords are not deduped by unique index

### Existing test infrastructure

| Asset | What it does | Phase 3 fit |
|-------|--------------|-------------|
| `src/test/fixtures/expected-catalog.ts` | Oracle for 10 plants (mocked) | Reuse attributes for live smoke |
| `src/test/lib/plants.test.ts` | Mocked catalog completeness | Not live DB |
| `playwright/tests/seed.spec.ts` | Admin heading survives reload | **Not seed smoke** |
| `playwright/tests/admin-plant-requests.spec.ts` | Live DB approve/reject E2E | Integration, not migration smoke |
| `package.json` scripts | `test:run`, `test:e2e` only | No `db:reset`, `test:smoke` |
| `.github/workflows/ci.yml` | lint → test:run → build | No Supabase/Docker |

### Deployment path

```
LOCAL:  npx supabase start → .env → npx supabase db reset → npm run dev
PROD:   supabase db push (manual, deploy-plan prerequisite) → vercel deploy --prod
CI:     lint + vitest + build (no DB)
```

- `context/deployment/deploy-plan.md:21` — prod migrations via manual `db push`
- No DB rollback runbook; Vercel rollback is app-only (`deploy-plan.md:148–161`)
- Pre-prod smoke gate planned after Phase 3 lands (`test-plan.md:109`)

## Code References

- `supabase/migrations/20260525000000_initial_schema.sql:200–216` — 16 region seed INSERTs
- `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:25–35` — 10 plant seed INSERTs
- `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:43` — `DROP TABLE plant_requests`
- `supabase/config.toml:60–65` — enabled seed pointing to missing `seed.sql`
- `src/test/fixtures/expected-catalog.ts:12–23` — plant catalog oracle
- `playwright/tests/seed.spec.ts:3–8` — misnamed page-reload test
- `.github/workflows/ci.yml:19–25` — CI without migrations
- `context/deployment/deploy-plan.md:18–21` — manual `db push` gate
- `context/foundation/test-plan.md:57,70,134–136` — Risk #5, Phase 3 scope, §6.5 TBD

## Architecture Insights

1. **Migrations are the single source of schema + seed truth** — no separate seed pipeline with content.
2. **Test-plan Risk #5 anti-pattern applies today:** CI passing lint/build does not prove migrations handle existing data safely.
3. **Phase 3 is intentionally manual smoke + review script** — not Vitest-with-mocks or CI Supabase (those are Phase 2/4 territory).
4. **Fixture ↔ migration sync is a maintenance contract** — `EXPECTED_CATALOG` must stay aligned with migration 5 INSERTs; consider a single generator or smoke that reads migration SQL in plan phase.

## Historical Context (from prior changes)

- **F-01 (`context/archive/2026-05-25-db-schema-and-migrations/`)** — First migration; regions seeded; `db push` verification standard; manual RLS smoke in plan.
- **S-05 (`context/archive/2026-06-01-plant-catalog-requests/`)** — 10 plants seeded in migration 5; `db reset` dev path; non-idempotent INSERTs documented as OK for reset-only workflow.
- **Phase 1 (`context/changes/testing-critical-path-coverage/research.md`)** — Open question on shared `EXPECTED_CATALOG` vs migration-only duplication; Phase 3 should resolve by defining live-DB smoke match-by-name.

## Related Research

- `context/changes/testing-critical-path-coverage/research.md` — Phase 1 auth/catalog/harvest risks
- `context/foundation/test-plan.md` — Phase 3 row, Risk #5 response guidance, §6.5 cookbook slot

## Open Questions

1. **Fix `seed.sql` vs disable `[db.seed]`** — which is preferred for minimal diff?
2. **Smoke automation level** — shell script + `psql` queries vs Node script using `supabase` JS client vs documented manual checklist only?
3. **Regions fixture** — add `expected-regions.ts` or inline 16 count + sample codes in smoke script?
4. **CI scope** — keep Phase 3 local-only per test-plan, or add optional GitHub Actions job with Supabase CLI + Docker?
5. **Pre-prod gate definition** — exact checklist between merge and prod (`db push` → smoke → `vercel deploy`)?

## Recommended `/10x-plan` scope

| Deliverable | Suggested approach |
|-------------|-------------------|
| Migration review checklist | Markdown or script scanning `supabase/migrations/` for destructive ops, missing `WITH CHECK`, non-idempotent INSERTs |
| Post-reset smoke | Script run after `npx supabase db reset`: assert `regions` count=16, `plants` global count=10, attributes match `EXPECTED_CATALOG` by name, `plant_requests` absent |
| `seed.sql` fix | Empty file or disable config — unblock reset |
| npm script | e.g. `db:smoke` chaining reset + smoke (optional `db:reset`) |
| Cookbook §6.5 | Document how to add migration review + smoke for future changes |
| test-plan §3 update | Link `testing-data-integrity` change folder; mark Phase 3 in progress |
