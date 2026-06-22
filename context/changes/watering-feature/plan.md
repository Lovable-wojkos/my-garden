# Watering Feature Implementation Plan

## Overview

Add a manual watering action to the dashboard. Users can press "Podlej wszystkie" (water all fields) in the dashboard header, or a per-field "Podlej" button on each `FieldListItem`. Each press records a +2 mm watering event for the current date. Those events are included in the 7-day rainfall window used by the existing recommendation badges, so badges immediately reflect the manual watering after page reload.

## Current State Analysis

The `watering-recomendation-logic` change is complete: evaluation functions, `WateringBadge`, and `FieldListItem` with badges all exist. `getRainfall7dCalendarMm` is the canonical data source, returning a single `number` for the region's 7-day weather rainfall. Watering badges on the dashboard are computed server-side in `dashboard.astro` from that number.

What is entirely missing: the `watering_events` DB table, a write API, any service functions for watering events, and all UI affordances.

### Key Discoveries:

- `FieldListItem` (`src/components/dashboard/FieldListItem.tsx:13`) is a bare `<a>` tag — must become a div composite to add a sibling water button without invalid nested interactive elements
- `getRainfall7dCalendarMm` (`src/lib/services/weather.ts:148`) returns `{ data, error, latestRecordedAt, rainfallStale }` — we will extend it to also return `windowDates: string[]` so dashboard.astro can reuse the computed window for the watering events query without re-deriving the timezone
- `getCalendarWindowDates` is already exported from `src/lib/services/weather.ts` (used in tests at `src/test/lib/weather-rainfall-calendar.test.ts:11`)
- `sumCalendarRainfall` remains unchanged — `aggregateWateringEventsMm` is a separate pure helper in the new service file
- API pattern: `src/pages/api/fields/index.ts` — auth check → JSON parse → zod → createClient → service call → 201

## Desired End State

Dashboard shows "Podlej wszystkie" next to "+ Nowe pole". Each field row has a "Podlej" button. Pressing either fires a `POST /api/watering-events`, shows a spinner while in-flight, then reloads the page. After reload, watering badges reflect the manual +2 mm contribution (aggregated over the 7-day window). Badges computed from `rainfall7dMm + manualWateringMm` for each field.

### Key Discoveries:

- Migration timestamp: `20260620120000_add_watering_events.sql`
- `field_id NULLABLE UUID` — null = "water all fields" event; query uses `field_id IS NULL OR field_id = $targetId`
- `watered_at date DEFAULT CURRENT_DATE` — always today; no backfill in this implementation
- `amount_mm numeric(5,2) DEFAULT 2.0` — fixed 2 mm; no custom amount input
- RLS: select/insert/delete by `user_id = auth.uid()`; no update policy needed

## What We're NOT Doing

- Watering button on field detail page (`/dashboard/fields/[id]`) — deferred
- Viewing/listing past watering events — no history UI
- Custom `amount_mm` input — fixed 2 mm only
- Undo or delete watering event
- Backfill watering for past dates
- Field detail page query changes (only dashboard.astro is updated)

## Implementation Approach

Five sequential phases: schema → service → API → UI → tests. Each phase gates the next: the migration must exist before any code can run locally; the service must exist before the API; the API must exist before UI buttons can fire real requests.

Dashboard.astro will call `getWateringEventsInWindow` using the `windowDates` returned by the extended `getRainfall7dCalendarMm`. It then calls `aggregateWateringEventsMm(rows, field.id)` per field and adds the result to `rainfall7dMm` before passing to `evaluatePlantingWatering`.

## Phase 1: DB Migration & Shared Types

### Overview

Create the `watering_events` table with RLS and add the corresponding TypeScript types.

### Changes Required:

#### 1. DB Migration

**File**: `supabase/migrations/20260620120000_add_watering_events.sql`

**Intent**: Create `watering_events` table with per-user RLS. Users can insert and delete their own rows; no other roles write to this table.

