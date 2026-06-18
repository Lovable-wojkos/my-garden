# Application UI Design — Plan Brief

> Full plan: `context/changes/application-design/plan.md`  
> Research: `context/changes/application-design/research.md`

## What & Why

Replace the leftover **10x Astro Starter** look with a **Polish-first, earthy outdoor light** garden app: a proper public home page, a shared authenticated shell with **dashboard as the post-login home**, and the **missing user-facing pages** (catalog, plant requests, settings, 404). Establish `context/foundation/DESIGN.md` as the single design source of truth before touching UI code.

## Starting Point

MVP features work (fields, plantings, weather, admin approval) but the UI uses `bg-cosmic` glass styling, English copy, duplicated page headers, and no post-login navigation. `DESIGN.md` currently describes an unrelated emma.love dark theme. `createUserPlant` exists in the service layer but has no user API or page.

## Desired End State

- **`/`** — Polish garden marketing landing (not starter branding); logged-in users can still reach it via logo but **sign-in lands on `/dashboard`**.
- **Authenticated app** — shared `AppShell` with mobile-friendly nav; all surfaces use earthy light tokens from `DESIGN.md`.
- **New routes** — `/dashboard/catalog`, `/dashboard/plant-requests`, `/dashboard/settings`, plus `404.astro`.
- **Copy** — user-visible strings in Polish via a central copy module; `<html lang="pl">`.
- **Visual unity** — shadcn components and bespoke forms share the same light garden palette (no cosmic purple / admin white-card outlier).

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Visual direction | Earthy outdoor **light** | Matches PRD mobile-first, practical gardener use | User |
| Post-login home | `/dashboard` | User expectation; sign-in currently redirects to `/` | User |
| Public home | Rebrand `/` with garden copy | Starter text must go; landing stays public marketing | User |
| Missing pages | Catalog, plant requests, settings, 404 | Closes research gaps + FR-014 user flow | User |
| Language | **Polish first** (no i18n framework) | PRD primary locale; ship faster than full i18n | User |
| English | Deferred | Strings live in one module; English toggle is v2 | Plan |
| Field edit/delete | Out of scope | Not requested; avoids scope creep | Plan |
| Harvest / watering UI | Out of scope | PRD parked (FR-012, FR-013) | Research |

## Scope

**In scope:** Rewrite `DESIGN.md`; CSS design tokens; `src/lib/copy/pl.ts`; landing + auth rebrand; `AppShell` + nav; theme migration for existing pages/components; new catalog / plant-request / settings / 404 pages; `POST /api/plant-requests` user endpoint; sign-in redirect fix; admin page themed + nav link for admins.

**Out of scope:** Full i18n, dark mode toggle, field edit/delete, harvest tracking UI, watering notifications, E2E Playwright (unless added separately), redesign of field grid interaction model.

## Architecture / Approach

**Tokens first** → **public pages** → **AppShell + redirects** → **new routes (SSR + thin APIs)** → **migrate existing React/Astro components** to tokens + Polish copy. Astro pages own layout/chrome; React islands keep interactivity. Polish strings centralized in `pl.ts` so a future English module can mirror keys without refactoring components.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Design tokens & copy | `DESIGN.md`, `global.css` tokens, `pl.ts` skeleton | Token naming drift if not documented in DESIGN.md |
| 2. Public home & auth | Garden landing, auth pages, `lang="pl"`, default titles | Sign-in redirect must change to `/dashboard` |
| 3. App shell & nav | `AppShell.astro`, bottom/top nav, dashboard/field refactor | Mobile nav touch targets on small screens |
| 4. Missing pages | Catalog, plant requests, settings, 404, user API | Settings vs `fix-field-region` overlap on location UI |
| 5. Theme migration | Weather, grid, dialogs, forms, admin — unified light theme | Three legacy dialects may need per-component pass |

**Prerequisites:** None blocking; coordinate with `fix-field-region` if both touch settings/location UX.  
**Estimated effort:** ~5 implementation sessions across 5 phases.

## Open Risks & Assumptions

- If `fix-field-region` lands first, settings page should reuse its location flow rather than duplicating city picker logic.
- Polish plant names in seed data remain English (Tomato, Carrot) — UI chrome is Polish; catalog content translation is a separate decision.
- Removing `bg-cosmic` touches many files; lint + visual spot-check each phase.

## Success Criteria (Summary)

- Visitor sees a Polish garden landing at `/`; after sign-in they arrive on `/dashboard`.
- Authenticated user can reach catalog, submit a plant request, and change location in settings via app nav.
- No page uses cosmic purple starter branding; `npm run lint` and `npm run build` pass.
