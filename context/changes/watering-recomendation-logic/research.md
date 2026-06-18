---
date: 2026-06-17T20:00:00+02:00
researcher: Auto
git_commit: 548b2cef81722787dd17206edd684c79ba0e893b
branch: development
repository: my-garden
topic: "Watering recommendation logic — mapping plant watering_needs to 7-day rainfall"
tags: [research, codebase, watering, rainfall, plantings, weather]
status: complete
last_updated: 2026-06-17
last_updated_by: Auto
---

# Research: Watering recommendation logic — mapping plant watering_needs to 7-day rainfall

**Date**: 2026-06-17T20:00:00+02:00  
**Researcher**: Auto  
**Git Commit**: `548b2cef81722787dd17206edd684c79ba0e893b`  
**Branch**: `development`  
**Repository**: my-garden

## Research Question

Start implementation of watering recommendation. Users can add plants to their field; each plant has watering requirements. We need configuration for how to map plant watering level (`low` / `medium` / `high`) to last-7-day rainfall level (mm).

## Summary

The product **requires** watering suggestions (PRD Business Logic) but **no numeric mapping** from `watering_needs` to rainfall thresholds has been approved anywhere in the repo. All prior slices built the **inputs** (plant catalog with `watering_needs`, field plantings, 7-day rainfall display) and explicitly deferred the **decision logic**.

**What exists today:**

| Layer | Status |
|-------|--------|
| Plant `watering_needs` on catalog rows | ✅ `low` / `medium` / `high` in seed data; free-text in admin UI |
| Field plantings linked to plants | ✅ `plant_id` + in-memory join (same pattern as harvest) |
| 7-day rainfall (mm) | ✅ Live via Open-Meteo in `WeatherWidget`; DB helpers exist but unused |
| Watering recommendation service | ❌ None |
| Threshold configuration | ❌ None |
| UI affordance (“should I water?”) | ❌ None |

**Recommended implementation shape for `/10x-plan`:**

1. Add a pure function service (e.g. `src/lib/services/watering.ts`) with **typed threshold config** mapping each normalized watering level to a minimum 7-day rainfall (mm) — start as code constants, not DB.
2. Reuse the **same rainfall semantics** as the widget: `WeatherData.rainfall7dMm` from `getWeather()` (sum of past calendar days before today in API timezone).
3. Join plantings → plants in app code (mirror `getHarvestDate` in `src/lib/harvest.ts`).
4. Surface result on the field detail page first (field-level or per-cell), before FR-013 notification plumbing.

## Detailed Findings

### Plant watering requirements

**Schema:** `plants.watering_needs` is nullable `text` — not an enum.

```30:36:src/types.ts
  name: string;
  growth_days: number | null;
  watering_needs: string | null;
  user_id: string | null;
  status: "pending" | "global";
```

**Seed catalog** (10 global plants) uses `low`, `medium`, `high`:

```25:35:supabase/migrations/20260609000000_plants_scope_drop_requests.sql
INSERT INTO plants (name, status, growth_days, watering_needs) VALUES
  ('Tomato',    'global', 70,  'high'),
  ('Carrot',    'global', 75,  'medium'),
  ...
  ('Garlic',    'global', 240, 'low');
```

**Admin entry** is free-text with placeholder `"low / medium / high"` (`AdminPlantRequestList.tsx`). Prior change brief requires downstream logic to handle unexpected casing/strings gracefully.

**Display normalization** exists only in catalog SSR — not in business logic:

```12:23:src/pages/dashboard/catalog.astro
function formatWateringNeeds(needs: string | null): string {
  if (!needs) return "—";
  switch (needs) {
    case "low":
      return pl.catalog.wateringLow;
    case "medium":
      return pl.catalog.wateringMedium;
    case "high":
      return pl.catalog.wateringHigh;
    default:
      return needs;
  }
}
```

Polish labels: `pl.catalog.wateringLow/Medium/High` → Niskie / Średnie / Wysokie (`src/lib/copy/pl.ts`).

### Planting flow and data join

**Field detail page** loads field, plantings, global plants catalog, and user prefs (for weather coords):

```32:38:src/pages/dashboard/fields/[id].astro
const [{ data: field, error: fieldError }, { data: plantings }, { data: plants }, { data: userPrefs }] =
  await Promise.all([
    getFieldById(supabase, id),
    getPlantingsByField(supabase, id),
    getPlants(supabase),
    getUserPreferences(supabase, user.id),
  ]);
```

**No SQL join** on plantings — `getPlantingsByField` returns raw rows; `getPlants` returns global catalog only.

**Existing join pattern** (harvest only) — identical structure needed for watering:

```3:9:src/lib/harvest.ts
export function getHarvestDate(planting: PlantingRow, plants: PlantRow[]): string {
  if (!planting.plant_id) return "–";
  const plant = plants.find((p) => p.id === planting.plant_id);
  if (plant?.growth_days == null) return "–";
  ...
}
```

