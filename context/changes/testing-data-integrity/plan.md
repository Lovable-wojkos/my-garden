# Phase 3 Data Integrity Implementation Plan

## Overview

Deliver test-plan Phase 3 for **Risk #5** (DB migration corrupts existing records): unblock local `db reset`, add a migration review script, automate post-reset seed smoke against live Postgres, and document the workflow in test-plan §6.5 and deploy-plan pre-prod gate. Test types are **manual smoke + review script** — not Vitest mocks or CI Docker (per user decision and test-plan scope).

## Current State Analysis

Research (`context/changes/testing-data-integrity/research.md`) established:

- Five ordered migrations in `supabase/migrations/` with embedded seed data (16 regions, 10 global plants)
- `src/test/fixtures/expected-catalog.ts` mirrors plant attributes for mocked Vitest — not live DB
- `[db.seed]` enabled in `config.toml` but `supabase/seed.sql` **missing** — blocks `npx supabase db reset`
- No `scripts/` folder, no `db:smoke` npm script, no migration review tooling
- CI runs lint + Vitest + build only — no Supabase
- Prod migrations: manual `supabase db push` before Vercel deploy (`context/deployment/deploy-plan.md:21`)

### Key Discoveries:

- `supabase/migrations/20260525000000_initial_schema.sql:200–216` — 16 region INSERTs (unique on `code`)
- `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:25–35` — 10 plant INSERTs (non-idempotent, no UNIQUE on `name`)
- `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:43` — `DROP TABLE plant_requests`
- `src/test/fixtures/expected-catalog.ts:12–23` — plant oracle by name/attributes
- `context/foundation/test-plan.md:134–136` — cookbook §6.5 still TBD

## Desired End State

After this plan:

1. `npx supabase db reset` completes successfully on a clean local stack (empty no-op `seed.sql` present).
2. `npm run db:review` scans migration SQL for destructive patterns and exits non-zero on review failures.
3. `npm run db:smoke` queries local Postgres and asserts: 16 regions match `EXPECTED_REGIONS`, 10 global plants match `EXPECTED_CATALOG` by name/attributes, `plant_requests` table absent, core tables exist.
4. `npm run db:verify` chains reset + smoke for one-command local verification.
5. `context/foundation/test-plan.md` §6.5 documents migration review + smoke pattern; Phase 3 row links this change folder.
6. `context/deployment/deploy-plan.md` defines pre-prod gate: `db push` → local or staging smoke → Vercel prod.

**Verification:** With Docker running and Supabase started, `npm run db:verify` exits 0. Review script flags a deliberate test violation when run against a scratch migration containing `DROP TABLE` without checklist acknowledgment.

## What We're NOT Doing

- Supabase in GitHub Actions / CI Docker (Phase 4 / optional future)
- Vitest tests that mock seed smoke (Phase 1 pattern stays separate)
- Live RLS / IDOR integration tests (Phase 2)
- Renaming `playwright/tests/seed.spec.ts` (misleading name but out of scope)
- Making migration INSERTs idempotent (`ON CONFLICT`) — documented as reset-only workflow
- DB rollback automation — document forward-fix vs backup restore only
- Changing production RLS policies flagged in research

## Implementation Approach

