# Integration Hot-Spots Implementation Plan

## Overview

Complete Phase 2 of `context/foundation/test-plan.md`: add **live Supabase integration** and **Open-Meteo fixture** coverage for risks **#3** (weather sync breaks silently) and **#4** (IDOR on field/planting data). Phase 1 mocked handler tests and Phase 3 seed smoke remain in place — this change **complements** them, it does not replace them.

## Execution skills by phase

How to drive each phase with `/10x-implement`, `/10x-tdd`, or `/10x-e2e`:

| Phase | Driver skill | TDD (`/10x-tdd`) | E2E (`/10x-e2e`) | Notes |
| ----- | ------------ | ---------------- | ---------------- | ----- |
| 1 | `/10x-implement` | No — infra scaffolding | No | Config, helpers, fixture dirs; no failing-test entry point |
| 2 | `/10x-implement` | **Test-first loop** on assertions (red→green on tests); not `/10x-tdd` — `open-meteo.ts` and cron handler already exist | No | Write failing parse/cron tests before extending coverage |
| 3 | `/10x-implement` | **Test-first loop** on live DB assertions; not `/10x-tdd` — sync path already exists | No | Requires local Supabase + service role |
| 4 | `/10x-implement` | **Test-first loop** on RLS matrix; not `/10x-tdd` | No | Migration hardens `plantings` INSERT; two real user sessions |
| 5 | `/10x-e2e` | No | **Yes** — required | Browser-level SSR IDOR gap; documents current 500 UX without fixing SSR |
| 6 | `/10x-implement` | No | No | Cookbook + change close-out |

**Why not `/10x-tdd` as driver?** The `/10x-tdd` skill gates on *absent* production code. This rollout adds tests against shipped weather sync and RLS behavior. Use **test-first ordering inside `/10x-implement`** (write failing test → run → green) for phases 2–4. If a failing integration test exposes a production bug, fix production in the same phase via `/10x-implement` — do not retro-label as `/10x-tdd`.

