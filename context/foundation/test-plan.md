# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-17

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/migrations/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                       | Impact | Likelihood | Source (evidence — not anchor)                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Auth regression blocks garden access — a route guard or RLS change blocks legitimate users from their own field/planting data | High   | Medium     | interview Q1; PRD US-01; hot-spot `src/components/auth/` (6 hits/30d), `src/pages/api/auth/` (3 hits/30d) |
| 2   | Plant catalog silently incomplete — missing or incorrect plant entries cause wrong harvest estimates or missing plant options | High   | Medium     | interview Q2; PRD FR-014, FR-015; roadmap S-05, S-03                                                      |
| 3   | Weather sync breaks silently — Open-Meteo fetch fails or logic regresses, leaving users with stale or no weather data         | High   | Medium     | interview Q3; PRD FR-007–FR-010; roadmap S-01, F-02; hot-spot `src/lib/services/` (9 hits/30d)            |
| 4   | IDOR on field/planting data — User A reads or modifies User B's resources because RLS policy is missing or too permissive     | High   | Medium     | abuse/security lens; PRD auth + FR-001, FR-002                                                            |
| 5   | DB migration corrupts existing records — schema change drops column, alters type unsafely, or breaks existing rows            | High   | Low-Medium | roadmap F-01; hot-spot `supabase/migrations/` (active)                                                    |
| 6   | Incorrect harvest date calculation — wrong growth category mapping leads to misleading harvest estimates for the user         | Medium | Medium     | PRD FR-011; roadmap S-03                                                                                  |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                     | Must challenge                                                                                     | Context `/10x-research` must ground                                                                              | Likely cheapest layer        | Anti-pattern to avoid                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| #1   | Authenticated user's request to own resource returns 200; unauthenticated request returns 401/redirect; another user's resource returns 403/404 | "Happy-path login works" does not mean "protected access or ownership checks work"                 | Entry point (middleware, API route), auth session shape, RLS policy on fields + plantings tables                 | Integration                  | Over-mocking auth — test with real cookie/session shape                       |
| #2   | Plant catalog endpoint returns all expected entries; harvest date calc uses correct growth category for each plant                              | "Response is 200" does not mean "all plant entries and attributes are present"                     | Plant catalog seed data, admin approval flow, plant data fields (growth category, watering needs, harvest ratio) | Unit + Integration           | Happy-path only — test missing entries, partial catalog, incorrect categories |
| #3   | Weather data fetch returns expected fields; stale data is flagged; failed fetch doesn't corrupt existing records                                | "Retry succeeded because final status is 200" does not mean "correct data was returned and stored" | Open-Meteo API contract, nightly job entry point, weather_records schema, error/fallback handling                | Integration                  | Over-mocking external API — use real Open-Meteo response fixtures             |
| #4   | User A's request to resource owned by User B returns 403/404, not the data                                                                      | "User is logged in" does not mean "this resource belongs to them"                                  | RLS policies on fields and plantings tables, auth session shape, resource ownership mapping                      | Integration                  | Testing only happy-path with own resources                                    |
| #5   | Migration applies cleanly against a copy of existing data; existing rows remain queryable after rollback/reapply                                | "Migration passed in CI" does not mean "it handles existing data safely"                           | Migration SQL files, current seed data shape, target table schemas                                               | Manual smoke + review script | Skipping because "migrations are reviewed in PR"                              |
| #6   | Harvest date = seeding date + growth period (per plant category) produces correct estimated date                                                | "Calculation ran without error" does not mean "the estimate is biologically reasonable"            | Plant growth category mapping, seeding date input, harvest date output formula                                   | Unit                         | Copying calculation logic into assertion (oracle problem)                     |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                   | Goal (one line)                                                                    | Risks covered | Test types                   | Status        | Change folder                                   |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- | ------------- | ---------------------------- | ------------- | ----------------------------------------------- |
| 1   | Critical-path coverage       | Bootstrap Vitest; defend auth gating, catalog completeness, and harvest date logic | #1, #2, #6    | unit + integration           | implemented   | context/changes/testing-critical-path-coverage/ |
| 2   | Integration around hot-spots | Catch regressions in weather sync and auth/RLS data-boundary checks                | #3, #4        | integration (Supabase local) | not started   | —                                               |
| 3   | Data integrity               | Migration dry-run review + smoke tests against seed data                           | #5            | manual smoke + review script | not started   | —                                               |
| 4   | Quality-gates wiring         | Wire unit + integration tests into CI; enforce on PR                               | cross-cutting | CI gates                     | not started   | —                                               |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session. If a useful docs
or search MCP such as Context7 or Exa.ai is not available, say that instead
of assuming access.

