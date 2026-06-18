# Watering Recommendation Logic — Plan Brief

> Full plan: `context/changes/watering-recomendation-logic/plan.md`
> Frame brief: `context/changes/watering-recomendation-logic/frame.md`
> Research: `context/changes/watering-recomendation-logic/research.md`

## What & Why

> **The actual problem to plan around is**: ship a defensible MVP watering heuristic (3 plant-need tiers × 7-day cumulative mm, tunable constants, cron-backed rainfall) and surface its output in the two places users expect — field list and field detail near plantings — not merely add an evaluation function in isolation.

Users see rainfall but get no guidance on whether to water. This plan implements the PRD Business Logic using catalog `watering_needs` and 7-day rainfall summed from nightly cron data in `weather_records`.

## Starting Point

Plant catalog has `low` / `medium` / `high` watering needs; fields have plantings; cron writes daily weather per region; `WeatherWidget` shows live conditions and live 7d mm. No evaluation code, no thresholds, no watering badges. Harvest date join in `src/lib/harvest.ts` is the pattern to mirror.

## Desired End State

Gardeners see watering status on the dashboard field list (worst-case per field) and on each planted grid cell on the field detail page. Status uses three tiers: sufficient rain, water soon, water now. Widget 7-day mm matches the DB sum used for logic; current temp/conditions stay live. No badges when there is no rainfall data or no plantings.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Rainfall input | Cron `weather_records`, calendar 7d sum by `region_id` | Avoid per-field/per-cell API calls; data already fetched nightly | Plan |
| Widget 7d mm | DB sum; live API for current conditions | User sees consistent mm for logic; fresh temp/weather code | Plan |
| Thresholds (mm) | low=10, medium=20, high=35 | Balanced MVP placeholders, easy to tune | Plan |
| Status tiers | ok / water_soon / water_now / unknown | Urgency gradation; `water_now` below 50% of tier threshold | Plan |
| Field aggregation | Worst-case among evaluable plantings | Any plant needing water → field needs water | Frame + Plan |
| Manual plantings | `unknown`, excluded from field aggregation | Honest; no guess without catalog link | Plan |
| Empty fields | No watering badge | No plants → no watering need | Plan |
| Missing weather data | Hide all watering badges | No false recommendations | Plan |

## Scope

**In scope:**

- `src/lib/watering.ts` + unit tests
- Calendar 7d rainfall helper from `weather_records`
- Dashboard field-list badges + field grid per-cell badges
- Polish copy, `WateringBadge` component
- WeatherWidget DB rainfall display
- Minimal DESIGN.md update

**Out of scope:**

- FR-013 notifications
- Admin threshold editing
- Multi-location rainfall
- Days-since-rain + temperature rules
- DB persistence of recommendations

## Architecture / Approach

```
cron → weather_records (daily rainfall_mm per region)
         ↓
getRainfall7dCalendarMm(region_id)  ← one query per page
         ↓
evaluatePlantingWatering(planting, plants, mm)  ← pure function
         ↓
aggregateFieldWatering → field list badge
per-cell badge on FieldGrid
```

Pages load plantings once (all user plantings on dashboard; field plantings on detail). Evaluation is in-memory. Widget receives `rainfall7dMmFromDb` from the same query.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Domain logic | `watering.ts` + tests | Threshold boundaries must match three-tier rules |
| 2. DB rainfall | Calendar 7d sum helper | Window math must match cron date storage |
| 3. SSR wiring | Dashboard + field detail data load | Dashboard needs new `getPlantingsByUser` |
| 4. UI | List + grid badges, Polish copy | Dense grid cells on mobile |
| 5. Widget align | DB 7d mm in widget row | Stale data UX |

**Prerequisites:** User has `region_id` in preferences; cron has populated `weather_records` for that region.

**Estimated effort:** ~2–3 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Threshold mm values are heuristic, not agronomy-validated — document in code comments.
- New users may see no badges until first successful cron run for their region.
- Existing `getRainfallLast7Days` rolling window is not used for watering (different semantics).
- Frame confidence was MEDIUM; mitigated by explicit heuristic table in plan.

## Success Criteria (Summary)

- Field list shows watering badge when any planted field needs water (worst-case).
- Field grid shows per-planting status from catalog `watering_needs` and DB rainfall.
- Widget 7d mm matches evaluation input on the same page.
- Lint, build, and unit tests pass.
