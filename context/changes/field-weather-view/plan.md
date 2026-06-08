---
change_id: field-weather-view
plan_created: 2026-06-08T21:02:27+02:00
planned_by: Copilot (Claude Sonnet 4.6)
branch: agents/field-weather-view-10x-research
status: planned
---

# Plan: field-weather-view (S-04)

## Goal

Add a weather panel to the field detail page (`src/pages/dashboard/fields/[id].astro`). All upstream slices are done — this is a **composition task**, not a build task.

## Prerequisites — all done

| Slice | Status | What was built |
|---|---|---|
| S-01 — Open-Meteo weather probe | ✅ archived | `WeatherWidget.tsx` — city search, temp/rainfall/last-rain, 30-min refresh, `initialCity` prop |
| S-02 — Field creation | ✅ archived | `FieldGrid.tsx` + `[id].astro` field detail page |
| S-03 — Planting record | ✅ archived | `PlantingDialog.tsx`, `/api/plantings` routes, harvest calc |
| F-02 — Nightly weather job | ✅ archived | `/api/cron/weather.ts`, `weather_records` table |

## Sole remaining gap

`[id].astro` renders `<FieldGrid>` but has **no weather panel**. S-04 adds one.

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Coordinate source | `user_preferences.latitude/longitude` | Consistent with dashboard `WeatherWidget`; no schema changes; MVP is single location per user |
| Weather data source | Live call via `WeatherWidget` (reuse) | Widget handles fetch, 30-min refresh, stale badge — no new API routes or queries needed |
| Missing preferences | `WeatherWidget` with `initialCity={null}` | Widget already handles empty state gracefully; user can search/set city inline |
| Layout | Responsive two-column | Grid (left, fluid) + weather panel (right, fixed-width) on `lg+`; stacked on mobile |

## Implementation

### Only file changed: `src/pages/dashboard/fields/[id].astro`

**1. Add imports:**

```ts
import { getUserPreferences } from "@/lib/services/user-preferences";
import WeatherWidget from "@/components/WeatherWidget";
```

**2. Extend the existing `Promise.all` fetch:**

```ts
const [
  { data: field, error: fieldError },
  { data: plantings },
  { data: plants },
  { data: userPrefs },
] = await Promise.all([
  getFieldById(supabase, id),
  getPlantingsByField(supabase, id),
  getPlants(supabase),
  getUserPreferences(supabase, user.id),   // ← new
]);
```

**3. Derive `initialCity`:**

```ts
const initialCity = userPrefs
  ? { cityName: userPrefs.city_name, latitude: userPrefs.latitude, longitude: userPrefs.longitude }
  : null;
```

**4. Update layout (responsive two-column):**

Current layout:
```html
<div class="mx-auto max-w-5xl">
  <div class="mb-6 flex items-center justify-between">…header…</div>
  <div class="rounded-2xl …">
    <FieldGrid client:load … />
  </div>
</div>
```

New layout:
```html
<div class="mx-auto max-w-6xl">
  <!-- header — full width -->
  <div class="mb-6 flex items-center justify-between">…header…</div>

  <!-- body — two-column on lg+, stacked on mobile -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
    <!-- left: field grid -->
    <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <FieldGrid client:load field={field} plantings={plantings ?? []} plants={plants ?? []} />
    </div>

    <!-- right: weather panel -->
    <div class="flex items-start justify-center lg:justify-start">
      <WeatherWidget client:load initialCity={initialCity} />
    </div>
  </div>
</div>
```

## Files changed

| File | Change |
|---|---|
| `src/pages/dashboard/fields/[id].astro` | Add imports, extend `Promise.all`, derive `initialCity`, change layout |

**No new files. No new API routes. No schema changes.**

## Out of scope (future slices)

- Field-level lat/lng — fields only have `region_id`; explicit field coordinates are a v2 enhancement
- Agronomic insights / watering indicators
- 7-day forecast panel
- IndexedDB client-side caching
- Multi-location support

## Progress

### Phase 1: Compose weather panel into field detail page

#### Automated

- [x] 1.1 Add getUserPreferences import and WeatherWidget import
- [x] 1.2 Extend Promise.all with getUserPreferences call
- [x] 1.3 Derive initialCity from userPrefs
- [x] 1.4 Update layout to responsive two-column grid

#### Manual

- [x] 1.M1 Visit a field detail page — weather panel renders on the right
- [x] 1.M2 Panel shows city from user preferences if set; shows search input if not
- [x] 1.M3 Layout stacks vertically on narrow screen, side-by-side on lg+