| Layer                     | Tool                                 | Version | Notes                                                                                     |
| ------------------------- | ------------------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| unit + integration        | Vitest                               | latest  | Bootstrap in Phase 1; Astro project uses Vite, so Vitest is the natural fit               |
| API mocking               | MSW                                  | latest  | Mock Supabase and Open-Meteo at the HTTP edge                                             |
| e2e                       | Playwright                           | latest  | Not planned before Phase 4; only if integration coverage has gaps                         |
| accessibility             | axe-core                             | latest  | Not planned before Phase 4                                                                |
| (optional) AI-native      | Playwright MCP — checked: 2026-06-02 | n/a     | Not currently recommended — deterministic integration tests cover top risks at lower cost |
| (optional) Post-edit hook | per-agent hook system                | n/a     | Not planned before Phase 4                                                                |

**Stack grounding tools (current session):**

- Docs: none — no framework docs MCP (Context7 or equivalent) available in current session; checked: 2026-06-02
- Search: Exa.ai — available for stack-sensitive discovery; checked: 2026-06-02
- Runtime/browser: none — no Playwright/browser MCP in current session; checked: 2026-06-02
- Provider/platform: Linear (issue tracking), GitHub (via `gh` CLI) — potential quality-gate relevance for issue linking and review; checked: 2026-06-02

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                  | Where                | Required?                 | Catches                       |
| --------------------- | -------------------- | ------------------------- | ----------------------------- |
| lint + typecheck      | local + CI           | required                  | syntactic / type drift        |
| unit + integration    | local + CI           | required after §3 Phase 1 | logic regressions             |
| e2e on critical flows | CI on PR             | planned after §3 Phase 2  | broken critical user paths    |
| pre-prod smoke        | between merge + prod | planned after §3 Phase 3  | environment-specific failures |
| post-edit hook        | local (agent loop)   | planned after §3 Phase 4  | regressions at edit time      |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

Place pure-function and service-layer tests under `src/test/lib/`, mirroring the source path (e.g. `src/lib/harvest.ts` → `src/test/lib/harvest.test.ts`).

**Supabase builder mock.** Service tests mock the Supabase client with a chainable query builder. Copy the `makeQueryBuilder` / `makeClient` pattern from `src/test/lib/plants.test.ts`: each chain method (`select`, `eq`, `order`, …) returns the builder; terminal methods (`single`, `overrideTypes`) or a `then` handler resolve the mocked `{ data, error }` payload.

**Catalog fixture.** For plant-catalog assertions, import `EXPECTED_CATALOG` from `src/test/fixtures/expected-catalog.ts`. This array mirrors the 10 global seed plants in `supabase/migrations/20260609000000_plants_scope_drop_requests.sql`. When migration seed data changes, update the fixture in the same PR.