**Why `/10x-e2e` for Phase 5?** Integration covers DB and API layers; Phase 5 proves the SSR boundary (`/dashboard/fields/[id]` on another user's id) in a real browser. E2E documents current 500/error UX on cross-user URL — production SSR fix stays out of scope.

## Current State Analysis

Phase 1 delivered Vitest with mocked handler imports (`src/test/api/`) and pure weather unit tests. Phase 3 delivered `db:smoke` / `db:verify` for **seed integrity only** (raw `pg`, bypasses RLS). **No live integration infrastructure exists.**

**Risk #3 gaps:**

- `getDailyWeather` / Open-Meteo parsing untested; no JSON fixtures on disk
- `cron-weather.test.ts` mocks `getDailyWeather`; no failure-path or DB round-trip tests
- Cron always returns HTTP 200 — tests must assert body `failed`/`fetched`, not status alone
- `astro:env/server` → `astro-virtual.ts` blocks real Supabase keys in default Vitest config

**Risk #4 gaps:**

- RLS on `fields` / `plantings` is authoritative for reads; handler 403 only on planting PATCH/DELETE
- No two-user session setup; Playwright auth provisions one user only
- `plantings` INSERT policy does not verify `field_id` ownership — **fix in Phase 4 migration** before live RLS tests
- Field detail SSR throws 500 on RLS miss (`src/pages/dashboard/fields/[id].astro`) — out of scope for production fix; Phase 5 E2E documents UX

### Key Discoveries:

- `src/pages/api/cron/weather.ts:34-61` — swallowed errors; empty Open-Meteo parse skips upsert without `failed++`
- `src/lib/services/open-meteo.ts:150-187` — `getDailyWeather` returns `[]` when `daily.time` missing
- `src/lib/services/weather.ts:83-142` — 36h `isRainfallStale` threshold drives dashboard watering gate
- `supabase/migrations/20260525000000_initial_schema.sql:100-171` — owner-scoped RLS on fields/plantings
- `vitest.config.ts:12-13` — `astro:env/server` mock alias must not apply to integration project
- `playwright/auth/auth.setup.ts` — service-role user provisioning pattern to extend for two test users

## Desired End State

After this plan:

1. **Risk #3** — Recorded Open-Meteo fixtures prove past-only parsing; cron failure paths assert no DB corruption and correct `failed` counts; live `weather_records` round-trip proves upsert idempotency and `getRainfall7dCalendarMm` stale/fresh flags against real rows.
2. **Risk #4** — Migration hardens `plantings` INSERT so User A cannot insert on User B's field; two-user live Supabase tests prove SELECT/UPDATE/DELETE boundaries; API handler tests with real sessions prove cross-tenant GET plantings returns `[]` and POST on B's field fails.
3. **Infrastructure** — `vitest.integration.config.ts`, `src/test/integration/helpers/supabase.ts`, `src/test/fixtures/open-meteo/`, `npm run test:integration` (skips gracefully when Supabase not running).
4. **Cookbook** — `context/foundation/test-plan.md` §6.2 updated with live integration patterns.
5. **E2E** — Playwright spec for cross-user field URL access via `/10x-e2e` (Phase 5); documents current SSR error behavior without fixing production.

**Verification:** `npm run test:run` (unit + mocked API) and `npm run test:integration` (with `npx supabase start`) both pass; `npm run lint` passes.

## What We're NOT Doing

- Replacing Phase 1 mocked handler tests — keep and extend `cron-weather.test.ts` mocked layer
- Adding MSW dependency — use recorded fixtures + `vi.stubGlobal("fetch")` for Open-Meteo
- Fixing field-detail 500-on-miss SSR behavior (Phase 5 E2E documents only)
- CI Supabase wiring (Phase 4 quality-gates change)
- E2E for weather stale badge (integration covers stale logic; browser adds cost without new signal)
- Testing legacy unused helpers in `weather.ts` (`getLatestWeather`, coord-based reads)
- Changing `PROTECTED_ROUTES` or production auth semantics

## Implementation Approach

Six phases: infrastructure first, then Risk #3 in two slices (fast mocked/parse → live DB), then Risk #4 (RLS migration + live two-user tests), required E2E for SSR boundary, cookbook close-out. Use **separate `vitest.integration.config.ts`** without `astro-virtual.ts` alias; integration files load real keys from `.env` (local Supabase). Gate `test:integration` on stack availability.

## Critical Implementation Details

Integration tests must **not** import route handlers through paths that pull `astro:env/server` before env is loaded — either load `dotenv` in a dedicated setup file listed first in the integration config, or use dynamic import after env bootstrap. Service-role client is required for weather cron writes and test data seeding; anon clients with user JWTs exercise RLS.

## Phase 1: Integration Test Infrastructure

### Overview

Scaffold the Vitest integration project, shared Supabase helpers, Open-Meteo fixture directory, and npm script. No behavioral tests yet — only the harness.

### Execution

| Driver | `/10x-implement` |
| TDD | No |
| E2E | No |

### Changes Required:

#### 1. Integration Vitest config

**File**: `vitest.integration.config.ts`

**Intent**: Run only `src/test/integration/**/*.test.ts` with real env keys; keep unit `vitest.config.ts` unchanged.

**Contract**: No `astro:env/server` → `astro-virtual.ts` alias. `include: ["src/test/integration/**/*.test.ts"]`. Optional `setupFiles` for dotenv + skip helper. `test.pool` / timeout generous enough for Supabase round-trips (e.g. 30s).

#### 2. Integration setup + skip helper

**File**: `src/test/integration/setup.ts`

**Intent**: Load `.env` before tests; expose `requireLocalSupabase()` that skips the file when `SUPABASE_URL` unreachable or `supabase status` fails.

**Contract**: Exported guard used at top of each integration spec; skipped tests do not fail CI when Supabase absent (local-only until Phase 4).

#### 3. Supabase test helpers

**File**: `src/test/integration/helpers/supabase.ts`

**Intent**: Service-role provisioning for two test users, sign-in to real sessions, seed/teardown fields/plantings/regions/weather rows.

**Contract**: `createTestUsers()`, `getClientForUser(user)`, `seedFieldForUser(user, ...)`, `teardownTestUsers()`, `createServiceRoleClient()` — pattern from `playwright/auth/auth.setup.ts` but two non-admin users with unique emails; teardown deletes owned rows then auth users.

#### 4. Open-Meteo fixture directory

**File**: `src/test/fixtures/open-meteo/README.md` (placeholder) + `warsaw-forecast.json`

**Intent**: Record one real Open-Meteo forecast response for Warsaw coords (`52.229676`, `21.012229`) used by Risk #3 tests.

**Contract**: Valid JSON with `daily.time`, `daily.temperature_2m_max`, `daily.precipitation_sum`; committed to repo; README notes capture date and URL.

#### 5. npm script

**File**: `package.json`

**Intent**: Add `test:integration` entry point.

**Contract**: `"test:integration": "vitest run --config vitest.integration.config.ts"` (or equivalent).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on new files
- `npm run test:run` still passes (unit suite unaffected)
- `npm run test:integration` runs and skips or passes when Supabase down (no hard fail)

#### Manual Verification:

- With `npx supabase start` and `.env` populated, `requireLocalSupabase()` does not skip
- Helper can create two users and return distinct authenticated clients

**Implementation Note**: After automated verification passes, confirm manual helper smoke before Phase 2.

---

## Phase 2: Weather Sync — Fixtures, Parse & Mocked Cron Hardening (Risk #3)

### Overview

Close fast-feedback gaps without live DB: Open-Meteo parsing against recorded fixtures, extend mocked cron tests for failure paths and HTTP-200-vs-body contract.

### Execution

| Driver | `/10x-implement` |
| TDD | Test-first loop on test assertions (red→green); not `/10x-tdd` |
| E2E | No |

### Changes Required:

#### 1. Open-Meteo parse tests

**File**: `src/test/lib/open-meteo.test.ts`

**Intent**: Prove `getDailyWeather` maps fixture fields, excludes today/forecast days (past-only window), handles null precip, returns `[]` on missing `daily.time`.

**Contract**: `vi.stubGlobal("fetch")` returns `warsaw-forecast.json`; assert array length, date strings, `temperatureC`/`rainfallMm` mapping. No live HTTP.

#### 2. Extend cron mocked failure tests

**File**: `src/test/api/cron-weather.test.ts`

**Intent**: Cover Risk #3 silent-failure vectors without live DB.

**Contract**: New cases — `getDailyWeather` throw → `failed` incremented, no upsert; empty array → no upsert (document silent skip); all regions fail → still HTTP 200 with `failed === locations`; assert upsert payload shape unchanged on throw (capture `_upsertCalls`).

#### 3. getWeather live-widget parse (optional thin)

**File**: `src/test/lib/open-meteo.test.ts` (same file)

**Intent**: One test that `getWeather` parses current + 7-day rain from fixture subset.

**Contract**: Fetch stub; no DB writes.

### Success Criteria:

#### Automated Verification:

- `npm run test:run -- src/test/lib/open-meteo.test.ts src/test/api/cron-weather.test.ts` passes
- `npm run lint` passes

#### Manual Verification:

- Fixture JSON matches current Open-Meteo response shape (re-record if API schema drifted)

**Implementation Note**: Pause for manual confirmation before Phase 3 live DB work.

---

## Phase 3: Weather Sync — Live DB Integration (Risk #3)

### Overview

Prove cron upsert and rainfall read paths against real `weather_records` with service role + stubbed Open-Meteo fetch.

### Execution

| Driver | `/10x-implement` |
| TDD | Test-first loop on live DB assertions; not `/10x-tdd` |
| E2E | No |

### Changes Required:

#### 1. Cron live upsert integration

**File**: `src/test/integration/weather-cron.test.ts`

**Intent**: Call `GET` handler from `src/pages/api/cron/weather.ts` with real `createServiceRoleClient`, stubbed `fetch` returning fixture, seeded test region row.

**Contract**: After handler — rows exist in `weather_records` with expected `region_id`, `recorded_at`, `rainfall_mm`; re-run handler → upsert updates on conflict, no duplicate count. Pre-seed rows → stub fetch throw → row count unchanged, response `failed > 0`.

#### 2. Rainfall stale live read integration

**File**: `src/test/integration/weather-rainfall.test.ts`

**Intent**: Prove `getRainfall7dCalendarMm` against seeded 7-day window with real anon/authenticated client.

**Contract**: Seed 7 days via service role → `rainfallStale: false`, correct sum. Backdate latest `recorded_at` beyond 36h → `rainfallStale: true`; dashboard-equivalent gate: stale hides watering sum.

#### 3. Env for cron secret in integration

**File**: `vitest.integration.config.ts` or integration setup

**Intent**: Integration tests use real `CRON_SECRET` from `.env` (not `astro-virtual.ts` fake).

**Contract**: Cron auth test in integration file sends `Authorization: Bearer <real secret>`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration -- src/test/integration/weather-cron.test.ts src/test/integration/weather-rainfall.test.ts` passes with local Supabase
- `npm run test:run` still passes
- `npm run lint` passes

#### Manual Verification:

- Inspect `weather_records` after test run — test teardown leaves no orphan rows for test region/users

**Implementation Note**: Pause for manual DB cleanup check before Phase 4.

---

## Phase 4: RLS Data Boundaries — Migration + Live Two-User Integration (Risk #4)

### Overview

Harden `plantings` INSERT policy so User A cannot plant on User B's field, then prove User A cannot access User B's fields/plantings via real Supabase clients and API handlers with real session cookies.

### Execution

| Driver | `/10x-implement` |
| TDD | Test-first loop on RLS matrix; not `/10x-tdd` |
| E2E | No |

### Changes Required:

#### 1. Plantings INSERT RLS migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_harden_plantings_insert_rls.sql`

**Intent**: Replace `plantings_insert_owner` policy so INSERT requires both `user_id = auth.uid()` **and** `field_id` references a field owned by the caller.

**Contract**: `WITH CHECK` includes `EXISTS (SELECT 1 FROM fields f WHERE f.id = field_id AND f.user_id = auth.uid())`. Run `npm run db:review` before commit. Apply locally via `npx supabase db reset` or migration up before integration tests.

#### 2. Service-layer RLS matrix

**File**: `src/test/integration/rls-fields-plantings.test.ts`

**Intent**: Direct `getFieldById`, `getPlantingsByField`, update/delete via user A's client against user B's seeded data.

**Contract**: Scenarios 1–3, 6–7 from research — SELECT B's field → null/error; plantings for B's field → `[]`; UPDATE/DELETE → 0 rows; INSERT planting on B's field with A's user_id → **blocked** (RLS violation / 0 rows); UPDATE own field `user_id` to B → blocked.

#### 3. API handler cross-tenant tests

**File**: `src/test/integration/api-plantings-rls.test.ts`

**Intent**: Import handlers with real Supabase SSR client built from user A's cookies; seed data as user B.

**Contract**: `GET /api/plantings?field_id=<B>` → 200 + `[]`. `POST` planting on B's field → non-201 (RLS/policy error). `PATCH/DELETE` B's planting id → 404 (RLS hides) or 403 (handler). Use minimal `APIContext` with real cookie jar from `createServerClient` pattern.

#### 4. Fields API cross-tenant

**File**: `src/test/integration/api-fields-rls.test.ts`

**Intent**: User A `POST /api/fields` sets own `user_id`; no cross-tenant read endpoint exists — document via service-layer test only.

**Contract**: At minimum assert `createField` as A cannot read B's field by id in same file or rls test.

### Success Criteria:

#### Automated Verification:

- `npm run db:review` passes on new migration
- `npm run test:integration -- src/test/integration/rls-fields-plantings.test.ts src/test/integration/api-plantings-rls.test.ts` passes with local Supabase (after migration applied)
- `npm run test:run` passes
- `npm run lint` passes

#### Manual Verification:

- `npm run db:verify` still passes after migration (seed integrity unchanged)
- Confirm INSERT on B's field fails at DB layer with migration applied

**Implementation Note**: Pause before Phase 5 E2E.

---

## Phase 5: E2E — Dashboard Field URL IDOR (Risk #4 SSR)

### Overview

Browser-level proof that navigating to another user's field id does not leak data in the rendered page. Documents current SSR error behavior (500 or error state) without fixing production.

### Execution

| Driver | `/10x-e2e` |
| TDD | No |
| E2E | **Yes** — required |

### Changes Required:

#### 1. Two-user Playwright fixture

**File**: `playwright/auth/two-users.setup.ts` (or extend existing setup)

**Intent**: Provision user A and user B; save `storageState` for A; service-role seed B's field; expose B's field id to spec.

**Contract**: Follow `playwright/tests/e2e-quality-rules.md`; unique emails; teardown after spec.

#### 2. Cross-user field URL spec

**File**: `playwright/tests/field-idor.spec.ts`

**Intent**: Authenticated as A, navigate to `/dashboard/fields/<B-field-id>`; assert no B field name/planting content visible; assert safe outcome (error state or redirect — document current 500 if still present without fixing production).

**Contract**: `getByRole` / `getByText` only; no `waitForTimeout`; ties to Risk #4 user concern.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e -- playwright/tests/field-idor.spec.ts` passes with dev server + Supabase
- `npm run lint` passes on new Playwright files

#### Manual Verification:

- Deliberate break: temporarily weaken RLS in local branch — E2E should fail (verify risk signal)

**Implementation Note**: Required phase — do not skip in Progress.

---

## Phase 6: Cookbook & Change Close-Out

### Overview

Document live integration patterns in test-plan §6.2, add §6.6 phase note, sync change metadata.

### Execution

| Driver | `/10x-implement` |
| TDD | No |
| E2E | No |

### Changes Required:

#### 1. test-plan §6.2 live integration cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace "Phase 2 will add…" with concrete steps: `test:integration`, helper imports, two-user pattern, Open-Meteo fixtures, when to use unit vs integration.

**Contract**: §6.2 describes handler-import mocks (Phase 1) **and** live Supabase integration (Phase 2); §6.6 appends 2–3 line rollout note.

#### 2. Change status

**File**: `context/changes/testing-integration-hotspots/change.md`

**Intent**: Mark change implemented after all required phases complete.

**Contract**: `status: implemented`, `updated` set to completion date.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` passes
- `npm run test:integration` passes (with Supabase) or documents skip
- `npm run lint` passes

#### Manual Verification:

- §6.2 readable by contributor adding a new RLS integration test
- Phase 5 E2E complete and recorded in §6.6 note

**Implementation Note**: Final human sign-off before archive/Phase 4 CI change.

---

## Testing Strategy

### Unit Tests (Phase 2):

- Open-Meteo parse edge cases with fixtures
- Cron mocked failure paths

### Integration Tests (Phases 3–4):

- Weather cron upsert idempotency and failure non-corruption
- Rainfall stale flags on live rows
- Two-user RLS matrix + API cross-tenant handlers

### E2E Tests (Phase 5, required):

- Cross-user dashboard field URL — documents SSR error UX, asserts no data leak

### Manual Testing Steps:

1. `npx supabase start` + copy keys to `.env`
2. `npm run test:integration` — full integration suite green
3. `npm run db:verify` — seed smoke still passes (no regression)
4. Required: `npm run test:e2e` for field-idor spec

## Performance Considerations

Integration tests are local-only and gated; keep per-file row counts small. Teardown must run in `afterAll` to avoid polluting local DB. Do not run integration suite in default `test:run` — preserves fast unit loop.

## Migration Notes

Phase 4 adds one RLS policy migration hardening `plantings` INSERT — field must belong to caller. Run `npm run db:review` and `npm run db:verify` after applying. If integration tests surface additional RLS gaps, open a **separate** change rather than expanding scope here.

## References

- Research: `context/changes/testing-integration-hotspots/research.md`
- Test plan: `context/foundation/test-plan.md` §3 Phase 2, §2 Risks #3–#4
- Phase 1 plan: `context/archive/2026-06-15-testing-critical-path-coverage/plan.md`
- E2E rules: `playwright/tests/e2e-quality-rules.md`
- Progress format: `.claude/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Integration Test Infrastructure

#### Automated

- [ ] 1.1 `npm run lint` passes on new integration files
- [ ] 1.2 `npm run test:run` still passes (unit suite unaffected)
- [ ] 1.3 `npm run test:integration` runs without hard fail when Supabase down

#### Manual

- [ ] 1.4 Local Supabase up — helpers create two users and return authenticated clients

### Phase 2: Weather Sync — Fixtures, Parse & Mocked Cron Hardening (Risk #3)

#### Automated

- [ ] 2.1 `npm run test:run -- src/test/lib/open-meteo.test.ts src/test/api/cron-weather.test.ts` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Open-Meteo fixture JSON matches live API shape

### Phase 3: Weather Sync — Live DB Integration (Risk #3)

#### Automated

- [ ] 3.1 `npm run test:integration -- src/test/integration/weather-cron.test.ts src/test/integration/weather-rainfall.test.ts` passes with local Supabase
- [ ] 3.2 `npm run test:run` passes
- [ ] 3.3 `npm run lint` passes

#### Manual

- [ ] 3.4 Test teardown leaves no orphan weather_rows for test regions

### Phase 4: RLS Data Boundaries — Migration + Live Two-User Integration (Risk #4)

#### Automated

- [ ] 4.1 `npm run db:review` passes on plantings INSERT migration
- [ ] 4.2 `npm run test:integration -- src/test/integration/rls-fields-plantings.test.ts src/test/integration/api-plantings-rls.test.ts` passes with local Supabase
- [ ] 4.3 `npm run test:run` passes
- [ ] 4.4 `npm run lint` passes

#### Manual

- [ ] 4.5 `npm run db:verify` passes after migration
- [ ] 4.6 INSERT planting on B's field blocked at DB layer

### Phase 5: E2E — Dashboard Field URL IDOR (Risk #4 SSR)

#### Automated

- [ ] 5.1 `npm run test:e2e -- playwright/tests/field-idor.spec.ts` passes
- [ ] 5.2 `npm run lint` passes on Playwright files

#### Manual

- [ ] 5.3 Deliberate RLS weaken causes E2E failure (risk signal check)

### Phase 6: Cookbook & Change Close-Out

#### Automated

- [ ] 6.1 `npm run test:run` passes
- [ ] 6.2 `npm run test:integration` passes or skip documented
- [ ] 6.3 `npm run lint` passes

#### Manual

- [ ] 6.4 test-plan §6.2 readable for new integration tests
- [ ] 6.5 Phase 5 E2E complete in §6.6
