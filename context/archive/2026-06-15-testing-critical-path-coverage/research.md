---
date: 2026-06-17T12:00:00+02:00
researcher: Cursor Agent
git_commit: e8b8b32778f5f34cb7216db1b30879b05274006f
branch: development
repository: my-garden
topic: "testing-critical-path-coverage"
tags: [research, codebase, testing, vitest, auth, plants, harvest, critical-path]
status: complete
last_updated: 2026-06-17
last_updated_by: Cursor Agent
---

# Research: testing-critical-path-coverage

**Date**: 2026-06-17T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `e8b8b32778f5f34cb7216db1b30879b05274006f`  
**Branch**: `development`  
**Repository**: my-garden

## Research Question

Ground Phase 1 of `context/foundation/test-plan.md` ("Critical-path coverage") in the live codebase: where do risks **#1** (auth gating), **#2** (plant catalog completeness), and **#6** (harvest date calculation) actually live, what tests already exist, and what gaps remain before `/10x-plan`?

## Summary

Vitest is **already bootstrapped** with 11 test files under `src/test/` covering middleware redirects, auth API error paths, plantings API auth/validation, admin role gating, plant service queries, harvest date math, and basic `FieldGrid` rendering. Phase 1 is **partially implemented** — not starting from zero.

**Risk #1 (auth):** Middleware guards seven route prefixes; tests cover three unauthenticated redirect cases. Handler-level 401/403 exists for plantings and admin APIs but **GET /api/plantings**, **POST /api/fields**, middleware pass-through, and auth **success** paths are untested. `/api/fields` is **not** in `PROTECTED_ROUTES`, so unauth behavior differs (401 JSON vs 302 redirect).

**Risk #2 (catalog):** Catalog is seeded in migration `20260609000000_plants_scope_drop_requests.sql` (10 global plants). `getPlants()` filters `status = 'global'`. There is **no `/api/plants` endpoint** — catalog loads server-side on the field detail page. Existing `plants.test.ts` verifies query shape, not catalog completeness or attribute correctness against seed data.

**Risk #6 (harvest dates):** Logic lives in `src/lib/harvest.ts` (`seeding_date + growth_days`). Test-plan language references "growth category mapping" but the codebase uses **per-plant `growth_days`**, not categories. `harvest.test.ts` has five solid unit tests; `FieldGrid` and `PlantingDialog` consume the same helper but do not assert harvest display.

**Infrastructure gaps:** MSW is listed in test-plan §4 but **not configured**. CI runs lint + build only — **no `npm run test:run`**. Playwright E2E exists separately and is out of Phase 1 scope.

## Detailed Findings

### Test infrastructure (Vitest bootstrap)

