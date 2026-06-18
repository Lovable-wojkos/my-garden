# Application UI Design Implementation Plan

## Overview

Transform the garden management app from a **10x Astro Starter** cosmetic baseline into a **Polish-first, earthy outdoor light** product. Deliver a garden-focused public home page, **`/dashboard` as post-login home**, a shared **AppShell** with navigation, **missing user pages** (catalog, plant requests, settings, 404), and a rewritten **`context/foundation/DESIGN.md`** wired to CSS tokens in `src/styles/global.css`.

## Current State Analysis

Research (`context/changes/application-design/research.md`) established:

- One minimal `Layout.astro`; no shared post-login chrome.
- Cosmic `bg-cosmic` + purple glass on most pages; shadcn light defaults on admin/create-field; custom glass auth inputs.
- Landing H1 still **"10x Astro Starter"** (`src/components/Welcome.astro:35`).
- Sign-in redirects to **`/`** not dashboard (`src/pages/api/auth/signin.ts:19`).
- `createUserPlant` service exists; RLS allows user pending inserts (`supabase/migrations/20260609000000_plants_scope_drop_requests.sql:18-20`); no user API or page.
- `DESIGN.md` documents emma.love (wrong domain); must be replaced.

### Key Discoveries:

- `components.json` — shadcn **new-york**, **neutral**, cssVariables — good base for light theme once tokens are garden-colored.
- Dashboard layout pattern `lg:grid-cols-[1fr_auto]` is worth keeping inside AppShell.
- Admin page has no in-app link; show nav item only when `user.app_metadata.role === "admin"`.
- PRD: mobile-first, Polish primary (`context/foundation/prd.md:119-147`).

## Desired End State

1. **`context/foundation/DESIGN.md`** documents earthy light garden tokens, typography, components, layout, and Polish copy rules.
2. **`src/styles/global.css`** exposes semantic tokens (`--background`, `--primary`, etc.) as the light garden palette; `bg-cosmic` removed or aliased to deprecated then deleted.
3. **`/`** — Polish public landing describing the garden product (fields, weather, planting tracking).
4. **Auth** — sign-in/sign-up/confirm-email use light garden surfaces; **successful sign-in redirects to `/dashboard`**.
5. **`AppShell`** wraps all authenticated routes with consistent header + **mobile bottom nav** (Panel, Katalog, Ustawienia; admin link when applicable).
6. **New pages:** `/dashboard/catalog`, `/dashboard/plant-requests`, `/dashboard/settings`, `404.astro`.
7. **`POST /api/plant-requests`** — authenticated user submits plant name → `createUserPlant`.
8. **All user-visible strings** in Polish via `src/lib/copy/pl.ts`.
9. **Existing feature UI** (dashboard, fields, weather, planting dialog, admin) uses the same token set — no cosmic/dark outliers.

### Verification

- Sign in → lands on `/dashboard` with nav visible.
- Nav: Katalog shows seeded plants; Zgłoś roślinę creates pending request; Ustawienia shows city/location controls.
- `/` shows garden branding in Polish; no "10x Astro Starter" text anywhere.
- `npm run lint` and `npm run build` pass.

## What We're NOT Doing

- Full i18n framework or English language toggle (strings centralized for future addition only).
- Dark mode / theme switcher.
- Field edit, field delete, or harvest-tracking UI.
- Watering notification UI (FR-013 parked).
- Translating seed plant names (Tomato, Carrot, …) — catalog **labels** Polish; plant **names** stay as stored unless a separate content change is opened.
- E2E Playwright scenarios for this change.
- Visual grid editor for field dimensions (numeric form stays).

## Implementation Approach

**Tokens and copy before chrome before new routes before migration sweep.** Each phase is independently verifiable with lint/build. Replace emma.love `DESIGN.md` entirely — do not merge with cosmic or dating aesthetics.

Polish copy: flat `pl` object with nested keys (`nav.dashboard`, `catalog.title`, …). Components import constants; no runtime translation layer.

## Critical Implementation Details

**Sign-in redirect:** Change `src/pages/api/auth/signin.ts` redirect target from `/` to `/dashboard`. Optionally redirect authenticated users visiting `/auth/signin` to `/dashboard` in page frontmatter (mirror admin guard pattern).

**Settings vs fix-field-region:** If `fix-field-region` is in flight, settings location section should call the same user-preferences / region API the weather widget uses — do not introduce a second location model. Minimum for this change: display current city + link or embed city picker consistent with `WeatherWidget`.

**Plant request API:** Validate `name` with zod (min 2 chars, trimmed). Use authenticated Supabase client + `createUserPlant`. Return 201 + plant row. Duplicate pending names from same user: allow (admin disambiguates) unless DB unique constraint exists — none today.

