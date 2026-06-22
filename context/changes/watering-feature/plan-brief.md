# Watering Feature — Plan Brief

> Full plan: `context/changes/watering-feature/plan.md`
> Research: `context/changes/watering-feature/research.md`

## What & Why

Add a manual watering action to the dashboard. Users can record that they watered their garden (+2 mm) with one click, either for all fields or per-field. The existing recommendation badges already exist but currently ignore manual watering — this closes that gap.

## Starting Point

`watering-recomendation-logic` change is complete: evaluation logic, `WateringBadge`, and `FieldListItem` with badges are all live. `getRainfall7dCalendarMm` returns the region's 7-day weather rainfall that drives badge status. There is no `watering_events` table, no write API, and no water buttons anywhere in the UI.

## Desired End State

Dashboard has a "Podlej wszystkie" button in the fields header. Each field row has a "Podlej" button. Pressing either records +2 mm for today in `watering_events`. After page reload, recommendation badges reflect the contribution — a field that needed watering today may show "OK" after pressing the button.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| All-fields model | Single row with `field_id IS NULL` | Simpler than one row per field; query uses OR clause | Research |
| Per-field support | `field_id NULLABLE UUID` from day one | Not meaningfully more complex than all-fields only | Research |
| Rainfall integration | New `getWateringEventsInWindow` fn; merge in `dashboard.astro` | Keeps `getRainfall7dCalendarMm` region-scoped and unchanged | Plan |
| FieldListItem | Refactor `<a>` to div composite | Nested interactive elements are invalid HTML | Plan |
| Field detail page | Out of scope | Focused MVP; dashboard covers primary use case | Plan |
| Button placement | Header row next to "+ Nowe pole" | Contextually grouped with field actions, immediately visible | Plan |
| Loading UX | Spinner during POST, reload on success, inline error | Matches `PlantingDialog` pattern; no optimistic update complexity | Research |
| Amount | Fixed 2 mm, no custom input | Simplest MVP; DB default handles it server-side | Research |
| Date | Always today (`DEFAULT CURRENT_DATE`) | No backfill in MVP | Research |
| Window filter | Only events within the same 7-day calendar window | Stale watering shouldn't affect today's recommendation | Plan |

## Scope

**In scope:**
- `watering_events` DB table with RLS
- `WateringEventRow` / `WateringEventInsert` TypeScript types
- `src/lib/services/watering-events.ts` — create, query, pure aggregation helper
- `POST /api/watering-events` endpoint
- "Podlej wszystkie" button in dashboard fields header
- Per-field "Podlej" button on each `FieldListItem`
- `getRainfall7dCalendarMm` extended to return `windowDates`
- Polish copy additions
- Unit tests for `aggregateWateringEventsMm` pure helper

**Out of scope:**
- Watering button on field detail page
- History / list of past watering events
- Custom `amount_mm` input
- Undo / delete watering event
- Backfill for past dates

## Architecture / Approach

`POST /api/watering-events` writes to `watering_events`. `dashboard.astro` fetches both `getRainfall7dCalendarMm` (region weather) and `getWateringEventsInWindow` (user's manual events for the same 7-day window) in parallel. Per-field effective rainfall = `weather_rainfall + aggregateWateringEventsMm(events, field.id)`. This sum feeds into the existing `evaluatePlantingWatering` unchanged. UI buttons are a shared `WaterButton` React component (spinner state, POST, reload on success).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration & Types | `watering_events` table + TS types | Migration must apply before any code works locally |
| 2. Service Layer | Create/query/aggregate fns; `getRainfall7dCalendarMm` returns `windowDates` | `windowDates` change is additive but touches a public function signature |
| 3. API Endpoint | `POST /api/watering-events` | Auth/RLS must prevent cross-user writes |
| 4. UI | Water buttons, FieldListItem refactor, dashboard wiring | FieldListItem refactor must not break field navigation |
| 5. Unit Tests | `aggregateWateringEventsMm` test coverage | Null-field (water-all) edge case must be covered |

**Prerequisites:** Local Supabase running (`npx supabase start`); `watering-recomendation-logic` change stable (automated gates green)
**Estimated effort:** ~2 sessions across 5 phases

## Open Risks & Assumptions

- `watered_at DEFAULT CURRENT_DATE` uses DB server time (UTC). Users in UTC+2 pressing "water" at 11 pm may record tomorrow's date — acceptable for MVP.
- The `windowDates` extension to `getRainfall7dCalendarMm` is additive; any existing callers that destructure the return value are unaffected.

## Success Criteria (Summary)

- Pressing "Podlej" records a `watering_events` row with `amount_mm = 2.0` and today's date
- After reload, a field previously showing "Podlej dziś" reflects the +2 mm in its badge calculation
- Field name navigation (click to open field detail) is unaffected by the FieldListItem DOM refactor
