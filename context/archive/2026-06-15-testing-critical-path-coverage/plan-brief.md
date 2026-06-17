# Critical-Path Coverage — Plan Brief

> Full plan: `context/changes/testing-critical-path-coverage/plan.md`
> Research: `context/changes/testing-critical-path-coverage/research.md`

## What & Why

Phase 1 of the test rollout closes gaps in critical-path coverage for three risks: auth gating (#1), plant catalog completeness (#2), and harvest date calculation (#6). Vitest is already bootstrapped with 11 test files — this plan finishes the remaining unit and integration tests using established mock patterns, then documents those patterns in the test-plan cookbook.

## Starting Point

Existing tests cover middleware for 3 of 7 protected routes, auth error paths, plantings POST/PATCH/DELETE, admin 403, plant service query shape, and five harvest unit cases. Gaps include middleware pass-through, auth success paths, GET plantings, POST fields, catalog completeness against seed data, and harvest null `growth_days`. MSW is not configured; CI runs lint + build only.

## Desired End State

All Phase 1 risks have automated coverage: full middleware matrix, auth success with cookie verification, API handler gaps filled, catalog verified against a shared fixture mirroring migration seed, harvest edge cases covered at unit layer. `npm run test:run` passes locally. Test-plan §6.1–§6.4 documents concrete patterns for future test authors.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| `/api/fields` auth | Keep handler-only 401 | No production change; tests document dual semantics vs middleware redirect | Plan |
| Catalog fixture | Shared `EXPECTED_CATALOG` in `src/test/fixtures/` | Single test source of truth reusable across plants and harvest tests | Plan |
| MSW | Defer to Phase 2 | Existing `vi.mock` pattern works; MSW adds setup cost without new signal in Phase 1 | Plan |
| Harvest UI tests | Unit only (`harvest.test.ts`) | Pure function is cheapest signal; component wiring is thin | Plan |
| Auth success depth | Redirects + cookie write verification | Catches session regressions test-plan warns about with over-mocking | Plan |
| Middleware scope | Full route matrix | All seven prefixes + public routes + null client | Plan |
| Cookbook | Update §6.1–§6.4 in Phase 1 | Closes TBD items; future phases inherit working examples | Plan |

## Scope

**In scope:**

- Expand `middleware.test.ts` to full `PROTECTED_ROUTES` matrix
- Auth success paths (signin, signup, signout) with cookie/signOut verification
- `GET /api/plantings` and new `POST /api/fields` test file
- `EXPECTED_CATALOG` fixture + catalog completeness tests
- Harvest null `growth_days` + Tomato seed cross-check
- Test-plan §6.1–§6.4 cookbook documentation

**Out of scope:**

- MSW setup, CI test gate, live Supabase RLS tests
- Playwright E2E, FieldGrid/PlantingDialog harvest display tests
- Production auth behavior changes (`/api/fields` stays outside middleware)
- Admin UI tests (test-plan §7 exclusion)

## Architecture / Approach

Tests import Astro API handlers and middleware directly, building minimal context stubs and mocking `@/lib/supabase` plus service modules — no HTTP server or live database. A shared `EXPECTED_CATALOG` fixture mirrors the migration seed for catalog completeness and harvest cross-checks. Two auth layers coexist by design: middleware 302 redirect for listed prefixes, handler 401 JSON for routes like `/api/fields`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Auth middleware & success paths | Full route matrix + signin/signup/signout success | Cookie mock wiring for `@supabase/ssr` setAll |
| 2. API handler gaps | GET plantings + POST fields tests | Documenting dual auth semantics clearly |
| 3. Catalog & harvest | Fixture + completeness + harvest edge cases | Fixture drift if migration seed changes |
| 4. Cookbook & close-out | §6 docs + full suite green | Keeping cookbook concise and actionable |

**Prerequisites:** Node v22, `.env` not required for unit tests (Astro env mocked in `src/test/mocks/astro-virtual.ts`)

**Estimated effort:** ~2–3 focused sessions across 4 phases

## Open Risks & Assumptions

- `EXPECTED_CATALOG` can drift from migration SQL if seed changes without updating the fixture — mitigated by reviewing both in PR
- Cookie write verification depends on accurately mocking `@supabase/ssr` `setAll` → `cookies.set` wiring in `createClient`
- Phase 1 does not prove RLS boundaries — deferred to Phase 2 (Risk #4)
- CI will not enforce tests until Phase 4 — local `npm run test:run` is the gate for this change

## Success Criteria (Summary)

- `npm run test:run` passes with expanded coverage for risks #1, #2, #6
- Middleware tests cover all seven protected prefixes plus authenticated pass-through
- Catalog completeness verified against migration-equivalent fixture data
- Test-plan §6.1–§6.4 provides copy-pasteable patterns for new tests
