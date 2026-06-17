---
date: 2026-06-17T12:00:00+02:00
researcher: Cursor Agent
git_commit: 6572e01a46568811bbcd0eaedb95d3750f0e7d5f
branch: development
repository: my-garden
topic: "Application UI design baseline — current state vs DESIGN.md target"
tags: [research, codebase, ui, design-system, astro, shadcn, tailwind]
status: complete
last_updated: 2026-06-17
last_updated_by: Cursor Agent
---

# Research: Application UI design baseline

**Date**: 2026-06-17  
**Researcher**: Cursor Agent  
**Git Commit**: `6572e01a46568811bbcd0eaedb95d3750f0e7d5f`  
**Branch**: `development`  
**Repository**: my-garden

## Research Question

What is the current UI baseline of the garden management app, how does it relate to `context/foundation/DESIGN.md`, and what should the `application-design` change plan to deliver?

## Summary

The product **functionally implements the MVP roadmap** (fields, plantings, weather, admin catalog) but **visually remains the 10x Astro Starter** — a cosmic purple/blue glass theme with generic branding. `context/foundation/DESIGN.md` exists and is referenced from `AGENTS.md`, but it currently documents an **emma.love** dating-site aesthetic (warm espresso, copper glow) that is **not implemented anywhere** and is **not appropriate** for a garden app without deliberate adaptation.

The codebase has **no shared app shell** after login, **three competing visual dialects** (cosmic glass, shadcn light defaults, custom auth inputs), and **mixed Polish/English** copy. The highest-value design work is: (1) replace `DESIGN.md` with a garden-specific system aligned to the PRD (mobile-first, Polish-primary, weather + field focus), (2) tokenize colors/typography in `src/styles/global.css`, (3) extract a reusable `AppShell` layout, (4) rebrand landing and page titles, and (5) unify shadcn surfaces with the chosen theme.

## Detailed Findings

### Current design spec (`context/foundation/DESIGN.md`)