**Contract**:
```sql
CREATE TABLE watering_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id   uuid REFERENCES fields(id) ON DELETE CASCADE,
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

#### 2. TypeScript Types

**File**: `src/types.ts`

**Intent**: Add `WateringEventRow` and `WateringEventInsert` following the Row/Insert/Update pattern used by all other entities in this file.

**Contract**: `WateringEventRow` — `id: string`, `user_id: string`, `field_id: string | null`, `watered_at: string`, `amount_mm: number`, `created_at: string`. `WateringEventInsert` — `id?`, `user_id`, `field_id?`, `watered_at?`, `amount_mm?`, `created_at?`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset` or `npx supabase migration up`
- TypeScript build passes with new types: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- `watering_events` table visible in local Supabase Studio with correct columns and RLS policies
- Authenticated user can INSERT a row; a different user's SELECT returns nothing for the first user's rows

**Implementation Note**: Pause here for manual DB verification before proceeding.

---

## Phase 2: Service Layer

### Overview

New service file for watering events (create, query, pure aggregation). Extend `getRainfall7dCalendarMm` to return `windowDates` so dashboard.astro can reuse them.

### Changes Required:

#### 1. Watering Events Service

**File**: `src/lib/services/watering-events.ts` (new file)

**Intent**: Three exports — `createWateringEvent` (write a new event), `getWateringEventsInWindow` (read events for a user within a date window), `aggregateWateringEventsMm` (pure helper: sum amount_mm for a given fieldId from a row array, counting both exact-field rows and null-field "water all" rows).

**Contract**:
- `createWateringEvent(client: SupabaseClient, insert: WateringEventInsert): Promise<{ data: WateringEventRow | null; error: unknown }>`
- `getWateringEventsInWindow(client: SupabaseClient, userId: string, windowDates: string[]): Promise<{ data: WateringEventRow[] | null; error: unknown }>` — filters `.eq('user_id', userId)` and `.in('watered_at', windowDates)`
- `aggregateWateringEventsMm(rows: WateringEventRow[], fieldId: string): number` — sums `amount_mm` for rows where `field_id === fieldId` (field-specific) or `field_id === null` (all-field events); returns 0 when `rows` is empty

#### 2. Extend getRainfall7dCalendarMm return type

**File**: `src/lib/services/weather.ts`

**Intent**: Add `windowDates: string[]` to the return value of `getRainfall7dCalendarMm` so callers can reuse the already-computed 7-day window without re-deriving the timezone.

