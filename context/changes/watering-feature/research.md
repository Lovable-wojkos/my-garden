---
date: 2026-06-20T22:31:00+02:00
researcher: Copilot
git_commit: ba65eb91d819a7bed008b9ae2f44993f164412c9
branch: development
repository: my-garden
topic: "Manual watering action — +2 mm button on dashboard UI"
tags: [research, codebase, watering, dashboard, watering-events, rainfall, fields]
status: complete
last_updated: 2026-06-20
last_updated_by: Copilot
---

# Research: Manual watering action — +2 mm button on dashboard UI

**Date**: 2026-06-20T22:31:00+02:00
**Researcher**: Copilot
**Git Commit**: `ba65eb91d819a7bed008b9ae2f44993f164412c9`
**Branch**: `development`
**Repository**: my-garden

## Research Question

Add a manual watering action ("Water" button) on the dashboard UI. Pressing it records that the user watered, contributing +2 mm to the effective rainfall used in watering recommendations. Default assumption: watering applies to **all fields**; if per-field is not significantly more complex, allow the user to choose per field instead.

## Summary

The existing watering-recommendation infrastructure (`watering-recomendation-logic` change) is nearly complete — evaluation logic, DB rainfall helper, badges on dashboard and field grid all exist. What is entirely missing is the ability for users to **record manual watering**. There is no `watering_events` table, no write API, and no "Water" button anywhere.

**Per-field is not significantly more complex than all-fields**: the data model needs `field_id NULLABLE UUID` (null = all fields) regardless. The UI difference is minimal — a compact button per field list item. A "Water all" convenience action on the dashboard header covers the common case. **Recommendation: implement per-field with an all-fields shortcut.**

**Key integration point**: `getRainfall7dCalendarMm` (the function computing the 7-day calendar rainfall from `weather_records`) must also include `watering_events` amounts in the same calendar window so that badges reflect the manual watering.

**After-action UI refresh**: because badges are SSR-computed, a page reload after successful watering is the simplest approach (consistent with other destructive actions in the app).

---

## Detailed Findings

### 1. Current watering recommendation infrastructure

The `watering-recomendation-logic` change (all automated checks green; some manual verification pending) has already built:

| Artifact | File | Purpose |
|----------|------|---------|
| Evaluation functions | `src/lib/watering.ts:1-50` | `evaluateWatering`, `evaluatePlantingWatering`, `aggregateFieldWatering` |
| WateringBadge component | `src/components/fields/WateringBadge.tsx` | Compact/default badge per status |
| FieldListItem | `src/components/dashboard/FieldListItem.tsx:11-29` | Field row with watering badge |
| Dashboard SSR | `src/pages/dashboard.astro:31-61` | Fetches rainfall + plantings, computes per-field status |
| Field detail SSR | `src/pages/dashboard/fields/[id].astro:49-58` | Fetches rainfall, passes to FieldGrid |
| FieldGrid | `src/components/fields/FieldGrid.tsx:52-53` | Per-cell watering evaluation from `rainfall7dMm` prop |
| DB rainfall helper | `src/lib/services/weather.ts:148-200` | `getRainfall7dCalendarMm(client, regionId)` — canonical source |
| Polish copy | `src/lib/copy/pl.ts:174-181` | `pl.watering.*` keys |

**Important state**: `getRainfall7dCalendarMm` only reads `weather_records` (nightly cron rows). Manual watering is not factored in anywhere.

### 2. What is entirely missing

| Gap | Detail |
|-----|--------|
| `watering_events` table | No DB table; no migration; no TypeScript type |
| API endpoint for recording watering | No `POST /api/watering-events` or equivalent |
| Service function | No `createWateringEvent`, no `getWateringEventsInWindow` |
| UI affordance | No "Water" button anywhere in the app |
| Rainfall sum including manual events | `getRainfall7dCalendarMm` does not query `watering_events` |

### 3. DB schema constraints