| Component | Location | Notes |
| --- | --- | --- |
| Config | [`vitest.config.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/vitest.config.ts) | `happy-dom`, globals, `@/` alias, Astro virtual module mocks |
| Setup | [`src/test/setup.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/setup.ts) | `@testing-library/jest-dom`, React cleanup after each test |
| Astro env mock | [`src/test/mocks/astro-virtual.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/mocks/astro-virtual.ts) | Fake `SUPABASE_URL` / `SUPABASE_ANON_KEY`; passthrough `defineMiddleware` |
| Scripts | [`package.json`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/package.json) | `test`, `test:run` (`vitest run --passWithNoTests`) |
| CI | [`.github/workflows/ci.yml`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/.github/workflows/ci.yml) | Lint + build only; tests deferred to Phase 4 per test-plan |

**Test pattern:** API route tests import handlers directly (`POST`, `GET`, etc.), build minimal `APIContext` stubs, and mock `@/lib/supabase` plus service modules. Middleware tests mock `createClient` and assert `redirect` vs `next()`.

**MSW:** Present only as a transitive dependency in `package-lock.json`; no `setupServer`, handlers, or HTTP-edge mocking in `src/test/`.

### Risk #1 — Auth gating

#### Entry points

**Middleware** ([`src/middleware.ts:6-34`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/middleware.ts#L6-L34)):

- `PROTECTED_ROUTES`: `/dashboard`, `/admin`, `/api/admin`, `/api/weather`, `/api/user-preferences`, `/api/geocoding-suggestions`, `/api/plantings`
- Resolves user via `createClient` + `auth.getUser()` → `context.locals.user`
- Unauthenticated on protected prefix → `redirect("/auth/signin")` (302, not JSON 401)
- **Not protected:** `/api/fields` (handler-only 401), `/api/auth/*`, `/api/cron/*`

**Supabase SSR client** ([`src/lib/supabase.ts:11-31`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/supabase.ts#L11-L31)): cookie read/write via `@supabase/ssr`. Returns `null` when env missing → all users treated as unauthenticated.

**Auth endpoints:**

| Route | File | Behavior |
| --- | --- | --- |
| POST signin | [`src/pages/api/auth/signin.ts:4-19`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/api/auth/signin.ts#L4-L19) | FormData → `signInWithPassword` → redirect `/` or error query |
| POST signup | [`src/pages/api/auth/signup.ts:4-19`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/api/auth/signup.ts#L4-L19) | Redirect `/auth/confirm-email` or error |
| POST signout | [`src/pages/api/auth/signout.ts:4-9`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/api/auth/signout.ts#L4-L9) | `auth.signOut()` → redirect `/` |

**Protected pages:** Dashboard ([`src/pages/dashboard.astro`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/dashboard.astro)) relies on middleware; field detail ([`src/pages/dashboard/fields/[id].astro:25-28`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/dashboard/fields/%5Bid%5D.astro#L25-L28)) adds defense-in-depth redirect.

**API auth patterns:**

| Route | Auth check | Ownership |
| --- | --- | --- |
| GET/POST `/api/plantings` | `locals.user` → 401 | POST sets `user_id`; GET relies on RLS |
| PATCH/DELETE `/api/plantings/[id]` | 401 + app-level 403 if `user_id` mismatch | [`plantings/[id].ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/api/plantings/%5Bid%5D.ts) |
| POST `/api/fields` | 401 at handler | [`fields/index.ts:15-22`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/api/fields/index.ts#L15-L22) |
| GET `/api/admin/plant-requests` | Admin role → 403 | [`admin/plant-requests/index.ts:7-14`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/api/admin/plant-requests/index.ts#L7-L14) |

**RLS backstop** (Phase 2 scope per test-plan, but cited by Risk #1): `fields` and `plantings` tables enforce `user_id = auth.uid()` in [`20260525000000_initial_schema.sql`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/supabase/migrations/20260525000000_initial_schema.sql).

#### Existing tests

| File | Coverage |
| --- | --- |
| [`src/test/middleware.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/middleware.test.ts) | Unauth redirect for `/admin`, `/api/admin`, `/dashboard` (3 of 7 prefixes) |
| [`src/test/api/signin.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/api/signin.test.ts) | Supabase null; auth error redirect |
| [`src/test/api/signup.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/api/signup.test.ts) | Same error-path pattern |
| [`src/test/api/signout.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/api/signout.test.ts) | Supabase null; redirect `/` |
| [`src/test/api/plantings-index.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/api/plantings-index.test.ts) | POST 401, validation, 201 success — **no GET tests** |
| [`src/test/api/plantings-id.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/api/plantings-id.test.ts) | PATCH/DELETE 401, 403 wrong user, 404, success |
| [`src/test/api/admin-plant-requests-*.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/api/admin-plant-requests-id.test.ts) | Admin 403 for non-admin |

#### Gaps (Risk #1)

1. Middleware: authenticated pass-through, `locals.user` population, remaining four `PROTECTED_ROUTES`, public routes, `createClient` null on protected route
2. Auth success paths (signin → `/`, signup → confirm-email, signout calls `signOut`)
3. `GET /api/plantings` — 401, 200, invalid `field_id`
4. `POST /api/fields` — new test file needed
5. Document dual semantics: middleware redirect (302) vs handler 401 for routes outside `PROTECTED_ROUTES`
6. Live RLS / cross-user IDOR — defer to Phase 2 per test-plan

### Risk #2 — Plant catalog completeness

#### Data model and seed

**Schema** ([`src/types.ts:26-35`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/types.ts#L26-L35)): `PlantRow` has `name`, `growth_days`, `watering_needs`, `status` (`pending` | `global`), `user_id`.

**Seed catalog** ([`supabase/migrations/20260609000000_plants_scope_drop_requests.sql:24-35`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/supabase/migrations/20260609000000_plants_scope_drop_requests.sql#L24-L35)) — 10 global plants with fixed `growth_days` and `watering_needs`:

Tomato (70/high), Carrot (75/medium), Potato (90/medium), Onion (100/low), Lettuce (45/high), Cucumber (60/high), Pepper (80/medium), Beet (60/medium), Zucchini (55/medium), Garlic (240/low).

**Terminology note:** Test-plan Risk #2 mentions "growth category" and "harvest ratio"; the codebase uses **`growth_days` per plant** and **`watering_needs`**, not category enums or harvest ratios. Plan phases should align assertions with actual schema.

#### Service layer

[`src/lib/services/plants.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/services/plants.ts):

- `getPlants()` — `status = 'global'`, ordered by `name` (lines 4-11)
- `createUserPlant()` — inserts `status = 'pending'` (lines 17-23)
- `approvePlant()` / `rejectPlant()` — admin flow promotes pending → global with `growth_days` (lines 34-54)

#### Consumption paths

- Field detail page loads catalog server-side: [`src/pages/dashboard/fields/[id].astro:30-35`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/pages/dashboard/fields/%5Bid%5D.astro#L30-L35) — `getPlants(supabase)` in parallel with field/plantings
- Passed to `FieldGrid` → `PlantingDialog` for plant picker and harvest preview
- **No dedicated catalog API route** — completeness must be tested at service layer or via integration against seed fixture

#### Admin approval (catalog mutation)

Admin APIs under `/api/admin/plant-requests` use service-role client and `approvePlant`/`rejectPlant`. Excluded from user-facing catalog risk per test-plan §7 ("Internal admin plant-approval UI") but **approval is how pending plants enter the global catalog**.

#### Existing tests

[`src/test/lib/plants.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/lib/plants.test.ts):

- Verifies query filters (`status = 'global'`, order by name)
- Verifies insert/update/delete shapes for pending/approve/reject flows
- Uses chainable Supabase builder mock (`makeQueryBuilder`)

Admin API tests cover 403 non-admin and approval validation but not post-approval catalog visibility.

#### Gaps (Risk #2)

1. **Catalog completeness assertion** — constant `EXPECTED_GLOBAL_PLANTS` mirroring migration seed; test that `getPlants` result includes all names with correct `growth_days` / `watering_needs` (integration with fixture or mocked full dataset)
2. **Pending plants excluded** — assert `getPlants` never returns `status = 'pending'`
3. **Plants with null `growth_days`** — after approval, global plants must have `growth_days` set; harvest logic returns `"–"` when null ([`src/lib/harvest.ts:6`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/harvest.ts#L6))
4. **UI catalog options** — `PlantingDialog` plant picker not tested for option count/content
5. Live DB seed verification — Phase 2/3 territory unless local Supabase used in integration

### Risk #6 — Harvest date calculation

#### Implementation

[`src/lib/harvest.ts:3-10`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/harvest.ts#L3-L10):

```typescript
export function getHarvestDate(planting: PlantingRow, plants: PlantRow[]): string {
  if (!planting.plant_id) return "–";
  const plant = plants.find((p) => p.id === planting.plant_id);
  if (plant?.growth_days == null) return "–";
  const seeding = new Date(planting.seeding_date);
  seeding.setDate(seeding.getDate() + plant.growth_days);
  return seeding.toLocaleDateString("pl-PL");
}
```

Formula: **harvest = seeding_date + plant.growth_days**, formatted `pl-PL`.

#### Consumers

| Location | Usage |
| --- | --- |
| [`FieldGrid.tsx:64`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/components/fields/FieldGrid.tsx#L64) | Cell display `🌾 {getHarvestDate(...)}` |
| [`PlantingDialog.tsx:47-61`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/components/fields/PlantingDialog.tsx#L47-L61) | Live preview while selecting plant |

#### Existing tests

[`src/test/lib/harvest.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/lib/harvest.test.ts) — 5 cases:

- No `plant_id` → `"–"`
- Unknown `plant_id` → `"–"`
- Empty catalog → `"–"`
- Tomato 70 days from 2026-05-01
- Radish 25 days from 2026-06-01

**Oracle mitigation:** Tests compute expected date with the same `Date` arithmetic + `toLocaleDateString("pl-PL")` rather than hard-coding strings — good pattern per test-plan anti-pattern guidance.

#### Gaps (Risk #6)

1. **`growth_days = null`** on matched plant → `"–"` (schema allows null on pending plants)
2. **Invalid `seeding_date`** edge case (malformed date string)
3. **Component-level display** — `FieldGrid` tests show seeding date but not harvest emoji line
4. **Cross-check against seed data** — e.g. Tomato +70 from known seeding → known harvest (ties Risk #2 + #6)
5. No separate "growth category" layer exists — do not build category-mapping tests unless product adds that abstraction

### Playwright (out of Phase 1 scope, documented)

| File | Purpose |
| --- | --- |
| [`playwright/auth/auth.setup.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/playwright/auth/auth.setup.ts) | Real login → storage state |
| [`playwright/tests/dashboard.spec.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/playwright/tests/dashboard.spec.ts) | Authenticated dashboard; sign-out |
| [`playwright/tests/admin-plant-requests.spec.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/playwright/tests/admin-plant-requests.spec.ts) | Admin UI flow |

No Playwright test for unauthenticated redirect to signin.

## Code References

- [`src/middleware.ts:6-34`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/middleware.ts#L6-L34) — `PROTECTED_ROUTES` and redirect guard
- [`src/lib/supabase.ts:11-31`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/supabase.ts#L11-L31) — SSR cookie client
- [`src/lib/services/plants.ts:4-11`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/services/plants.ts#L4-L11) — global catalog query
- [`supabase/migrations/20260609000000_plants_scope_drop_requests.sql:24-35`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/supabase/migrations/20260609000000_plants_scope_drop_requests.sql#L24-L35) — seed catalog
- [`src/lib/harvest.ts:3-10`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/lib/harvest.ts#L3-L10) — harvest date formula
- [`vitest.config.ts:1-21`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/vitest.config.ts) — test runner config
- [`src/test/middleware.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/middleware.test.ts) — partial middleware coverage
- [`src/test/lib/harvest.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/lib/harvest.test.ts) — harvest unit tests
- [`src/test/lib/plants.test.ts`](https://github.com/Lovable-wojkos/my-garden/blob/e8b8b32778f5f34cb7216db1b30879b05274006f/src/test/lib/plants.test.ts) — plant service query tests

## Architecture Insights

1. **Two-layer auth:** Middleware redirect for listed prefixes; handler-level 401/403 for JSON APIs. Tests must know which layer applies per route.
2. **RLS as silent backstop:** Many read paths (GET plantings, field page load) have no app-level ownership check — correctness depends on Supabase RLS (Phase 2).
3. **Catalog is server-rendered, not API-driven:** Risk #2 tests belong at service/fixture layer unless a `/api/plants` endpoint is added.
4. **Harvest is pure function:** Ideal unit-test target; UI components are thin wrappers.
5. **Mock-heavy unit tests today:** Supabase and services are vi.mock'd; test-plan warns against over-mocking auth without cookie shape — success-path auth tests should verify `cookies.set` via `setAll`.
6. **Test-plan vs code terminology:** "Growth category" and "harvest ratio" in test-plan map to `growth_days` and `watering_needs` in code.

## Historical Context (from prior changes)

- [`context/archive/2026-06-02-testing-critical-path-coverage/research.md`](context/archive/2026-06-02-testing-critical-path-coverage/research.md) — **Stale.** Documented zero test tooling (pre-Vitest). Current codebase has full Vitest bootstrap and 11 test files; treat archived research as historical baseline only.
- Prior change was archived 2026-06-02; active folder re-opened with `status: new` on 2026-06-15 per [`change.md`](change.md).
- Test-plan Phase 1 status remains `change opened`; cookbook §6.1–§6.4 still TBD pending Phase 1 completion.

## Related Research

- `context/archive/2026-06-02-testing-critical-path-coverage/research.md` — initial (pre-test) exploration; superseded by this document
- `context/foundation/test-plan.md` — risk definitions and phase scope (§2–§3)

## Open Questions

1. Should `/api/fields` be added to `PROTECTED_ROUTES` for consistent unauth behavior, or is handler-only 401 intentional?
2. Should catalog completeness use a shared `EXPECTED_CATALOG` constant imported by both migration review and tests, or stay migration-only with duplicated fixture in tests?
3. Is MSW needed for Phase 1 given current vi.mock pattern, or defer until Phase 2 Open-Meteo/Supabase integration tests?
4. Should `FieldGrid.test.tsx` assert harvest display, or keep harvest coverage purely in `harvest.test.ts`?

## Recommended `/10x-plan` priorities

| Priority | Work item | Risk |
| --- | --- | --- |
| P0 | Extend `middleware.test.ts` — full route matrix + authed pass-through | #1 |
| P0 | Add `GET /api/plantings` tests + `POST /api/fields` test file | #1 |
| P0 | Auth success paths (signin/signup/signout) with cookie write verification | #1 |
| P1 | Catalog completeness fixture test against seed data attributes | #2 |
| P1 | Harvest null `growth_days` + seed-data cross-check (Tomato 70d) | #2, #6 |
| P2 | Document test patterns in test-plan §6.1–§6.4 cookbook | cross-cutting |
| Defer | Live Supabase RLS, MSW, CI test gate, Playwright unauth redirect | Phase 2–4 |
