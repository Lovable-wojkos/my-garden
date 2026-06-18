# Frame Brief: Watering recommendation logic

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Users see 7-day rainfall on the field page but receive no watering guidance anywhere in the app. The PRD Business Logic promises watering suggestions based on plant needs and rainfall; that output does not exist — the product promise is unfulfilled.

## Initial Framing (preserved)

- **User's stated cause or approach**: The gap is a missing configuration layer mapping plant `watering_needs` (`low` / `medium` / `high`) to last-7-day rainfall (mm), plus the evaluation code to apply it.
- **User's proposed direction**: Implement a pure-function watering service with typed threshold constants, unit tests, and surface status on the field detail page first.
- **Pre-dispatch narrowing**: Leading concern is the missing user-facing guidance (not “missing code” as an end in itself). Success looks like recommendations in **two places**: on the field list (`/dashboard`) and on the field detail view near individual plantings. Domain uncertainty: no agronomy input on whether 7-day cumulative mm is sound or whether three plant categories are sufficient.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Missing evaluation implementation** — no code joins `plantings` → `plants.watering_needs` with `rainfall7dMm` and no UI affordance exists
2. **Missing product/heuristic decision** — PRD locks the *shape* of the rule (plant needs × rainfall sum) but not mm thresholds, aggregation, or edge-case behavior; jumping to constants is guessing
3. 
4. **Rainfall source mismatch** — Open-Meteo `rainfall7dMm` (calendar days before tod**Wrong signal model** — archived brainstorm used days-since-rain + temperature instead of cumulative mm per plant levelay) vs DB `getRainfallLast7Days`* (rolling 168h) would make thresholds meaningless if mixed

## Hypothesis Investigation


| Hypothesis                           | Evidence                                                                                                                                                                                                                                                                                                             | Verdict                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Missing evaluation implementation    | No `watering.ts`, no eval API, `FieldGrid` shows harvest only (`src/lib/harvest.ts:3-9`, `src/components/fields/FieldGrid.tsx:67-74`); `WeatherWidget` displays mm only (`src/components/WeatherWidget.tsx:295-297`); field list cards are name/size only (`src/pages/dashboard.astro:54-66`)                        | **STRONG**                     |
| Missing product/heuristic decision   | PRD Business Logic: sum-based trigger (`context/foundation/prd.md:125-129`); FR-009: 7-day mm (`prd.md:93-94`); zero approved mm values across repo; explicit deferrals in every prior slice (`archive/2026-06-01-field-weather-view/plan.md:116`, `application-design/plan-brief.md:33`)                            | **STRONG**                     |
| Wrong signal model (mm vs days+temp) | PRD anchors decision on rainfall **sum**; archived `evaluateInsights` days+temp heuristic was out of scope and ignores `watering_needs` (`archive/2026-06-01-field-weather-view/10x-research-field-weather-view.md:147-157`); `WeatherData` exposes `rainfall7dMm` natively (`src/lib/services/open-meteo.ts:42-50`) | **WEAK**                       |
| Rainfall source mismatch             | UI uses live Open-Meteo via `/api/weather` only; DB helpers in `weather.ts` are unused; windows differ (calendar vs rolling 168h) — mixing would disagree with displayed “Opady (7 dni)”                                                                                                                             | **STRONG** (design constraint) |


## Narrowing Signals

Decisive observations from user answers and investigation:

- User’s primary pain is **absence of guidance**, not absence of a service file — implementation is means, not the problem statement.
- Desired UX is **broader than research assumed**: field list + per-planting on field detail, not field-detail-only.
- User explicitly lacks domain knowledge on 7-day mm and three categories — this is a **heuristic design gate**, not a blocker to shipping if the plan documents rationale and uses tunable constants.
- PRD already endorses **7-day cumulative mm + plant needs** as the decision model; three categories are already the catalog convention (`supabase/migrations/20260609000000_plants_scope_drop_requests.sql:25-35`).
- Independent cross-check landed on the same root cause: inputs exist separately, evaluation and connected UI were intentionally deferred.

## Cross-System Convention

This repo’s pattern for deferred business rules: build inputs in early slices (catalog `watering_needs`, plantings, rainfall display), defer decision logic to a dedicated change. Harvest date (`src/lib/harvest.ts`) is the precedent for planting→plant joins. PRD Business Logic and FR-009 align on sum-based, 7-day mm triggers — not the archived days+temp brainstorm. For rainfall, the live widget path (`getWeather().rainfall7dMm`) is the de-facto source of truth; DB aggregation helpers must not be used for evaluation without an explicit product decision to change the displayed number.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: ship a defensible MVP watering heuristic (3 plant-need tiers × 7-day cumulative mm, tunable constants, Open-Meteo source) and surface its output in the two places users expect — field list and field detail near plantings — not merely add an evaluation function in isolation.

The initial framing was **half right**. The implementation gap is real and is the primary engineering work. But it **collapsed** two distinct concerns: (a) choosing and documenting an MVP heuristic without agronomy expertise, and (b) wiring that heuristic into **two UI surfaces**. Research scoped UI to field detail only; the user wants list-level at-a-glance status as well. The “map levels to mm thresholds” direction remains valid and PRD-aligned, but threshold numbers must be treated as **approved heuristic placeholders** (with rationale and easy tuning), not discovered agronomic truth. Swapping to days-since-rain + temperature for v1 is not supported by PRD and is weaker given existing `WeatherData`.

## Confidence

**MEDIUM** — strong evidence on what’s missing and PRD-aligned model choice; weaker on threshold values and aggregation strategy, which the plan must resolve via an explicit heuristic-design step rather than silent engineer guesses.

Before `/10x-plan`, the plan interview should lock: mm constants per tier (with documented MVP rationale), field-list vs per-cell aggregation rules, and behavior for manual plantings / missing `watering_needs`.

## What Changes for /10x-plan

Plan around **heuristic design + dual-surface UX**, not “add `watering.ts`”. Include a short product/heuristic decision phase (constants, aggregation, unknown-plant fallback), lock `rainfall7dMm` from `getWeather()` as the rainfall input, and scope UI to both `dashboard.astro` (field list) and `FieldGrid` / field detail (per-planting). Defer FR-013 notification plumbing, admin threshold editing, and days+temp compound rules unless the interview explicitly expands scope.

## References

- Source files: `src/lib/harvest.ts:3-9`, `src/components/fields/FieldGrid.tsx:67-74`, `src/components/WeatherWidget.tsx:295-297`, `src/pages/dashboard.astro:54-66`, `src/pages/dashboard/fields/[id].astro:55-62`, `src/lib/services/open-meteo.ts:42-115`, `src/lib/services/weather.ts:14-57`
- Related research: `context/changes/watering-recomendation-logic/research.md`
- PRD: `context/foundation/prd.md:125-129`, FR-009
- Investigation tasks: explore agents (inputs path, product decisions, signal model, rainfall source, cross-system)