`weather_records` RLS policy allows only service-role writes (nightly cron):

```sql
-- INSERT/UPDATE/DELETE intentionally omitted for authenticated role
-- (nightly cron uses service role key which bypasses RLS)
```
(`supabase/migrations/20260525000000_initial_schema.sql:192-194`)

Users **cannot** insert into `weather_records`. A dedicated `watering_events` table with `user_id` RLS is required.

### 4. All-fields vs per-field complexity analysis

| Dimension | All-fields only | Per-field |
|-----------|----------------|-----------|
| DB schema | `field_id` absent or fixed null | `field_id UUID NULL REFERENCES fields(id)` — null = all fields |
| Data model | One row per "water all" action | Same + optional specific field |
| Rainfall query | Sum events where `field_id IS NULL` | Sum events where `field_id = $fieldId OR field_id IS NULL` |
| API | `POST /api/watering-events`, no body needed | Same + optional `{ field_id }` |
| UI (dashboard) | One "Water all" button in header area | Same button + compact button per `FieldListItem` |
| UI (field detail) | None | "Water this field" button near weather widget or field header |
| Complexity delta | Baseline | **Minimal extra**: 1 param, 1 UI button per field, 1 OR clause in query |

**Conclusion**: per-field is not meaningfully more complex. The data model should be `field_id NULLABLE` from day one. The primary CTA is "Water all fields" on the dashboard; per-field buttons on `FieldListItem` or field detail are secondary.

### 5. Rainfall sum integration

`getRainfall7dCalendarMm` uses `sumCalendarRainfall` (pure function at `src/lib/services/weather.ts:107-133`) over `weather_records` rows. To include manual watering, the simplest approach is to:

1. Query `watering_events` for rows whose `watered_at` falls in the same 7-day calendar window (same field_id filter as above).
2. Sum `amount_mm` across those rows.
3. Add that sum to the `weather_records` sum before returning.

This keeps the pure `sumCalendarRainfall` function unchanged and avoids mixing table schemas. The combined sum is still a plain `number` fed into `evaluateWatering`.

**Alternative (avoid extra query)**: Insert a synthetic `weather_records` row via service role. Rejected — mixes real weather with manual input; confusing for future reads and reporting.

### 6. UI surfaces and layout

Dashboard (`src/pages/dashboard.astro:82-130`) renders:

```
div.grid lg:grid-cols-[1fr_auto]
  div.space-y-4           ← fields column
    div.flex.justify-between
      h2 "Moje pola"
      a "+ Nowe pole"      ← existing CTA
    ul
      li FieldListItem     ← one per field, shows WateringBadge
  div                     ← WeatherWidget column
```

**Natural placement for "Water all fields" button**: alongside "+ Nowe pole" in the header row, or as a secondary action button below the field list. Consistent with existing pattern of `bg-primary`/outline buttons.

**Per-field watering**: `FieldListItem` is currently a plain `<a>` element (`src/components/dashboard/FieldListItem.tsx:13`). To add a per-field watering button it must remain navigable but gain a separate interactive control — either a stop-propagation button inside the link (fragile), or convert the item to a `div` with explicit "Open field" and "Water" affordances. The latter is cleaner.

Field detail (`src/pages/dashboard/fields/[id].astro`) has no watering CTA today. A "Water this field" button above or beside the grid is natural.

### 7. Post-action UI refresh strategy

Watering badges are computed server-side in SSR. After a `POST /api/watering-events`, the page does not update automatically. Options:

| Option | Mechanism | Complexity |
|--------|-----------|------------|
| Full page reload | `window.location.reload()` or `router.push` | Low — consistent with `PlantingDialog` success (`src/components/fields/FieldGrid.tsx:100-103`) |
| React optimistic update | Client computes new status and updates badge state | Medium — requires rainfall and watering logic on the client |
| Polling/revalidation endpoint | `GET /api/watering-status?field_id=` | Medium — new API surface |

