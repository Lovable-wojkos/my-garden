<!-- PLAN-REVIEW-REPORT -->

# Plan Review: IMGW Weather Probe Implementation Plan

- **Plan**: `context/changes/imgw-weather-probe/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-26
- **Verdict**: REVISE → SOUND (after triage fixes)
- **Findings**: 1 critical · 4 warnings · 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | FAIL    |

## Grounding

12/12 plan paths exist on disk · 3/3 referenced symbols verified (`createClient` in `src/lib/supabase.ts`, `PROTECTED_ROUTES` in `src/middleware.ts:4`, API route pattern in `src/pages/api/auth/signin.ts`) · brief↔plan consistent · Progress↔Phase mechanical contract PASS · no `context/foundation/lessons.md` or `docs/reference/contract-surfaces.md` present (checks skipped).

## Findings

### F1 — Dashboard uses undefined `supabase` variable

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4, item 3 — Dashboard page update
- **Detail**: Plan said "call `getUserPreferences(supabase, user.id)`" but `src/pages/dashboard.astro` has no Supabase client; middleware constructs one but does not expose it via `context.locals`. Implementer would have to guess.
- **Fix**: Specify the exact `createClient(Astro.request.headers, Astro.cookies)` pattern in Phase 4 and the prefs → `initialCity` mapping.
- **Decision**: FIXED — applied in plan.md Phase 4 item 3.

### F2 — shadcn/ui Card, Input, Badge are not installed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4, item 1
- **Detail**: Only `src/components/ui/button.tsx` exists. Plan referenced `Card`, `Input`, `Badge` with no install step.
- **Fix**: Add Phase 4 sub-step 0: `npx shadcn@latest add card input badge`.
- **Decision**: FIXED — added Phase 4 item 0 plus Progress step 4.1.

### F3 — `prerender = false` not specified on new API routes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3, Phase 4 item 2
- **Detail**: AGENTS.md hard rule requires `export const prerender = false` on API routes; plan omitted it (existing `signin.ts` also omits it, so the codebase already diverges).
- **Fix**: Add the export to each new route's Contract block.
- **Decision**: FIXED — added to all three route contracts.

### F4 — 30-min interval doesn't pause when tab is hidden

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4, item 1
- **Detail**: Plan specified `setInterval` but no cleanup on unmount, no pause on `document.hidden`, no refetch on tab refocus. Background tabs hit the API forever; stale flag may take hours to flip.
- **Fix**: Add "Interval & visibility hygiene" block: clear interval in `useEffect` cleanup, skip when hidden, refetch on visibilitychange if data > 30 min old.
- **Decision**: FIXED — added to WeatherWidget Contract.

### F5 — `/api/geocoding-suggestions` is an open proxy to Open-Meteo

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4, item 2
- **Detail**: Auth-gated but no rate limit; 300ms debounce with key-held-down floods Open-Meteo's 10k/day free tier.
- **Fix**: Require `q.trim().length >= 2` (return 400 `query_too_short` otherwise); widget uses `AbortController` to cancel previous in-flight request on each new debounced call.
- **Decision**: FIXED — route Contract and WeatherWidget Contract both updated.

### F6 — Existing weather service scaffolds become dead code

- **Severity**: ◦ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Current State Analysis
- **Detail**: `src/lib/services/weather.ts:1-33` exports three DB-keyed helpers unused by S-01 (S-01 bypasses regions and reads live from Open-Meteo).
- **Fix**: Add one line to "What We're NOT Doing" noting weather.ts stays for F-02.
- **Decision**: FIXED.

### F7 — `lastRainDate` semantics ambiguous when "today" has rain

- **Severity**: ◦ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details + Phase 2 Contract
- **Detail**: Plan didn't say whether today's index counts; Open-Meteo's default still ships forecast days alongside `past_days=7`. Risk: mislabeling forecast precipitation as observed last rain.
- **Fix**: Compute `rainfall7dMm` and `lastRainDate` only from indices where `daily.time[i] < today` in the response timezone.
- **Decision**: FIXED — both Critical Implementation Details and Phase 2 Contract updated.

## Triage Summary

- **Fixed**: F1, F2, F3, F4, F5, F6, F7 (7 of 7)
- **Skipped / Accepted / Dismissed**: none
- **Verdict after fixes**: REVISE → **SOUND**