**Contract**: The existing `windowDates` local variable (computed at line ~180) is added to the returned object in all return paths. Paths that return early (region error, timezone error) return `windowDates: []`. The function signature changes from returning `{ data, error, latestRecordedAt, rainfallStale }` to `{ data, error, latestRecordedAt, rainfallStale, windowDates }`. This is an additive change — existing callers that destructure only `{ data, rainfallStale }` are unaffected. Add a comment above the return type documenting that `windowDates` is an intentional extension point for consumers needing the 7-day window boundary dates.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`
- Existing weather tests still pass: `npx vitest run src/test/lib/weather-rainfall-calendar.test.ts`

#### Manual Verification:

- Review the service file for correct RLS-compatible query shape (user_id filter present)

---

## Phase 3: API Endpoint

### Overview

`POST /api/watering-events` — auth-gated, zod-validated, writes one watering event, returns 201.

### Changes Required:

#### 1. API Route

**File**: `src/pages/api/watering-events.ts` (new file)

**Intent**: Follow the exact pattern of `src/pages/api/fields/index.ts`: check `context.locals.user`, parse JSON, validate with zod, create Supabase client, call service function, return 201 with `{ id }`. Body is optional — an empty `{}` body is valid (defaults to all-fields, 2 mm, today).

**Contract**: Zod schema:
```typescript
const CreateWateringEventSchema = z.object({
  field_id: z.string().uuid().optional().nullable(),
  amount_mm: z.number().positive().max(100).optional(),
});
```
On success: `{ id: data.id }` with status 201. On auth failure: 401. On zod failure: 400 with `{ errors }`. On service error: 500. Export `const prerender = false`.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- `curl -X POST /api/watering-events` with valid auth cookie returns 201
- Missing/invalid auth returns 401
- Invalid `field_id` (non-UUID) returns 400

---

## Phase 4: UI

### Overview

Add Polish copy keys, create the `WaterButton` React component, refactor `FieldListItem` to a div composite, and wire everything into `dashboard.astro`.

### Changes Required:

#### 1. Polish Copy

**File**: `src/lib/copy/pl.ts`

**Intent**: Add action/confirmation/error strings to the existing `watering` object.

**Contract**: Add to the `watering` object (after the existing `waterNowShort` key):
```typescript
waterAllButton: "Podlej wszystkie",
waterFieldButton: "Podlej",
waterSuccess: "Podlano (+2 mm)",
waterError: "Nie udało się zapisać podlewania.",
```

#### 2. WaterButton Component

**File**: `src/components/dashboard/WaterButton.tsx` (new file)

**Intent**: Reusable React client component that POSTs to `/api/watering-events`, shows a spinner while in-flight, and triggers `window.location.reload()` on success. Displays an inline error message on failure. Accepts `fieldId?: string | null` (null or undefined = water all fields) and `label: string`.

**Contract**: Props `{ fieldId?: string | null; label: string; className?: string }`. On click: set `isPending = true`, clear error, POST `JSON.stringify({ field_id: fieldId ?? null })` to `/api/watering-events` with `Content-Type: application/json`. On 2xx: `window.location.reload()`. On error: set `error = pl.watering.waterError`, `isPending = false`. Renders a `<button>` disabled when `isPending`, with a spinner icon (or `…` text) replacing the label when pending.

#### 3. FieldListItem Refactor

**File**: `src/components/dashboard/FieldListItem.tsx`

**Intent**: Convert the outer `<a>` to a `<div>` with `role="none"`. Add an explicit "Open field" link covering the field name/size area, and a `WaterButton` on the right side next to the existing arrow. The card-level hover style moves to the div wrapper.

**Contract**: Outer element becomes `<div className="border-border bg-card ...">`. The name+size area becomes an `<a href={...} className="min-w-0 flex-1 ...">`. The right side renders `WateringBadge` + `WaterButton` + arrow span. `WaterButton` receives `fieldId={fieldId}` and `label={pl.watering.waterFieldButton}`.

#### 4. Dashboard.astro Wiring

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch watering events using the `windowDates` now returned by `getRainfall7dCalendarMm`. Compute per-field effective rainfall by adding `aggregateWateringEventsMm` result to `rainfall7dMm`. Add a `<WaterButton>` in the fields header row.

**Contract**:
- Destructure `windowDates` from the `getRainfall7dCalendarMm` result
- After the rainfall query, call `getWateringEventsInWindow(supabase, user.id, windowDates)` in the same `Promise.all` (or separately after)
- When computing per-field watering status, replace `evaluatePlantingWatering(planting, plants, rainfall7dMm)` with `evaluatePlantingWatering(planting, plants, rainfall7dMm + aggregateWateringEventsMm(wateringEvents ?? [], field.id))`
- In the fields header, add `<WaterButton client:visible fieldId={null} label={pl.watering.waterAllButton} />` next to the "+ Nowe pole" link

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Dashboard renders with "Podlej wszystkie" button in header and "Podlej" on each field row
- Clicking "Podlej wszystkie" shows spinner, then reloads page
- After reload, the watering badge for fields with plantings reflects the +2 mm contribution (badge may change from "Podlej dziś" to a better status if threshold is crossed)
- Clicking per-field "Podlej" works equivalently and only records a field-specific event
- No regression in existing field list navigation (clicking the field name still navigates)
- Error state shows Polish message when network/server fails

---

## Phase 5: Unit Tests

### Overview

Unit tests for the pure `aggregateWateringEventsMm` helper — the only logic in this feature that doesn't require a DB connection.

### Changes Required:

#### 1. Watering Events Tests

**File**: `src/test/lib/watering-events.test.ts` (new file)

**Intent**: Test `aggregateWateringEventsMm` in isolation: field-specific events contribute to their field, null-field ("water all") events contribute to every field, amounts are summed correctly, and empty rows return 0.

**Contract**: Follow the test structure in `src/test/lib/watering.test.ts` (vitest, `describe`/`it`/`expect`). Key cases:
- field-specific event only → correct sum for that field, 0 for other fields
- null-field event only → contributes to any fieldId passed
- mixed field-specific + null-field → sum includes both
- empty rows → returns 0
- multiple events on the same field → summed correctly

### Success Criteria:

#### Automated Verification:

- All new tests pass: `npx vitest run src/test/lib/watering-events.test.ts`
- Full test suite passes: `npx vitest run`
- Lint passes: `npm run lint`

#### Manual Verification:

- Test file reviewed for coverage of null-field edge case (the most critical logic in this feature)

---

## Testing Strategy

### Unit Tests:

- `aggregateWateringEventsMm` — 5 cases covering field-specific, null-field, mixed, empty, multi-event

### Integration Tests:

- None added — API endpoint auth/validation covered by manual verification against local Supabase

### Manual Testing Steps:

1. Apply migration: `npx supabase migration up` (or `db reset`)
2. Open dashboard, confirm "Podlej wszystkie" button appears
3. Press "Podlej" on a field that currently shows "Podlej dziś" (waterNow status) — confirm spinner, reload
4. After reload, check badge on that field changed or rainfall total in WeatherWidget increased
5. Open Supabase Studio → `watering_events` table, confirm row was inserted with correct `watered_at`, `amount_mm = 2.0`
6. Press "Podlej wszystkie" — confirm `field_id IS NULL` in inserted row
7. Verify that field navigation (clicking field name) still works after FieldListItem refactor

## Migration Notes

Local Supabase: `npx supabase migration up` or `npx supabase db reset` to apply the new migration before starting implementation.

## References

- Research: `context/changes/watering-feature/research.md`
- Existing recommendation infrastructure: `context/changes/watering-recomendation-logic/plan.md`
- `getRainfall7dCalendarMm`: `src/lib/services/weather.ts:148-200`
- `FieldListItem` (to refactor): `src/components/dashboard/FieldListItem.tsx:11-29`
- `dashboard.astro` (to wire): `src/pages/dashboard.astro:31-62`
- API pattern: `src/pages/api/fields/index.ts`
- Types pattern: `src/types.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB Migration & Shared Types