**Recommendation**: full page reload after successful POST. The `PlantingDialog` pattern already does this (`onSuccess` triggers `refetch` which re-fetches from API). For watering, a redirect to the same page (`Astro.redirect(Astro.url.pathname)`) or client-side `window.location.reload()` is sufficient for MVP.

### 8. API design pattern

Existing write APIs (e.g. `src/pages/api/fields/index.ts`, `src/pages/api/plantings/index.ts`) follow:

- Authenticate via `context.locals.user`.
- Create Supabase client from `context.request.headers` and `context.cookies`.
- Validate body with `zod`.
- Insert via service function.
- Return `{ id }` with status 201.

`POST /api/watering-events` should follow this same pattern. Zod schema:

```typescript
const CreateWateringEventSchema = z.object({
  field_id: z.string().uuid().optional().nullable(), // null = all fields
  amount_mm: z.number().positive().max(100).optional(), // defaults to 2.0
});
```

### 9. Proposed DB schema

```sql
CREATE TABLE watering_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id   uuid REFERENCES fields(id) ON DELETE CASCADE, -- nullable: null = all fields
  watered_at date NOT NULL DEFAULT CURRENT_DATE,
  amount_mm  numeric(5,2) NOT NULL DEFAULT 2.0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE watering_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watering_events_select_owner"
  ON watering_events FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "watering_events_insert_owner"
  ON watering_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "watering_events_delete_owner"
  ON watering_events FOR DELETE TO authenticated USING (user_id = auth.uid());
```

Migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_watering_events.sql`.

### 10. New Polish copy needed

No `pl.watering.waterAction*` keys exist today. Required additions to `src/lib/copy/pl.ts`:

```typescript
watering: {
  // … existing keys …
  waterAllButton: "Podlej wszystkie",
  waterFieldButton: "Podlej pole",
  waterAllConfirm: "Podlano wszystkie pola (+2 mm)",
  waterFieldConfirm: "Podlano pole (+2 mm)",
  waterError: "Nie udało się zapisać podlewania.",
}
```

---

## Code References

- `src/lib/watering.ts:1-50` — Evaluation functions and thresholds
- `src/lib/services/weather.ts:107-133` — `sumCalendarRainfall` (pure, reusable for watering events)
- `src/lib/services/weather.ts:148-200` — `getRainfall7dCalendarMm` — **must include `watering_events` sum**
- `src/pages/dashboard.astro:31-61` — Rainfall + plantings loaded per region; per-field status computed
- `src/pages/dashboard.astro:82-130` — Dashboard layout — "Water all" button placement
- `src/pages/dashboard/fields/[id].astro:49-58` — Rainfall loaded for field detail
- `src/components/dashboard/FieldListItem.tsx:11-29` — Currently a plain `<a>`; needs watering button
- `src/components/fields/FieldGrid.tsx:52-53` — Watering evaluation per cell from `rainfall7dMm` prop
- `src/components/fields/WateringBadge.tsx` — Reusable badge (no changes needed)
- `src/lib/copy/pl.ts:174-181` — `pl.watering.*` — needs new action/confirmation strings
- `src/pages/api/fields/index.ts` — API route pattern to mirror for watering events
- `supabase/migrations/20260525000000_initial_schema.sql:173-194` — `weather_records` with restricted INSERT
- `supabase/migrations/20260525000000_initial_schema.sql:100-132` — `fields` table with RLS for reference
- `context/changes/watering-recomendation-logic/plan.md` — Phase progress, existing infrastructure

---

## Architecture Insights

- **No watering_events table exists** — a migration is required before any code can be written.
- **Rainfall integration is additive** — the cleanest approach is to separately query `watering_events` for the calendar window and add to the `weather_records` sum, keeping `sumCalendarRainfall` unchanged.
- **Per-field events use `field_id IS NULL OR field_id = $targetField`** — one OR clause handles both "water all" and field-specific events in one query.
- **`getRainfall7dCalendarMm` is the single integration point** — it is called by both `dashboard.astro` and `fields/[id].astro`; updating it to accept and sum `watering_events` affects both surfaces automatically.
- **`FieldListItem` must become a composite element** — the current all-`<a>` layout conflicts with adding a button inside it; plan must decide the DOM refactor.
- **`amount_mm` defaulting to 2.0 in DB** — this makes the API call trivial (no body required for a "water all" quick action) while allowing future overrides.

---

## Historical Context (from prior changes)

- `context/changes/watering-recomendation-logic/plan.md` — 5-phase plan; automated gates all green, manual verification pending. The new watering-action feature depends on this being stable.
- `context/changes/watering-recomendation-logic/frame.md` — Established that watering UI must appear on both dashboard (field list) and field detail; confirmed `rainfall7dMm` from DB as the canonical rainfall input.
- `context/changes/watering-recomendation-logic/research.md` — Confirmed no evaluation service existed; recommended `src/lib/watering.ts` pattern. All those gaps are now filled.
- `context/archive/2026-06-01-field-creation/plan.md` — `fields.region_id` established; one region per user (MVP).
- `context/archive/2026-05-25-db-schema-and-migrations/plan.md` — Initial schema; `weather_records` INSERT restricted to service role (blocks synthetic weather record approach).
- `context/archive/2026-06-01-nightly-weather-job-scaffold/plan.md` — Cron writes `weather_records` per region; user writes never anticipated.

---

## Open Questions

1. **"Water all" scope**: Insert one `watering_events` row with `field_id = null`, or insert one row per user field? The former is simpler but requires the query to join fields to resolve ownership. The latter is redundant but makes per-field queries trivial. **Recommendation**: single row with `field_id = null`; query uses `field_id IS NULL OR field_id = $target` with a `user_id` filter.
2. **FieldListItem refactor**: Convert the `<a>` to a `div` with explicit navigation + watering button, or keep as a link and add a stop-propagation water icon? Plan must decide.
3. **Watering from field detail page**: Is the "Water this field" button on the field detail page in scope for the first implementation, or dashboard only?
4. **Date of watering**: Always today (`DEFAULT CURRENT_DATE`)? Or should the UI allow choosing a past date (backfill)? For MVP: always today.
5. **Badge refresh strategy**: Full page reload is recommended. Confirm this is acceptable before planning.
6. **`getRainfall7dCalendarMm` signature change**: Does it accept `fieldId` to sum field-specific events, or does it remain region-only and the caller handles merging? The cleaner API is to keep region-level rainfall separate from field-level manual events and let `dashboard.astro` merge them per field. Plan must decide.

---

## Recommended `/10x-plan` Scope

**In scope:**

1. `supabase/migrations/…_add_watering_events.sql` — new table with RLS.
2. `src/types.ts` — `WateringEventRow`, `WateringEventInsert`.
3. `src/lib/services/watering-events.ts` — `createWateringEvent`, `getWateringEventsInWindow(client, userId, fieldId | null, windowDates)`.
4. `src/lib/services/weather.ts` — extend `getRainfall7dCalendarMm` to accept optional `fieldId` and sum `watering_events` for the window alongside `weather_records`.
5. `POST /api/watering-events` — auth-gated, zod-validated, returns 201.
6. `src/components/dashboard/FieldListItem.tsx` — add "Water" button; refactor from `<a>` to composite element.
7. `src/pages/dashboard.astro` — add "Water all fields" button; reload after action.
8. `src/lib/copy/pl.ts` — new `pl.watering.waterAllButton`, `waterFieldButton`, confirmation strings, error string.
9. Unit tests for the updated `getRainfall7dCalendarMm` (watering events included in sum).

**Out of scope (defer):**

- Watering button on field detail page (can be follow-up).
- History/log of past watering events (no UI for viewing events yet).
- Custom `amount_mm` input (fixed 2 mm for MVP).
- Undo/delete watering event.
- Backfill watering for past dates.
