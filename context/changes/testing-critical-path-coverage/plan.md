# Critical-Path Coverage Implementation Plan

## Overview

Complete Phase 1 of `context/foundation/test-plan.md`: close remaining unit and integration test gaps for risks **#1** (auth gating), **#2** (plant catalog completeness), and **#6** (harvest date calculation). Vitest is already bootstrapped with 11 test files — this plan finishes partial coverage using the established `vi.mock` handler-import pattern and documents patterns in test-plan §6.

## Current State Analysis

Phase 1 is **partially implemented**. Existing infrastructure:

- Vitest config with `happy-dom`, `@/` alias, Astro virtual module mocks (`vitest.config.ts`, `src/test/setup.ts`, `src/test/mocks/astro-virtual.ts`)
- Scripts: `npm run test`, `npm run test:run`
- 11 test files under `src/test/` covering middleware (3 of 7 prefixes), auth error paths, plantings POST, plantings PATCH/DELETE, admin 403, plant service query shape, harvest unit math, FieldGrid basic render

**Gaps identified by research:**

| Risk | Gap |
| --- | --- |
| #1 | Middleware: missing 4 prefixes, authed pass-through, `locals.user`, public routes, `createClient` null |
| #1 | Auth success paths (signin → `/`, signup → confirm-email, signout) with cookie writes |
| #1 | `GET /api/plantings` untested; `POST /api/fields` has no test file |
| #2 | No catalog completeness assertion against seed data; pending exclusion not verified at result level |
| #6 | Missing `growth_days = null` case; no cross-check against seed catalog attributes |

**Constraints:**

- `/api/fields` stays **outside** `PROTECTED_ROUTES` — handler returns 401 JSON, not 302 redirect (intentional dual semantics)
- No `/api/plants` endpoint — catalog tests belong at service layer with mocked Supabase responses
- MSW deferred; continue `vi.mock` on `@/lib/supabase` and service modules
- Live Supabase RLS, CI test gate, Playwright unauth redirect — Phase 2–4 scope
- Test-plan terminology "growth category" maps to per-plant `growth_days` in code

### Key Discoveries:

- `src/middleware.ts:6-34` — seven `PROTECTED_ROUTES` prefixes; unauth → 302 redirect
- `src/pages/api/fields/index.ts:15-22` — handler-level 401 (not middleware-protected)
- `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:25-35` — 10 global seed plants with fixed attributes
- `src/lib/harvest.ts:3-10` — pure function: `seeding_date + growth_days`, `pl-PL` locale
- `src/test/lib/harvest.test.ts` — oracle-safe pattern (compute expected with same Date arithmetic)

## Desired End State

After this plan:

1. **Risk #1** — Middleware guards all seven prefixes; authenticated users pass through with `locals.user` set; public routes unaffected; auth endpoints prove success redirects and session cookie writes; `GET /api/plantings` and `POST /api/fields` cover 401, validation, and success paths.
2. **Risk #2** — `getPlants()` completeness verified against shared `EXPECTED_CATALOG` fixture mirroring migration seed; pending plants excluded from results.
3. **Risk #6** — `getHarvestDate` covers null `growth_days` and Tomato +70-day seed cross-check using fixture data.
4. **Cookbook** — `context/foundation/test-plan.md` §6.1–§6.4 documents concrete patterns for future contributors.
5. `npm run test:run` passes with zero failures locally.

**Verification:** Run `npm run test:run` and `npm run lint`; manually spot-check that new tests follow existing handler-import conventions in `src/test/api/plantings-index.test.ts`.

## What We're NOT Doing