**Harvest oracle.** For `getHarvestDate` (Risk #6), never hard-code a locale-formatted date string in the assertion. Compute the expected value with the same `Date` arithmetic and `toLocaleDateString("pl-PL")` call — see `src/test/lib/harvest.test.ts`. Importing `growth_days` from `EXPECTED_CATALOG` keeps catalog and harvest tests aligned.

Run scoped: `npm run test:run -- src/test/lib/<name>.test.ts`

### 6.2 Adding an integration test

Phase 1 integration tests import API route handlers directly — no live Supabase, no HTTP server. Place files under `src/test/api/` (e.g. `src/pages/api/plantings/index.ts` → `src/test/api/plantings-index.test.ts`).

**Handler import pattern.**

1. `vi.mock("@/lib/supabase")` and `vi.mock("@/lib/services/<domain>")` at the top.
2. Import the named export (`GET`, `POST`, …) from the route file.
3. Build a minimal `APIContext` stub with `request`, `cookies`, `locals`, and `url` (for GET with query params). See `makeContext` / `makeGetContext` in `src/test/api/plantings-index.test.ts`.
4. Mock `createClient` to return a client object (or `null` for 503 cases); mock service functions to return controlled data.
5. Call the handler, assert `response.status` and parse `response.json()` for body shape.

**Middleware tests** live at `src/test/middleware.test.ts`: mock `createClient`, stub `context` with `url`, `cookies`, `locals`, and assert `redirect` vs `next()` plus `locals.user` population.

Phase 2 will add live Supabase / RLS integration tests for Risks #3 and #4; until then, keep mocking at the service boundary.

Run scoped: `npm run test:run -- src/test/api/<name>.test.ts src/test/middleware.test.ts`

### 6.3 Adding an e2e test

E2E coverage is Phase 2+ scope (unauth redirect, critical user flows). Playwright is already bootstrapped:

- Config: `playwright.config.ts`
- Auth setup: `playwright/auth/auth.setup.ts`
- Specs: `playwright/tests/` (e.g. `dashboard.spec.ts`, `seed.spec.ts`)
- Quality rules: `playwright/tests/e2e-quality-rules.md`

Do not add e2e tests for risks already covered by unit/integration mocks unless the test-plan phase explicitly calls for browser-level verification. Prefer `/10x-e2e` when driving approved e2e phases.

### 6.4 Adding a test for a new API endpoint

Checklist for every new route under `src/pages/api/`:

1. **401 unauthenticated** — `locals.user` null → 401 JSON with `{ error: "Unauthorized" }` (or 302 redirect if the route is in `PROTECTED_ROUTES`; see dual-auth note below).
2. **400 validation** — invalid JSON, missing required fields, schema failures (assert status and error shape).
3. **Success path** — authenticated user, valid input → expected status (200/201) and response body from mocked service.
4. **503 unavailable** — `createClient` returns `null` → 503.
5. **Mock the service layer** — `vi.mock("@/lib/services/<domain>")`; assert the handler delegates correctly, not Supabase internals.
6. **Use existing templates** — `src/test/api/plantings-index.test.ts` (middleware-protected, GET + POST) and `src/test/api/fields-index.test.ts` (handler-only 401).

**Dual auth semantics.** Routes listed in `PROTECTED_ROUTES` (`src/middleware.ts`) redirect unauthenticated browser requests before the handler runs. Routes outside that list (e.g. `/api/fields`) rely on handler-level guards and return 401 JSON. Document the distinction in a header comment when adding tests for handler-only routes.

### 6.5 Adding a migration review / smoke test

TBD — see §3 Phase 3 (data integrity pattern).

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2-3 line note
here capturing anything surprising the rollout phase taught.)

**Phase 1 (critical-path coverage, 2026-06-17).** Auth has dual semantics: middleware-protected routes (`/api/plantings`, etc.) redirect unauthenticated requests, while `/api/fields` returns 401 JSON at the handler — both are intentional. Catalog completeness tests use a shared `EXPECTED_CATALOG` fixture instead of live DB queries; update it whenever migration seed plants change.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Internal admin plant-approval UI** — two trusted users, low blast radius. Re-evaluate if the admin surface extends beyond a single user or becomes self-service. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-02
- Stack versions last verified: 2026-06-02
- AI-native tool references last verified: 2026-06-02

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
