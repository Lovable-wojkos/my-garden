<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Watering Recommendation Logic

- **Plan**: context/changes/watering-recomendation-logic/plan.md
- **Mode**: Deep
- **Date**: 2026-06-18
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical  4 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (fixed) |
| Plan Completeness | WARNING (fixed) |

## Grounding

Grounding: 8/8 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Calendar window timezone underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Calendar Rainfall / Critical Implementation Details
- **Detail**: Cron stores Open-Meteo calendar dates as `${r.date}T00:00:00Z` using `timezone=auto` from region coords. Plan said "Europe/Warsaw (or reuse timezone from getDailyWeather)" without picking one.
- **Fix A ⭐ Recommended**: Derive "today" via Open-Meteo auto timezone for region lat/lng; filter rows by `recorded_at` date prefix, not UTC bounds.
- **Decision**: FIXED via Fix A — applied to Critical Implementation Details and Phase 2 contract.

### F2 — Partial weather_records window undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — `getRainfall7dCalendarMm` contract
- **Detail**: Plan returned `null` only when no rows; partial cron backfill could trigger false `water_now`.
- **Fix A ⭐ Recommended**: Return `null` when fewer than 7 distinct calendar dates exist in window.
- **Decision**: FIXED via Fix A — applied to helper contract, Verification, Migration Notes, and Progress 2.3.

### F3 — Manual planting UX contradicts itself

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State / Verification vs Phase 4
- **Detail**: Verification said "muted ? line"; Phase 4 said omit badge.
- **Fix**: Lock to omit badge everywhere.
- **Decision**: FIXED — Verification and Phase 4 aligned to omit.

### F4 — Test filename drift in Desired End State

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State item 7 vs Phase 2
- **Detail**: Desired End State referenced `weather-rainfall.test.ts`; Phase 2 specified `weather-rainfall-calendar.test.ts`.
- **Fix**: Align to `weather-rainfall-calendar.test.ts`.
- **Decision**: FIXED.

### F5 — Stale cron data vs watering badges

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 5 — stale detection
- **Detail**: Phase 5 added widget stale badge but did not specify watering badge behavior when cron data >36h old.
- **Fix**: Hide watering badges when `rainfallStale` (same as null data).
- **Decision**: FIXED — applied to Critical Implementation Details, Phase 3, and Phase 5.

### F6 — `settings.astro` widget path implicit only

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architectural Fitness
- **Location**: Phase 5
- **Detail**: Settings page renders WeatherWidget without SSR rainfall props; fallback was implicit.
- **Fix**: Add explicit note that settings keeps live 7d mm fallback only.
- **Decision**: FIXED — added to Phase 5 WeatherWidget contract.

## Triage Summary

- **Fixed**: F1 (Fix A), F2 (Fix A), F3, F4, F5, F6 (6)
- **Verdict after fixes**: SOUND