Three phases: (1) unblock reset + review tooling, (2) fixtures + smoke automation, (3) documentation sync. Add `pg` as devDependency for direct local Postgres queries (default URL `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, overridable via `DATABASE_URL`). Reuse `EXPECTED_CATALOG` import in smoke script; add sibling `EXPECTED_REGIONS` fixture.

## Critical Implementation Details

Smoke script must match plants **by `name` + `growth_days` + `watering_needs` + `status = 'global'`** — not by UUID. Region smoke matches **by `code` + `name`**. The smoke script runs **after** migrations apply; it does not run during CI. Migration review script is static analysis of `supabase/migrations/*.sql` files — it does not connect to a database.

## Phase 1: Unblock Reset & Migration Review

### Overview

Fix the `db reset` seed-step failure and add a repeatable migration review script developers run before merging migration changes.

### Changes Required:

#### 1. Empty seed file

**File**: `supabase/seed.sql`

**Intent**: Satisfy `[db.seed] sql_paths` in config without duplicating migration seed data.

**Contract**: File exists, contains only a comment explaining that seed data lives in migrations (regions in initial schema, plants in `20260609000000_plants_scope_drop_requests.sql`). No INSERT statements.

#### 2. Migration review script

**File**: `scripts/migration-review.mjs`

**Intent**: Static scan of `supabase/migrations/*.sql` for patterns that need human review before merge.

**Contract**: Node ESM script (no new runtime beyond Node 22). Checks each migration file for:

- `DROP TABLE` (flag; require explicit acknowledgment comment `-- migration-review: acknowledged` on same file or next line)
- `ALTER COLUMN ... DROP NOT NULL` / `DROP COLUMN` (flag)
- `INSERT INTO` without `ON CONFLICT` in files that also contain seed INSERT blocks (informational warning, not error — matches current reset-only policy)
- `DROP POLICY` without subsequent `CREATE POLICY` in same file (warning)

Exit code `0` when no unacknowledged errors; exit `1` with stderr listing file:line findings. Print summary count at end.

#### 3. npm script for review

**File**: `package.json`

**Intent**: Expose review as `npm run db:review`.

**Contract**: `"db:review": "node scripts/migration-review.mjs"`

#### 4. Acknowledgment comments on existing destructive migrations

**Files**: `supabase/migrations/20260609000000_plants_scope_drop_requests.sql`, `supabase/migrations/20260601000000_add_coords_to_weather_records.sql`, `supabase/migrations/20260526200000_merge_rls_admin_and_fk_indexes.sql`

**Intent**: Existing destructive ops pass review script without false positives.

**Contract**: Add `-- migration-review: acknowledged` comment immediately above each flagged statement (`DROP TABLE plant_requests`, `ALTER COLUMN region_id DROP NOT NULL`, `DROP POLICY` blocks) with one-line rationale.

### Success Criteria:

#### Automated Verification:

- `npm run db:review` exits 0 on current migration set
- `node scripts/migration-review.mjs` exits 1 when a scratch file with unacknowledged `DROP TABLE` is added (remove scratch after test)

#### Manual Verification:

- `npx supabase db reset` completes without seed-file error (requires Docker + `supabase start`)
- Review script output is readable and lists file paths for each finding

**Implementation Note**: Pause for human confirmation that `db reset` succeeds locally before Phase 2.

---

## Phase 2: Fixtures & Post-Reset Smoke

### Overview

Add region oracle fixture, Node smoke script against local Postgres, and npm scripts chaining reset + smoke.

### Changes Required:

#### 1. Regions fixture

**File**: `src/test/fixtures/expected-regions.ts`

**Intent**: Mirror 16 voivodeship seed rows from initial migration for smoke and future tests.

**Contract**: Export `ExpectedRegionEntry` (`code`, `name`) and `EXPECTED_REGIONS` array matching `20260525000000_initial_schema.sql:200–216` exactly (16 entries, codes `DS` through `ZP`).

#### 2. Shared fixture export note on catalog

**File**: `src/test/fixtures/expected-catalog.ts`

**Intent**: Document that smoke script imports this fixture for live DB attribute matching.

**Contract**: Extend file header comment to mention `scripts/db-smoke.mjs` as a consumer alongside Vitest tests.

#### 3. Postgres client dependency

**File**: `package.json`

**Intent**: Enable direct SQL queries from smoke script.

**Contract**: Add `pg` to `devDependencies`. No `@types/pg` required if using JSDoc or inline types sparingly.

#### 4. Smoke script

**File**: `scripts/db-smoke.mjs`

**Intent**: Assert database state after migrations (and optionally after full reset) matches fixtures.

**Contract**: Node ESM script that:

1. Connects via `DATABASE_URL` env or default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
2. Verifies tables exist: `regions`, `plants`, `fields`, `plantings`, `weather_records`, `user_preferences`
3. Verifies `plant_requests` does **not** exist (query `information_schema.tables`)
4. Asserts `SELECT count(*) FROM regions` = 16; each `EXPECTED_REGIONS` row found by `code` with matching `name`
5. Asserts `SELECT count(*) FROM plants WHERE status = 'global'` = 10; each `EXPECTED_CATALOG` entry found by `name` with matching `growth_days`, `watering_needs`, `status = 'global'`
6. Prints pass summary; exits `1` on any mismatch with clear message

Import fixtures using `createRequire` or dynamic `import()` from `../src/test/fixtures/` (project uses `"type": "module"`).

#### 5. npm scripts

**File**: `package.json`

**Intent**: One-command local DB verification workflow.

**Contract**:

- `"db:smoke": "node scripts/db-smoke.mjs"`
- `"db:reset": "npx supabase db reset"`
- `"db:verify": "npm run db:reset && npm run db:smoke"`

#### 6. README local workflow update

**File**: `README.md`

**Intent**: Document Phase 3 commands in Supabase section.

**Contract**: After `npx supabase db reset`, mention `npm run db:smoke` and `npm run db:verify`. Note Docker prerequisite. Note `DATABASE_URL` override.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on new/edited TypeScript fixture files
- `npm run db:review` still exits 0

#### Manual Verification:

- `npm run db:verify` exits 0 with Supabase local running
- Deliberately corrupting a plant `growth_days` in Studio causes `db:smoke` to fail with actionable message
- Smoke does not require app server or Vitest

**Implementation Note**: Pause for human confirmation that smoke catches intentional corruption before Phase 3.

---

## Phase 3: Documentation & Test-Plan Sync

### Overview

Codify contributor patterns, link Phase 3 in test-plan, and define pre-prod smoke gate in deploy plan.

### Changes Required:

#### 1. Test-plan cookbook §6.5

**File**: `context/foundation/test-plan.md`

**Intent**: Replace TBD §6.5 with concrete migration review + smoke instructions.

**Contract**: §6.5 covers: when to run `db:review` (any PR touching `supabase/migrations/`), when to run `db:verify` (before prod `db push`), how to add acknowledgment comments for destructive SQL, how to update `EXPECTED_CATALOG` / `EXPECTED_REGIONS` when seed data changes. §6.6 optional 2-line Phase 3 note.

#### 2. Test-plan Phase 3 row

**File**: `context/foundation/test-plan.md`

**Intent**: Link active change folder and mark phase in progress / done when implemented.

**Contract**: Update §3 table row for Phase 3: `change folder` → `context/changes/testing-data-integrity/`; update `Status` when implementation completes.

#### 3. Pre-prod smoke gate

**File**: `context/deployment/deploy-plan.md`

**Intent**: Define ordering between merge and production for schema changes.

**Contract**: New subsection under manual gates (after migrations prerequisite): **Pre-prod DB smoke** — before prod `supabase db push`, run locally `npm run db:review` on branch; after push to staging or locally after reset, run `npm run db:smoke`. Prod Vercel deploy follows successful DB verification. Note: no automated CI enforcement in Phase 3.

#### 4. Change status

**File**: `context/changes/testing-data-integrity/change.md`

**Intent**: Reflect plan completion; advance status when plan lands.

**Contract**: `status: planned`, `updated: 2026-06-17`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes if test-plan or README edited

#### Manual Verification:

- §6.5 is actionable without reading the full plan
- Deploy-plan gate is clear for a solo developer doing manual prod deploy
- New contributor can follow README → `db:verify` without asking questions

---

## Testing Strategy

### Unit Tests:

- No new Vitest files required — smoke is intentionally live-DB
- Existing `plants.test.ts` continues using mocked `EXPECTED_CATALOG`; no conflict

### Integration Tests:

- `db:smoke` **is** the integration check for seed integrity (local Postgres only)

### Manual Testing Steps:

1. `npx supabase start` (Docker running)
2. `npm run db:verify` — full pass
3. `npm run db:review` — pass on main migration set
4. Add unacknowledged `DROP TABLE` to a temp migration — review fails
5. Change one plant `growth_days` in Studio — smoke fails
6. Restore data / reset — smoke passes again

## Performance Considerations

- Smoke script runs <10 simple queries — negligible local cost
- `db:verify` includes full reset — acceptable for pre-merge manual gate, not for per-edit hooks

## Migration Notes

- Existing prod data unaffected — this change adds tooling and docs only
- Future migrations with destructive ops must add `-- migration-review: acknowledged` comments
- Seed data changes require updating both migration SQL **and** `EXPECTED_CATALOG` / `EXPECTED_REGIONS`

## References

- Research: `context/changes/testing-data-integrity/research.md`
- Test plan Risk #5: `context/foundation/test-plan.md:57`
- Phase 1 catalog fixture: `src/test/fixtures/expected-catalog.ts`
- Archive seed idempotency lesson: `context/archive/2026-06-01-plant-catalog-requests/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Unblock Reset & Migration Review

#### Automated

- [ ] 1.1 `npm run db:review` exits 0 on current migration set
- [ ] 1.2 Review script exits 1 on unacknowledged `DROP TABLE` in scratch migration

#### Manual

- [ ] 1.3 `npx supabase db reset` completes without seed-file error

### Phase 2: Fixtures & Post-Reset Smoke

#### Automated

- [ ] 2.1 `npm run lint` passes on fixture files
- [ ] 2.2 `npm run db:review` still exits 0

#### Manual

- [ ] 2.3 `npm run db:verify` exits 0 with local Supabase running
- [ ] 2.4 `db:smoke` fails on deliberate plant attribute corruption in Studio

### Phase 3: Documentation & Test-Plan Sync

#### Automated

- [ ] 3.1 `npm run lint` passes after doc edits

#### Manual

- [ ] 3.2 §6.5 cookbook is actionable for a new migration PR
- [ ] 3.3 Deploy-plan pre-prod gate documents `db:review` → `db push` → `db:smoke` → Vercel order