#### Automated

- [ ] 1.1 Migration applies cleanly (`npx supabase migration up` or `db reset`)
- [ ] 1.2 TypeScript build passes: `npm run build`
- [ ] 1.3 Lint passes: `npm run lint`

#### Manual

- [ ] 1.4 `watering_events` table visible in Supabase Studio with correct columns and RLS policies
- [ ] 1.5 Authenticated user can INSERT a row; other users cannot SELECT it

### Phase 2: Service Layer

#### Automated

- [ ] 2.1 TypeScript build passes: `npm run build`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Existing weather tests still pass: `npx vitest run src/test/lib/weather-rainfall-calendar.test.ts`

#### Manual

- [ ] 2.4 Service file reviewed for correct user_id filter in query

### Phase 3: API Endpoint

#### Automated

- [ ] 3.1 TypeScript build passes: `npm run build`
- [ ] 3.2 Lint passes: `npm run lint`

#### Manual

- [ ] 3.3 `POST /api/watering-events` with valid auth returns 201
- [ ] 3.4 Missing auth returns 401
- [ ] 3.5 Invalid `field_id` returns 400

### Phase 4: UI

#### Automated

- [ ] 4.1 TypeScript build passes: `npm run build`
- [ ] 4.2 Lint passes: `npm run lint`

#### Manual

- [ ] 4.3 Dashboard renders "Podlej wszystkie" in header and "Podlej" on each field row
- [ ] 4.4 Clicking "Podlej wszystkie" shows spinner then reloads
- [ ] 4.5 Badge reflects +2 mm contribution after reload
- [ ] 4.6 Per-field "Podlej" records field-specific event
- [ ] 4.7 Field name navigation still works after FieldListItem refactor
- [ ] 4.8 Error state shows Polish message on failure

### Phase 5: Unit Tests

#### Automated

- [ ] 5.1 New watering-events tests pass: `npx vitest run src/test/lib/watering-events.test.ts`
- [ ] 5.2 Full test suite passes: `npx vitest run`
- [ ] 5.3 Lint passes: `npm run lint`

#### Manual

- [ ] 5.4 Test file reviewed for null-field edge case coverage