`AGENTS.md` requires agents to read `context/foundation/DESIGN.md` before UI changes. The file is **populated** (not empty) with a detailed design system extracted from **emma.love** — a dark, editorial dating product with Deep Espresso (#2B1C17), Copper Glow (#E18256), pill CTAs, and bento feature cards.

**Gap**: None of these tokens, fonts, or component rules appear in `src/`. The live app uses `bg-cosmic`, purple/blue gradients, and glass morphism. Applying emma.love verbatim would produce a mismatched product identity for a garden tool and conflicts with PRD expectations (outdoor, practical, mobile-first).

**Action for planning**: Treat `DESIGN.md` as a **draft to replace or heavily rewrite** for garden context — not as the implemented source of truth.

### Layout and navigation architecture

**Single root layout** — `src/layouts/Layout.astro` provides HTML shell, global CSS, optional config banners, and `<slot />`. No nav, header, footer, or semantic landmarks.

```10:38:src/layouts/Layout.astro
const { title = "10x Astro Starter" } = Astro.props;
// ...
<body>
  { missingConfigs.map(...) }
  <slot />
</body>
```

**Chrome is page-local**:

| Element | Location | Scope |
|---------|----------|-------|
| `Topbar.astro` | Landing only | Sign in / Dashboard / Sign out |
| Inline header | `dashboard.astro`, `fields/[id].astro` | Title + sign out / back link |
| Config banners | `Layout.astro` → `Banner.astro` | All pages when Supabase misconfigured |
| App nav / sidebar | — | **Missing** |
| Footer | — | **Missing** |

Authenticated users lose the only shared nav (`Topbar`) when entering `/dashboard`. Admin (`/admin/plant-requests`) is reachable only by direct URL — no in-app link.

### User-facing routes (8 pages)

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `/` | `src/pages/index.astro` | Public | Starter landing — "10x Astro Starter" hero |
| `/auth/signin` | `src/pages/auth/signin.astro` | Public | Email/password sign-in |
| `/auth/signup` | `src/pages/auth/signup.astro` | Public | Registration |
| `/auth/confirm-email` | `src/pages/auth/confirm-email.astro` | Public | Post-signup confirmation |
| `/dashboard` | `src/pages/dashboard.astro` | Protected | Field list + weather sidebar |
| `/dashboard/fields/new` | `src/pages/dashboard/fields/new.astro` | Protected | Create field form |
| `/dashboard/fields/[id]` | `src/pages/dashboard/fields/[id].astro` | Protected | Planting grid + weather |
| `/admin/plant-requests` | `src/pages/admin/plant-requests.astro` | Admin | Plant approval queue |

Protected routes: `src/middleware.ts` lines 6–14 (`/dashboard`, `/admin`, related APIs).

**Missing vs PRD / polished product**: settings/profile, plant catalog browser, user plant-request UI (API exists; no user-facing page), harvest tracking, watering reminders, field edit/delete, 404 page, garden-focused marketing landing.

### Visual theme and tokens

**Tailwind 4** — CSS-first config in `src/styles/global.css`; no `tailwind.config.*`. **shadcn/ui** — `components.json`: style `new-york`, baseColor `neutral`, cssVariables `true`.

**shadcn semantic tokens** (`:root` / `.dark`) are defined but largely **bypassed** on main surfaces. Pages use hardcoded `bg-cosmic` instead of `bg-background`:

```113:115:src/styles/global.css
@utility bg-cosmic {
  background-image: linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a);
}
```

**Implemented visual language** (cosmic starter):

| Role | Classes / values |
|------|------------------|
| Page background | `bg-cosmic` navy gradient |
| Surfaces | `bg-white/5`, `bg-white/10`, `backdrop-blur-xl` |
| Borders | `border-white/10`, `border-white/20` |
| Accents | Purple (`purple-300`, `purple-600`), blue gradients |
| Headings | `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text` |
| Typography | System sans-serif only — no custom font loaded |

**Dark mode**: `.dark` token set exists (lines 41–73) but no toggle; pages don't use `.dark` class.

### Three visual dialects (inconsistency)

1. **Cosmic glass** — Most Astro pages (`Welcome.astro`, `dashboard.astro`, field pages): `bg-cosmic`, white/10 cards, gradient headings.
2. **shadcn light defaults** — `CreateFieldForm.tsx` uses standard `Input`/`Button` without dark-context overrides; admin page uses white card + `text-slate-900`.
3. **Custom auth glass** — `FormField.tsx` bespoke inputs (`bg-white/10`, `focus:ring-purple-400`) — not shadcn `Input`.

Example admin outlier:

```23:28:src/pages/admin/plant-requests.astro
<div class="bg-cosmic min-h-screen p-4 md:p-6">
  <div class="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white p-6 shadow-xl">
    <h1 class="mb-1 text-2xl font-semibold text-slate-900">Plant Requests</h1>
```

`PlantingDialog.tsx` manually themes dialog (`bg-slate-900`, `border-white/10`) while `CreateFieldForm` does not theme combobox/popover for dark pages.

### Component inventory

**Astro (shell / static)**

| Component | Role |
|-----------|------|
| `Layout.astro` | Root HTML |
| `Welcome.astro` | Landing hero + feature cards |
| `Topbar.astro` | Landing-only nav |
| `Banner.astro` | Config warnings |

**React islands (features)**

| Component | Used on | Role |
|-----------|---------|------|
| `SignInForm`, `SignUpForm` | Auth pages | Validated forms |
| `FormField`, `SubmitButton`, `PasswordToggle` | Auth | Custom glass inputs |
| `CreateFieldForm` | New field | shadcn form + region combobox |
| `FieldGrid` | Field detail | Clickable cell grid |
| `PlantingDialog` | Field detail | Add/edit/delete planting modal |
| `WeatherWidget` | Dashboard, field | City search + weather card (shadcn Card/Badge) |
| `AdminPlantRequestList` | Admin | Approve/reject workflow |

**shadcn/ui installed** (`src/components/ui/`): `button`, `input`, `label`, `card`, `dialog`, `popover`, `command`, `badge`. `LibBadge.astro` is unused.

**Reusable layout patterns worth preserving**:

- Dashboard / field detail: `lg:grid-cols-[1fr_auto]` — main content + weather sidebar
- Glass card recipe: `rounded-xl border border-white/10 bg-white/5 p-4`
- `FieldGrid` + `PlantingDialog` — core interactive garden UX

### PRD-driven UX requirements (design implications)

From `context/foundation/prd.md`:

- **Mobile-first** — primary use on phones in fields with poor connectivity
- **Performance** — load under ~3s on mobile
- **Polish primary, English support** — weather widget already Polish (`Nie udalo sie pobrac...`); forms and grid labels mostly English
- **Core user story (US-01)** — field layout, planting details, weather panel (implemented functionally)
- **Watering decision** — business logic describes in-app notifications when rainfall is low; **no UI affordance** yet for "should I water?"
- **Parked UI scope** — seed quantity/weight (FR-004), harvest recording (FR-012), push notifications (v2)

### Mobile and accessibility gaps

- `FieldGrid` cells: `min-h-[72px]`, `text-xs` — tight for multi-line planting info on small screens
- No `<main>`, `<nav>` landmarks; default `<title>` still "10x Astro Starter" on many pages
- `window.confirm` for admin reject — unstyled native dialog
- No loading skeletons, empty-state illustrations, or dedicated error pages
- Favicon referenced in layout; verify `public/favicon.png` exists in deploy

## Code References

- `src/layouts/Layout.astro:10` — default title still "10x Astro Starter"
- `src/components/Welcome.astro:35` — landing H1 branding
- `src/styles/global.css:6-115` — shadcn tokens + `bg-cosmic` utility
- `components.json:1-21` — shadcn new-york / neutral config
- `src/pages/dashboard.astro:19-36` — duplicated header + two-column layout seed
- `src/components/fields/FieldGrid.tsx:37-91` — interactive planting grid
- `src/components/fields/PlantingDialog.tsx:154` — manually themed dialog
- `src/components/auth/FormField.tsx:5-6` — custom input styling separate from shadcn
- `src/components/WeatherWidget.tsx` — shadcn Card on cosmic pages
- `src/pages/admin/plant-requests.astro:24-28` — light card on cosmic background
- `context/foundation/DESIGN.md` — emma.love spec (unimplemented, wrong domain)
- `AGENTS.md:14-21` — rule to consult DESIGN.md before UI work

## Architecture Insights

1. **Astro SSR + React islands** — static shells in `.astro`, interactivity in `.tsx` with `client:load`. Design system changes must cover both layers.
2. **Tailwind 4 CSS variables** — the right place to centralize garden brand tokens is `global.css` `@theme inline` and `:root`, replacing ad-hoc `bg-cosmic` / purple utilities over time.
3. **shadcn is partially adopted** — complex flows (combobox, dialog, command) use primitives; auth and landing use bespoke markup. Unification should pick **one** input/button language.
4. **No design-to-code pipeline** — `DESIGN.md` is documentation-only; nothing enforces token usage except agent rules and code review.
5. **Layout duplication** — extracting `AppShell.astro` (nav, page title slot, max-width wrapper) would reduce drift between dashboard, field, and future settings pages.

## Historical Context (from prior changes)

- **`context/archive/2026-06-09-ui-data-display-fixes/`** — User-reported UI bugs (wrong temperature, last-rain volume, region granularity). Shows weather/location UI was iterated for **data accuracy**, not visual design.
- **Roadmap slices S-02–S-04 (done)** — Field grid, planting dialog, weather panel built with **functional-first** UI; roadmap explicitly deferred "draw columns and rows" visual editor complexity to numeric form fallback.
- **Starter origin** — `context/foundation/tech-stack.md` records `10x-astro-starter` as bootstrap; cosmic theme is starter residue.
- **`application-design` change** — `change.md` notes starter baseline; status was `new` before this research.

## Related Research

- `context/changes/fix-field-region/research.md` — region/location data model (affects location picker UX in create-field and weather widget)
- `context/archive/2026-06-01-field-creation/` — field creation UI decisions (numeric rows/cols vs visual editor)

## Open Questions

1. **Design direction** — Should the garden app use a **light, earthy outdoor** palette (greens, soil browns, parchment) or adapt the existing **dark cosmic** glass into a "night garden" theme? PRD says mobile-first practicality; emma.love dark editorial is a third unrelated direction.
2. **DESIGN.md location** — `AGENTS.md` points to `context/foundation/DESIGN.md`; `change.md` still mentions `context/DESIGN.md`. Consolidate on one path.
3. **Language strategy** — Polish-primary per PRD: full i18n system vs hardcoded Polish for user-facing strings first?
4. **App shell IA** — Bottom nav vs top nav vs sidebar for mobile-first garden use (often one-handed, outdoor)?
5. **Watering affordance** — How should "should I water today?" surface in the field/weather UI when notification logic is built?
6. **Scope of application-design** — Visual rebrand only, or include missing pages (settings, catalog browse, user plant requests)?

## Recommended `DESIGN.md` outline (for `/10x-plan`)

When rewriting `context/foundation/DESIGN.md`, cover at minimum:

1. **Product identity** — name, tone (practical gardener, not cosmic dev starter), Polish-first copy rules
2. **Color tokens** — map to CSS variables in `global.css` (replace `bg-cosmic` with semantic names)
3. **Typography** — font pairing, scale, mobile sizes for grid labels
4. **Layout** — `AppShell` spec, max widths, dashboard + field two-column behavior on mobile
5. **Components** — button variants, cards, forms, dialogs (shadcn overrides for chosen theme)
6. **Field grid** — cell density, touch targets (min 44px), empty/planted states
7. **Weather panel** — hierarchy for temp, 7-day rain, last rain (align with fixed data from ui-data-display-fixes)
8. **Motion** — restrained transitions; no bounce (outdoor app = clarity over drama)
9. **Do / Don't** — e.g. don't use starter branding; don't mix light admin cards on dark shell without token alignment

## Suggested implementation phases (input to plan)

| Phase | Focus | Rationale |
|-------|-------|-----------|
| 1 | Rewrite `DESIGN.md` + CSS tokens | Single source of truth before code churn |
| 2 | `AppShell` + rebrand landing/titles | Fixes IA and starter residue |
| 3 | Unify forms/dialogs to tokens | Removes three dialects |
| 4 | Mobile grid + weather polish | PRD mobile-first + core UX |
| 5 | Missing pages (settings, catalog) | Optional; may be separate changes |