**Gaps for watering logic:**

- `watering_needs` is never read in `FieldGrid` or `PlantingDialog`.
- Manual plantings (`plant_id` null, name only) have **no** watering needs — must degrade gracefully (unknown / skip / field default).
- Pending plants (`status = 'pending'`) are excluded from field-page catalog; only relevant if user planted before approval with `plant_id`.

### 7-day rainfall data

**Live path (used by UI):** `getWeather(lat, lng)` → `WeatherData.rainfall7dMm`

```89:109:src/lib/services/open-meteo.ts
  // Sum only the past-only window: indices where time[i] is strictly before today.
  let rainfall7dMm = 0;
  ...
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] >= todayInTz) continue;
    const rMm = precip[i];
    if (rMm != null) {
      rainfall7dMm += rMm;
      ...
    }
  }
  return {
    ...
    rainfall7dMm: Number(rainfall7dMm.toFixed(1)),
```

- **Units:** millimeters (mm), 1 decimal.
- **Window:** up to 7 **calendar days strictly before today** in Open-Meteo response timezone — not a rolling 168-hour window.
- **Also available:** `lastRainDate`, `lastRainMm`, `temperatureC`.

**Widget consumption:** `WeatherWidget` fetches `GET /api/weather?lat=&lng=` and displays `{rainfall7dMm} mm` with label “Opady (7 dni)”.

**Field page weather:** uses **user preferences coordinates**, not `field.region_id` — all fields share account-level location (MVP per PRD non-goals).

**Stored path (not used by widget):** nightly cron writes `weather_records` per region; `getRainfallLast7Days` / `getRainfallLast7DaysByCoords` in `src/lib/services/weather.ts` sum rows in a **rolling 7×24h** window. Semantics differ from live Open-Meteo — **do not mix** without explicit plan decision.

### Product requirements (foundation)

**Business logic** (`context/foundation/prd.md`):

> The application evaluates whether watering is needed based on plant needs and rainfall… The output is watering suggestions via in-app notifications when rainfall sum is low.

**Weather FRs:** FR-009 (7-day rainfall mm), FR-010 (last rain date), FR-007 (nightly pull). FR-009 note: *“7 days is arbitrary; consider making time window configurable in future.”*

**FR-013** (watering notifications): nice-to-have for MVP; in-app only; push deferred to v2.

**Roadmap vision:** core value is answering *“should I drive out to water today?”* — logic still marked as product gap in `context/202606172030_current.md`.

### What is NOT decided (threshold configuration)

No approved mapping exists for:

| Question | Current state |
|----------|---------------|
| mm threshold per `low` / `medium` / `high` | Undefined |
| Use cumulative 7d mm vs days-since-rain vs both | PRD mentions sum; aspirational research used days+temp |
| Field-level vs per-planting aggregation | Undefined |
| Missing `watering_needs` behavior | Undefined |
| Config in code vs DB vs admin UI | Undefined (PRD hints future configurable window) |

**Aspirational only** (not shipped) — `context/archive/2026-06-01-field-weather-view/10x-research-field-weather-view.md` proposed `evaluateInsights` with “no rain 5 days + temp > 20°C” — **not tied to `watering_needs`** and explicitly excluded from S-04 plan.

### Suggested configuration model (for planning)

A minimal, testable config shape aligned with user request:

```typescript
type WateringLevel = "low" | "medium" | "high";

/** Minimum 7-day rainfall (mm) to consider soil adequately wet for this level */
const WATERING_THRESHOLDS_MM: Record<WateringLevel, number> = {
  low: 10,    // placeholder — needs product/agronomy input
  medium: 20,
  high: 35,
};

type WateringStatus = "ok" | "water_soon" | "water_now" | "unknown";

function evaluateWatering(
  wateringNeeds: string | null,
  rainfall7dMm: number,
): WateringStatus;
```

**Normalization:** `trim().toLowerCase()` before lookup; unknown strings → `unknown` status.

**Comparison rule (simple MVP):** if `rainfall7dMm < threshold[level]` → recommend watering; optional second tier (e.g. `< 50% threshold` → `water_now`).

**Field aggregation options** (plan must pick one):

1. **Per-cell** — each planted cell shows status (richest UX, matches grid).
2. **Field worst-case** — if any high-need plant is under threshold, field needs water (safest).
3. **Weather panel only** — single banner on field page using max need among plantings.

**Service placement:** follow `src/lib/harvest.ts` + `src/lib/services/*.ts` convention; unit tests in `src/test/lib/watering.test.ts`.

**Rainfall input for SSR vs client:** field page already has SSR plantings/plants; rainfall is client-fetched in `WeatherWidget`. Options:

- Compute in widget and lift state (React context / callback) — couples components.
- New API `GET /api/watering?field_id=` that loads plantings, fetches weather server-side — cleaner boundary, testable.
- SSR: call `getWeather` in `[id].astro` when coords exist — matches harvest pattern, no extra round-trip.