**AppShell active state:** Pass `activeNav` prop from each page (`"dashboard" | "catalog" | "settings" | "admin"`).

## Phase 1: Design System & Polish Copy Foundation

### Overview

Replace `DESIGN.md` with garden earthy light spec and wire CSS tokens + Polish copy module.

### Changes Required:

#### 1. Rewrite design spec

**File**: `context/foundation/DESIGN.md`

**Intent**: Replace emma.love content with garden product design system aligned to user decisions.

**Contract**: Document at minimum — (1) product identity & tone, (2) color tokens with hex + CSS variable names, (3) typography (system stack initially; optional Google Font note), (4) spacing/radius, (5) button/card/input/dialog rules, (6) field grid cell guidelines (44px touch), (7) weather panel hierarchy, (8) Polish-first copy rules, (9) do/don't (no cosmic purple, no starter branding).

Suggested palette (implementer may tune within earthy light constraint):

| Token role | Example |
|------------|---------|
| Background | parchment `#F5F1E8` |
| Card surface | `#FFFFFF` |
| Foreground | soil `#3D3229` |
| Primary | forest `#2D6A4F` |
| Accent | terracotta `#C67B4E` |
| Muted text | `#6B5E54` |
| Border | `#E2D9CC` |

#### 2. CSS tokens

**File**: `src/styles/global.css`

**Intent**: Map shadcn `:root` variables to garden light palette; remove dependency on `bg-cosmic` for new work.

**Contract**: Update `:root` OKLCH/hex values per DESIGN.md. Remove `@utility bg-cosmic` or mark deprecated in DESIGN.md then delete in Phase 5. Set `body` to use `bg-background text-foreground` without page-level overrides where possible. Keep `.dark` block for shadcn compatibility but unused.

#### 3. Polish copy module

**File**: `src/lib/copy/pl.ts`

**Intent**: Single source for user-visible Polish strings.

**Contract**: Export a typed `pl` object covering at least: `appName`, `nav`, `landing`, `auth`, `dashboard`, `catalog`, `plantRequests`, `settings`, `fields`, `weather`, `common` (save, cancel, back, errors). English not required in v1.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- `DESIGN.md` reads as garden-specific (no emma.love / dating references)
- `global.css` `:root` colors match DESIGN.md table
- `pl.ts` exports all keys needed for Phase 2–4

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Public Home & Auth Rebrand

### Overview

Garden-focused Polish landing; light-themed auth pages; document language and default titles.

### Changes Required:

#### 1. Root layout

**File**: `src/layouts/Layout.astro`

**Intent**: Polish document defaults and garden app title.

**Contract**: `lang="pl"` on `<html>`. Default `title` from `pl.appName` (or prop default). Remove "10x Astro Starter" default.

#### 2. Landing page

**Files**: `src/components/Welcome.astro`, optionally rename to `Landing.astro` (if renamed, update `src/pages/index.astro` import).

**Intent**: Replace starter hero and feature cards with garden value proposition in Polish.

**Contract**: Content from `pl.landing` — headline, subhead, 3 feature bullets (pola, pogoda, siew), CTAs "Zaloguj się" / "Załóż konto". Use light earthy layout (parchment bg, green primary buttons) per DESIGN.md — **no** cosmic orbs, purple gradients, or starfield. Keep `Topbar.astro` or fold auth links into hero; Topbar copy Polish.

#### 3. Auth pages

