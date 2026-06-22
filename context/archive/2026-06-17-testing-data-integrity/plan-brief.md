# Phase 3 Data Integrity — Plan Brief

> Full plan: `context/changes/testing-data-integrity/plan.md`
> Research: `context/changes/testing-data-integrity/research.md`

## What & Why

Protect against **Risk #5**: a DB migration corrupts existing records or seed data while CI still passes. Phase 3 adds a **migration review script**, **post-reset smoke tests** against live local Postgres, and documents the **pre-prod gate** so schema changes are verified before production — not only eyeball-reviewed in PRs.

## Starting Point

Five migrations embed all seed data (16 regions, 10 plants). Phase 1 has `EXPECTED_CATALOG` for mocked Vitest. Local `db reset` is broken (missing `seed.sql`), and there is no review or smoke tooling. CI never touches Supabase.

## Desired End State

A developer runs `npm run db:verify` locally before prod `db push` and gets a clear pass/fail on migration safety and seed integrity. Contributors follow test-plan §6.5 for any new migration. Deploy-plan defines merge → review → push → smoke → Vercel ordering.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Fix missing seed.sql | Empty no-op file | Unblocks reset without duplicating migration INSERTs | Plan |
| Smoke implementation | Node script + `pg` | Reuses TS fixtures; cross-platform; user choice | Plan |
| CI scope | Local-only | Matches test-plan; Docker in CI deferred to Phase 4 | Plan / Research |
| Regions oracle | `expected-regions.ts` | Parity with `EXPECTED_CATALOG` pattern | Plan |
| Plant matching | By name + attributes, not UUID | DB uses `gen_random_uuid()` per reset | Research |
| Idempotent seeds | Not in scope | Archive documents reset-only workflow | Research |

## Scope

**In scope:**

- `supabase/seed.sql` (empty no-op)
- `scripts/migration-review.mjs` + `scripts/db-smoke.mjs`
- `src/test/fixtures/expected-regions.ts`
- npm scripts: `db:review`, `db:smoke`, `db:reset`, `db:verify`
- test-plan §6.5, Phase 3 row update, deploy-plan pre-prod gate
- Acknowledgment comments on existing destructive migrations

**Out of scope:**

- CI Supabase / Docker job
- Vitest live-DB tests
- Phase 2 RLS integration
- Idempotent `ON CONFLICT` seed refactors
- Renaming `playwright/tests/seed.spec.ts`

## Architecture / Approach

```
PR touches supabase/migrations/
  → npm run db:review          (static SQL scan)
  → npm run db:verify          (supabase db reset + db:smoke)
       → queries local Postgres via pg
       → asserts EXPECTED_REGIONS + EXPECTED_CATALOG
Pre-prod: review → db push → smoke → vercel deploy --prod
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Unblock reset & review | `seed.sql`, `migration-review.mjs`, `db:review` | False positives on existing DROP POLICY / DROP TABLE |
| 2. Fixtures & smoke | `expected-regions.ts`, `db-smoke.mjs`, `db:verify` | Fixture drift from migration SQL |
| 3. Docs sync | §6.5 cookbook, deploy-plan gate, test-plan row | Docs out of date if scripts change without §6.5 update |

**Prerequisites:** Docker, `npx supabase start`, Node 22
**Estimated effort:** ~1–2 sessions across 3 phases

## Open Risks & Assumptions

- Smoke assumes default local Postgres URL on port 54322; override via `DATABASE_URL`
- Review script is heuristic — cannot replace human judgment on data migrations
- `pg` adds one devDependency; acceptable for local-only tooling

## Success Criteria (Summary)

- `npm run db:verify` passes on clean local stack
- `npm run db:review` catches unacknowledged destructive SQL
- §6.5 tells contributors exactly what to run when adding migrations