- Adding `/api/fields` to `PROTECTED_ROUTES` or changing production auth behavior
- Setting up MSW (deferred to Phase 2 integration work)
- Live Supabase / RLS integration tests (Phase 2 — Risk #4)
- CI wiring for `npm run test:run` (Phase 4)
- Playwright E2E for unauth redirect (Phase 2+)
- Component-level harvest display tests in `FieldGrid` / `PlantingDialog`
- Admin plant-approval UI tests (test-plan §7 exclusion)
- Creating a `/api/plants` endpoint

## Implementation Approach

Four incremental phases, each ending with `npm run test:run`. Reuse existing test utilities:

- **API routes:** import handler directly, build minimal `APIContext` stub, mock `@/lib/supabase` + services
- **Middleware:** mock `createClient`, assert `redirect` vs `next()`, check `context.locals.user`
- **Services:** chainable Supabase builder mock (`makeQueryBuilder` pattern from `plants.test.ts`)
- **Harvest oracle:** compute expected date with same `Date` arithmetic + `toLocaleDateString("pl-PL")`

Extract shared helpers where duplication would otherwise grow (e.g., middleware context factory, API context factory) — only if a phase introduces three or more similar stubs.

## Phase 1: Auth Middleware & Success Paths

### Overview

Expand middleware coverage to the full route matrix and add auth endpoint success paths with cookie write verification.

### Changes Required:

#### 1. Middleware route matrix

**File**: `src/test/middleware.test.ts`

**Intent**: Cover every `PROTECTED_ROUTES` prefix for unauthenticated redirect, authenticated pass-through, and `locals.user` population. Add cases for public routes and `createClient` returning null.

**Contract**: Tests exercise `onRequest` from `src/middleware.ts` against all seven — `/dashboard`, `/admin`, `/api/admin`, `/api/weather`, `/api/user-preferences`, `/api/geocoding-suggestions`, `/api/plantings`. Unauthenticated protected → `redirect("/auth/signin")`, `next` not called. Authenticated → `next` called, `locals.user` equals mock user. Public route (e.g. `/` or `/api/auth/signin`) → `next` called regardless of auth. `createClient` null → `locals.user = null`, protected routes still redirect.

#### 2. Signin success path

**File**: `src/test/api/signin.test.ts`

**Intent**: Prove successful login redirects to `/` and that Supabase SSR cookie writes occur via the client's `setAll` callback.

**Contract**: Mock `signInWithPassword` resolving `{ error: null }`. Pass `cookies: { set: vi.fn() }` in context. Assert `redirect("/")` and verify `createClient` was invoked with headers + cookies (cookie adapter receives session tokens through `@supabase/ssr` `setAll` — assert `cookies.set` called when mock client simulates setAll behavior, matching how `createClient` in `src/lib/supabase.ts` wires `setAll` → `cookies.set`).

#### 3. Signup success path

**File**: `src/test/api/signup.test.ts`

**Intent**: Prove successful signup redirects to `/auth/confirm-email` with cookie write verification.

**Contract**: Mock `signUp` resolving `{ error: null }`. Assert redirect target and cookie side effects using same pattern as signin.

#### 4. Signout success path

**File**: `src/test/api/signout.test.ts`

**Intent**: Prove signout calls `auth.signOut()` and redirects to `/`.

**Contract**: Mock `signOut` resolving successfully. Assert `signOut` called once and `redirect("/")`.

### Success Criteria:

#### Automated Verification:

- `npm run test:run -- src/test/middleware.test.ts src/test/api/signin.test.ts src/test/api/signup.test.ts src/test/api/signout.test.ts` passes
- `npm run lint` passes on edited test files

#### Manual Verification:

- New middleware tests read clearly — each protected prefix has an explicit unauth case
- Auth success tests verify behavior beyond redirect-only (cookie or signOut invocation)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Handler Gaps

### Overview

Add missing handler-level auth tests for plantings GET and fields POST. Document dual auth semantics in test comments.

### Changes Required:

#### 1. GET /api/plantings tests

**File**: `src/test/api/plantings-index.test.ts`

**Intent**: Extend existing POST tests with GET coverage for Risk #1 authenticated access to own resources.

**Contract**: Import `GET` from `src/pages/api/plantings/index.ts`. Cases: (a) no `locals.user` → 401 JSON, (b) missing/invalid `field_id` query param → 400, (c) authenticated + valid `field_id` → 200 with mocked `getPlantingsByField` result, (d) `createClient` null → 503. Reuse `makeContext` pattern; add GET-specific helper with URL search params.

#### 2. POST /api/fields test file

**File**: `src/test/api/fields-index.test.ts` (new)

**Intent**: Cover fields API auth and validation — the canonical example of handler-only 401 outside middleware protection.

**Contract**: Import `POST` from `src/pages/api/fields/index.ts`. Cases: (a) no `locals.user` → 401 JSON (not redirect — add comment referencing dual semantics), (b) invalid JSON → 400, (c) schema validation failures (empty name, cols/rows out of range, invalid UUID) → 400 with field errors, (d) authenticated success → 201 with `{ id }` from mocked `createField`, (e) `createClient` null → 503. Mock `@/lib/services/fields`.

#### 3. Dual auth semantics comment

**File**: `src/test/api/fields-index.test.ts` (header comment)

**Intent**: Document for future contributors why fields returns 401 while `/api/plantings` unauth at middleware layer would redirect.

**Contract**: Brief comment block referencing `PROTECTED_ROUTES` in `src/middleware.ts` and intentional handler-only guard on `/api/fields`.

### Success Criteria:

#### Automated Verification:

- `npm run test:run -- src/test/api/plantings-index.test.ts src/test/api/fields-index.test.ts` passes
- `npm run lint` passes

#### Manual Verification:

- GET plantings tests mirror POST test structure (same mock patterns, readable context helpers)
- Fields 401 test explicitly documents JSON 401 vs middleware 302 distinction

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Catalog & Harvest Coverage

### Overview

Add shared seed catalog fixture and completeness tests for Risk #2; extend harvest unit tests for Risk #6 edge cases and seed cross-check.

### Changes Required:

#### 1. Expected catalog fixture

**File**: `src/test/fixtures/expected-catalog.ts` (new)

**Intent**: Single source of truth for the 10 global seed plants, mirroring migration `20260609000000_plants_scope_drop_requests.sql`.

**Contract**: Export `EXPECTED_CATALOG` array of objects with at minimum `name`, `growth_days`, `watering_needs`, and generated stable `id` fields for test use. Values must match migration seed: Tomato (70/high), Carrot (75/medium), Potato (90/medium), Onion (100/low), Lettuce (45/high), Cucumber (60/high), Pepper (80/medium), Beet (60/medium), Zucchini (55/medium), Garlic (240/low).

#### 2. Catalog completeness tests

**File**: `src/test/lib/plants.test.ts`

**Intent**: Prove `getPlants()` returns complete catalog with correct attributes and excludes pending plants.

**Contract**: New describe block using `EXPECTED_CATALOG`. Mock Supabase to return full catalog plus one pending plant. Assert: result length equals 10; every expected name present with matching `growth_days` and `watering_needs`; no result has `status = 'pending'`. Existing query-shape tests remain unchanged.

#### 3. Harvest edge cases and seed cross-check

**File**: `src/test/lib/harvest.test.ts`

**Intent**: Close Risk #6 gaps without component tests.

**Contract**: Add cases: (a) matched plant with `growth_days: null` → `"–"`, (b) Tomato from `EXPECTED_CATALOG` with `growth_days: 70` and seeding date `2026-05-01` — expected computed via same Date arithmetic oracle pattern. Optionally import Tomato attributes from fixture for DRY cross-check with Risk #2.

### Success Criteria:

#### Automated Verification:

- `npm run test:run -- src/test/fixtures/expected-catalog.ts src/test/lib/plants.test.ts src/test/lib/harvest.test.ts` passes
- `npm run lint` passes

#### Manual Verification:

- `EXPECTED_CATALOG` values manually compared against migration SQL (10 plants, correct attributes)
- Harvest Tomato test uses oracle computation, not hard-coded locale string

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Cookbook & Close-Out

### Overview

Document test patterns in test-plan §6, run full suite, update change metadata.

### Changes Required:

#### 1. Cookbook §6.1 — unit test pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.1 TBD with guidance for pure-function and service-layer unit tests.

**Contract**: Document: file location (`src/test/lib/`), Supabase builder mock pattern, `EXPECTED_CATALOG` fixture usage, harvest oracle anti-pattern avoidance.

#### 2. Cookbook §6.2 — integration test pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.2 TBD with handler-import integration pattern (no live Supabase in Phase 1).

**Contract**: Document: direct handler import, `APIContext` stub shape, `vi.mock` on supabase + services, asserting status/body.

#### 3. Cookbook §6.3 — e2e placeholder

**File**: `context/foundation/test-plan.md`

**Intent**: Note e2e remains Phase 2+; reference existing Playwright setup paths without expanding scope.

**Contract**: Brief pointer to `playwright/` directory\Phase 2 timing; keep section short.

#### 4. Cookbook §6.4 — new API endpoint tests

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.4 TBD with checklist for new API route tests.

**Contract**: Checklist: 401 unauth, validation 400, success path, 503 when supabase null, mock service layer, reference `fields-index.test.ts` and `plantings-index.test.ts` as templates.

#### 5. Phase 1 rollout note

**File**: `context/foundation/test-plan.md` §6.6

**Intent**: Append 2–3 line note capturing Phase 1 completion and key learnings (dual auth semantics, fixture approach).

**Contract**: Note under §6.6 per test-plan convention.

#### 6. Change status update

**File**: `context/changes/testing-critical-path-coverage/change.md`

**Intent**: Mark change as implemented after all phases complete.

**Contract**: Set `status: implemented`, update `updated` date. (Orchestrator or `/10x-implement` may refine status further.)

#### 7. Test-plan Phase 1 status

**File**: `context/foundation/test-plan.md` §3

**Intent**: Update Phase 1 row status from `change opened` to reflect plan completion / implementation progress.

**Contract**: Status column update when implementation lands.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` passes (full suite)
- `npm run lint` passes

#### Manual Verification:

- §6.1–§6.4 contain actionable examples referencing real files in this repo
- §6.6 note reflects dual auth semantics and fixture decision
- No TBD placeholders remain in §6.1–§6.4

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Middleware matrix (7 prefixes + public + null client)
- Auth success paths with cookie/signOut verification
- `getPlants` catalog completeness and pending exclusion
- `getHarvestDate` null growth_days and seed cross-check

### Integration Tests:

- `GET /api/plantings` auth and validation
- `POST /api/fields` auth, validation, success (handler-only 401 pattern)

### Manual Testing Steps:

1. Run `npm run test:run` — confirm all tests green
2. Skim new test files for readability and consistency with existing patterns
3. Compare `EXPECTED_CATALOG` against migration SQL manually once
4. Verify test-plan §6 reads coherently for a developer adding their first test

## Performance Considerations

All tests use mocks — no network or database I/O. Full suite should remain under ~30 seconds locally. No performance-sensitive production code changes.

## Migration Notes

No schema or production code changes. If migration seed plants change in a future PR, update `src/test/fixtures/expected-catalog.ts` in the same PR.

## References

- Research: `context/changes/testing-critical-path-coverage/research.md`
- Test plan: `context/foundation/test-plan.md`
- Middleware: `src/middleware.ts:6-34`
- Seed catalog: `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:25-35`
- Existing API test template: `src/test/api/plantings-index.test.ts`
- Harvest oracle pattern: `src/test/lib/harvest.test.ts:43-48`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Auth Middleware & Success Paths

#### Automated

- [x] 1.1 `npm run test:run -- src/test/middleware.test.ts src/test/api/signin.test.ts src/test/api/signup.test.ts src/test/api/signout.test.ts` passes
- [x] 1.2 `npm run lint` passes on edited test files

#### Manual

- [x] 1.3 New middleware tests cover all seven protected prefixes with explicit unauth cases
- [x] 1.4 Auth success tests verify cookie writes or signOut invocation, not redirect-only

### Phase 2: API Handler Gaps

#### Automated

- [x] 2.1 `npm run test:run -- src/test/api/plantings-index.test.ts src/test/api/fields-index.test.ts` passes
- [x] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 GET plantings tests follow existing POST mock patterns
- [ ] 2.4 Fields 401 test documents JSON 401 vs middleware 302 distinction

### Phase 3: Catalog & Harvest Coverage

#### Automated

- [x] 3.1 `npm run test:run -- src/test/fixtures/expected-catalog.ts src/test/lib/plants.test.ts src/test/lib/harvest.test.ts` passes
- [x] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 `EXPECTED_CATALOG` matches migration seed (10 plants, correct attributes)
- [ ] 3.4 Harvest Tomato test uses oracle computation, not hard-coded date string

### Phase 4: Cookbook & Close-Out

#### Automated

- [ ] 4.1 `npm run test:run` passes (full suite)
- [ ] 4.2 `npm run lint` passes

#### Manual

- [ ] 4.3 §6.1–§6.4 contain actionable examples referencing real repo files
- [ ] 4.4 §6.6 note captures dual auth semantics and fixture approach