**Files**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`; `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`

**Intent**: Light garden card on parchment background; Polish labels and errors.

**Contract**: Replace `bg-cosmic` and glass-dark inputs with `bg-background` / `bg-card` tokens. Wire form labels, buttons, validation messages to `pl.auth`. Links between sign-in and sign-up in Polish.

#### 4. Sign-in redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Post-login home is dashboard.

**Contract**: Line 19 redirect target `/` → `/dashboard`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- `/` shows Polish garden landing; no starter branding
- Auth pages readable on mobile; light theme
- Sign-in succeeds → `/dashboard` (may 302 to sign-in if middleware blocks unauthenticated test — verify with real session)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: App Shell & Navigation

### Overview

Shared authenticated chrome; refactor dashboard and field pages to use it.

### Changes Required:

#### 1. App shell component

**File**: `src/components/AppShell.astro` (new)

**Intent**: Header (app name + page title slot) + main content slot + bottom nav on mobile / top nav links on `md+`.

**Contract**: Props: `title: string`, `activeNav: "dashboard" | "catalog" | "settings" | "admin"`. Nav labels from `pl.nav`. Links: `/dashboard`, `/dashboard/catalog`, `/dashboard/settings`. Admin: `/admin/plant-requests` when `Astro.locals.user?.app_metadata.role === "admin"`. Sign out in header or settings only (remove duplicate sign-out from dashboard header). Semantic `<main>`, `<nav>`.

#### 2. Dashboard pages

**Files**: `src/pages/dashboard.astro`, `src/pages/dashboard/fields/new.astro`, `src/pages/dashboard/fields/[id].astro`

**Intent**: Wrap content in `AppShell`; remove inline headers and cosmic classes.

**Contract**: `activeNav="dashboard"`. Polish titles from `pl.dashboard` / `pl.fields`. Light card surfaces for field list and empty state. Keep weather sidebar grid on dashboard and field detail.

#### 3. Middleware (optional guard)

**File**: `src/pages/auth/signin.astro` (frontmatter)

**Intent**: Skip sign-in page when already authenticated.

**Contract**: If `Astro.locals.user`, `return Astro.redirect("/dashboard")`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Existing middleware tests still pass: `npm run test:run -- src/test/middleware.test.ts`

#### Manual Verification:

- Dashboard and field pages show consistent nav
- Bottom nav usable on phone-width viewport
- Admin user sees admin nav entry

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Missing Pages & User Plant-Request API

### Overview

Add catalog browse, user plant-request submission, settings, 404, and backing API.

### Changes Required:

#### 1. Plant catalog page

**File**: `src/pages/dashboard/catalog.astro` (new)

**Intent**: Browse global plant catalog (FR-003 visibility).

**Contract**: SSR: `getPlants(supabase)` for authenticated user. `AppShell` `activeNav="catalog"`. Display name, `growth_days`, `watering_needs` in Polish labels. Link to plant-requests page for missing plants. Optional React island only if search/filter needed — start with static SSR list.

#### 2. User plant requests page

**Files**: `src/pages/dashboard/plant-requests.astro` (new), `src/components/plants/PlantRequestForm.tsx` (new, optional)

**Intent**: User submits new plant type (FR-014).

**Contract**: Form: plant name (required). `POST /api/plant-requests` on submit. List user's pending plants (`status = 'pending' AND user_id = auth.uid()`) — add `getUserPendingPlants(client, userId)` to `src/lib/services/plants.ts` if missing. Polish empty/success states.

#### 3. User plant-request API

**File**: `src/pages/api/plant-requests/index.ts` (new)

**Intent**: Authenticated endpoint for creating pending plants.

**Contract**: `export const prerender = false`. `POST`: zod `{ name: string.min(2) }`, 401 if no user, call `createUserPlant`, 201 JSON. `GET` (optional same file): return current user's pending plants for client refresh. Add `/api/plant-requests` to `PROTECTED_ROUTES` in `src/middleware.ts`.

#### 4. Settings page

**File**: `src/pages/dashboard/settings.astro` (new)

**Intent**: Profile/location hub.

**Contract**: `AppShell` `activeNav="settings"`. Show user email (read-only). Location section: current city from `getUserPreferences` + city picker (reuse `WeatherWidget` geocoding pattern or extract `CityPicker` component). Sign-out form. Polish copy from `pl.settings`.

#### 5. Not found page

**File**: `src/pages/404.astro` (new)

**Intent**: Friendly Polish 404 with link to dashboard or home.

**Contract**: Light garden styling; `pl.common.notFound`.

#### 6. Service helper

**File**: `src/lib/services/plants.ts`

**Intent**: Query user's pending plant submissions.

**Contract**: `getUserPendingPlants(client, userId)` — select where `status = 'pending'` and `user_id = userId`, order `created_at desc`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Add unit test for `POST /api/plant-requests` (401, validation, success) in `src/test/api/plant-requests.test.ts`
- Add unit test for `getUserPendingPlants` in `src/test/lib/plants.test.ts`
- `npm run test:run` passes

#### Manual Verification:

- Catalog lists 10 seeded plants
- Submit plant request → appears in pending list; admin can approve at `/admin/plant-requests`
- Settings shows email and location
- Unknown URL shows Polish 404

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Theme Migration & Admin Polish

### Overview

Apply earthy light tokens and Polish copy to remaining React islands and admin page; remove cosmic starter remnants.

### Changes Required:

#### 1. Weather widget

**File**: `src/components/WeatherWidget.tsx`

**Intent**: Light card on garden palette; Polish strings from `pl.weather`.

**Contract**: Replace hardcoded Polish/English mix with `pl.weather`. Use `bg-card`, `text-foreground`, `border-border`. No `bg-cosmic` assumptions in parent pages.

#### 2. Field components

**Files**: `src/components/fields/FieldGrid.tsx`, `PlantingDialog.tsx`, `CreateFieldForm.tsx`

**Intent**: Unified light dialogs and grid cells.

**Contract**: Remove `bg-slate-900`, `border-white/10`, `text-white` overrides; use shadcn tokens + DESIGN.md field grid rules. Polish all labels (PlantingDialog currently English). Touch-friendly cell `min-h` per DESIGN.md.

#### 3. Admin page

**Files**: `src/pages/admin/plant-requests.astro`, `src/components/plants/AdminPlantRequestList.tsx`

**Intent**: Same visual language as rest of app inside AppShell or minimal admin wrapper.

**Contract**: Wrap with `AppShell` `activeNav="admin"`. Light cards, Polish headings. Replace `window.confirm` reject with shadcn `AlertDialog` if component available (install via `npx shadcn@latest add alert-dialog` if needed).

#### 4. Banner and misc

**Files**: `src/components/Banner.astro`, `src/components/Topbar.astro`

**Intent**: Token-aligned alerts and public nav.

**Contract**: Polish any remaining English in Topbar. Banner uses destructive/muted tokens.

#### 5. Remove cosmic utility

**File**: `src/styles/global.css`

**Intent**: Delete starter-specific styling.

**Contract**: Remove `@utility bg-cosmic` after grep confirms zero usages.

#### 6. Grep cleanup

**Intent**: No leftover starter branding or cosmic classes.

**Contract**: Zero matches for `bg-cosmic`, `10x Astro`, `from-blue-200 to-purple` in `src/`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npm run test:run` passes