### UI and copy

- `application-design/research.md` flags missing “should I water?” affordance.
- `DESIGN.md` mentions rainfall row as compact badges — watering status could extend field grid or weather card.
- Polish copy will need new strings in `src/lib/copy/pl.ts` (e.g. “Podlej dziś”, “Wystarczające opady”).

### Historical deferrals

| Archive change | Decision |
|----------------|----------|
| `2026-05-25-db-schema-and-migrations` | `watering_needs` descriptive only; FR-013 v2 |
| `2026-05-26-imgw-weather-probe` | No watering recommendations |
| `2026-06-01-nightly-weather-job-scaffold` | No watering logic |
| `2026-06-01-field-weather-view` | Agronomic insights out of scope |
| `2026-06-01-plant-catalog-requests` | Admin supplies `watering_needs`; blocks downstream logic |

Test fixtures already encode expected levels: `src/test/fixtures/expected-catalog.ts`.

## Code References

- `src/types.ts:28-36` — `PlantRow.watering_needs`
- `supabase/migrations/20260609000000_plants_scope_drop_requests.sql:25-35` — seed watering levels
- `src/lib/harvest.ts:3-9` — planting → plant join pattern to mirror
- `src/components/fields/FieldGrid.tsx:67-73` — cell display (harvest only today)
- `src/pages/dashboard/fields/[id].astro:32-61` — field detail SSR + weather widget
- `src/lib/services/open-meteo.ts:42-115` — `WeatherData`, `rainfall7dMm` computation
- `src/lib/services/weather.ts:14-57` — DB rainfall helpers (unused; different window semantics)
- `src/components/WeatherWidget.tsx:295-297` — 7-day rainfall display
- `src/pages/dashboard/catalog.astro:12-23` — watering level display mapping
- `src/lib/copy/pl.ts:86-89,172` — Polish watering/rainfall strings
- `context/foundation/prd.md:123-129` — business logic requirement

## Architecture Insights

- **Pure functions in `src/lib/`** for business rules (`harvest.ts` precedent); services for DB/API.
- **No enum for `watering_needs`** — normalize at evaluation time; do not assume DB constraint.
- **Single location per user (MVP)** — one rainfall series applies to all fields; simplifies config.
- **Live Open-Meteo is source of truth for UI** — threshold config should document that it compares against `rainfall7dMm`, not cron-backed `weather_records`, unless plan explicitly switches source.
- **FR-013 notifications** can layer on top once evaluation function + field UI exist; do not block MVP logic on notification infrastructure.

## Historical Context (from prior changes)

- `context/changes/application-design/research.md:164,216` — watering decision identified as gap; open UI question
- `context/changes/application-design/plan-brief.md` — watering notification UI out of scope for design change
- `context/202606172030_current.md` — product gap called out explicitly
- `context/archive/2026-06-01-field-weather-view/10x-research-field-weather-view.md:147-157` — brainstorm heuristic (days without rain + temp), not approved
- `context/archive/2026-06-15-testing-critical-path-coverage/research.md` — documents `watering_needs` as actual schema vs test-plan wording

## Related Research

- `context/changes/application-design/research.md` — UI gaps including watering affordance
- `context/archive/2026-06-01-field-weather-view/10x-research-field-weather-view.md` — aspirational agronomic insights
- `context/archive/2026-06-17-fix-field-region/research.md` — region vs coords weather paths

## Open Questions

1. **Threshold values (mm)** — What minimum 7-day rainfall satisfies `low` / `medium` / `high`? Needs product or domain input; placeholders required for first implementation.
2. **Aggregation** — Per-cell indicators vs single field-level recommendation?
3. **Rainfall source** — Confirm live `rainfall7dMm` (recommended) vs DB `getRainfallLast7Days*`?
4. **Secondary signals** — Include `lastRainDate` or temperature (aspirational research), or mm-only for v1?
5. **Manual plantings** — Show `unknown`, inherit field max need, or prompt to link catalog plant?
6. **Config evolution** — Code constants now; when to move thresholds to DB or admin settings (PRD FR-009 configurable window)?

## Recommended `/10x-plan` scope

**In scope:**

- `normalizeWateringNeeds()` + `WATERING_THRESHOLDS_MM` config
- `evaluateWatering()` / `evaluateFieldWatering(plantings, plants, rainfall7dMm)`
- Unit tests with seed catalog plants and edge cases (null needs, unknown string, borderline mm)
- Field detail UI: watering status (grid cell badge and/or weather-adjacent banner)
- Polish copy in `pl.ts`

**Out of scope (defer):**

- FR-013 push/in-app notification delivery mechanism
- Admin UI to edit thresholds
- Per-field coordinates (multi-location)
- Cron/`weather_records` as primary rainfall source
- Temperature / days-since-rain compound rules (unless product insists in plan interview)