#### Manual Verification:

- Full user journey: landing → sign up → dashboard → create field → plant cell → catalog → request plant → settings → sign out
- Admin journey via nav: approve request
- Visual consistency on mobile and desktop

**Implementation Note**: Final manual sign-off for design change.

---

## Testing Strategy

### Unit Tests:

- `POST /api/plant-requests` — 401, invalid body, success creates pending plant
- `getUserPendingPlants` — filters by user and status
- Middleware — `/api/plant-requests` requires auth (extend `middleware.test.ts` if prefix added)

### Integration Tests:

- None beyond handler tests; no DB integration in CI without Supabase

### Manual Testing Steps:

1. Open `/` — Polish garden copy, light theme
2. Sign in — redirect to `/dashboard`, nav visible
3. Navigate Katalog, Ustawienia, create field flow
4. Submit plant request — visible in list
5. Admin approve — plant appears in catalog
6. Hit bogus URL — Polish 404
7. Resize to 375px width — bottom nav tappable

## Performance Considerations

- SSR catalog and settings avoid extra client JS
- No new heavy fonts required in v1 (system stack)
- Removing blur/backdrop filters from cosmic glass may improve mobile paint cost

## Migration Notes

- No database migrations required (RLS already supports user pending plants)
- `DESIGN.md` replacement is documentation-only — no code depends on old emma.love content

## References

- Research: `context/changes/application-design/research.md`
- PRD UX: `context/foundation/prd.md` (mobile-first, Polish primary)
- Plant RLS: `supabase/migrations/20260609000000_plants_scope_drop_requests.sql`
- Related change: `context/changes/fix-field-region/plan.md` (location unification)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Design System & Polish Copy Foundation

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run build` passes

#### Manual

- [x] 1.3 `DESIGN.md` is garden earthy light spec (no emma.love)
- [x] 1.4 `global.css` tokens match DESIGN.md
- [x] 1.5 `pl.ts` covers nav, landing, auth, dashboard, catalog, settings

### Phase 2: Public Home & Auth Rebrand

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes

#### Manual

- [x] 2.3 Polish garden landing at `/` (no starter branding)
- [x] 2.4 Auth pages light-themed and Polish
- [x] 2.5 Sign-in redirects to `/dashboard`

### Phase 3: App Shell & Navigation

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `npm run build` passes
- [x] 3.3 Middleware tests pass

#### Manual

- [x] 3.4 AppShell nav on dashboard and field pages
- [x] 3.5 Mobile bottom nav usable
- [x] 3.6 Admin nav link for admin role only

### Phase 4: Missing Pages & User Plant-Request API

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm run build` passes
- [x] 4.3 Plant-requests API and service tests pass
- [x] 4.4 `npm run test:run` passes

#### Manual

- [x] 4.5 Catalog page lists global plants
- [x] 4.6 Plant request submit and list works
- [x] 4.7 Settings page shows email and location
- [x] 4.8 Polish 404 page

### Phase 5: Theme Migration & Admin Polish

#### Automated

- [x] 5.1 `npm run lint` passes — 548b2ce
- [x] 5.2 `npm run build` passes — 548b2ce
- [x] 5.3 `npm run test:run` passes — 548b2ce

#### Manual

- [x] 5.4 No cosmic/starter styling remains — 548b2ce
- [x] 5.5 Full user and admin journeys visually consistent — 548b2ce
- [x] 5.6 Mobile field grid and dialogs acceptable — 548b2ce
