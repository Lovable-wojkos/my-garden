---
change_id: planting-record
title: Planting record
status: planned
created: 2026-06-08
updated: 2026-06-08
---

# Plan: Planting Record (S-03)

## Goal

Transform the placeholder field detail page into a fully functional planting record:
interactive grid, cell click → planting dialog, CRUD API routes, harvest date display.

## Prerequisites (all done — F-01 complete)

- `plantings` table with RLS, `PlantingRow`/`PlantingInsert`/`PlantingUpdate` types, and all service functions exist.
- `plants`, `fields` tables and service functions exist.
- `dialog`, `command`, `popover`, `input`, `label`, `button` shadcn components installed.

---

## Tasks

### 1. Middleware — protect planting API routes

**File**: `src/middleware.ts`

Add `/api/plantings` to `PROTECTED_ROUTES`.

---

### 2. API route — POST `/api/plantings`

**File**: `src/pages/api/plantings/index.ts`

- Export `export const prerender = false`
- Auth guard via `context.locals.user`
- Zod validation:
  ```ts
  {
    field_id: z.string().uuid(),
    plant_id: z.string().uuid().nullable().optional(),
    plant_name: z.string().min(1).max(100).nullable().optional(),
    cell_row: z.number().int().min(0),
    cell_col: z.number().int().min(0),
    seeding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(500).nullable().optional(),
  }
  ```
  `.refine()` that at least one of `plant_id` / `plant_name` is present.
- Call `createPlanting()`; map Supabase `23505` → `400 "This cell is already occupied."`.

---

### 3. API route — PATCH + DELETE `/api/plantings/[id]`

**File**: `src/pages/api/plantings/[id].ts`

- Export `export const prerender = false`
- Auth guard; ownership check: `planting.user_id === context.locals.user.id` (defence-in-depth on top of RLS).
- **PATCH** — Zod (all optional): `plant_id`, `plant_name`, `seeding_date`, `notes`; call `updatePlanting()`.
- **DELETE** — call `deletePlanting()`; return `204`.

---

### 4. React component — `FieldGrid.tsx`

**File**: `src/components/fields/FieldGrid.tsx`

Props:
```ts
interface FieldGridProps {
  field: FieldRow;
  plantings: PlantingRow[];
  plants: PlantRow[];
}
```

Behaviour:
- Render a `field.rows × field.cols` CSS grid.
- Each cell: plant name (or "Empty") + seeding date if planted.
- Empty cell click → open `PlantingDialog` (create mode).
- Planted cell click → open `PlantingDialog` (edit mode, prefilled).
- After mutation: re-fetch `/api/plantings?field_id=…` (or full page reload) to refresh state.
- Handle empty catalog gracefully (combobox placeholder: "No plants yet — enter a name manually").
- Mobile: compact cells, `overflow-hidden`, horizontal scroll if grid > viewport.

Harvest date helper (computed client-side):
```ts
function getHarvestDate(planting: PlantingRow, plants: PlantRow[]): string {
  if (!planting.plant_id) return "–";
  const plant = plants.find(p => p.id === planting.plant_id);
  if (!plant) return "–";
  const seeding = new Date(planting.seeding_date);
  seeding.setDate(seeding.getDate() + plant.growth_days);
  return seeding.toLocaleDateString("pl-PL");
}
```

---

### 5. React component — `PlantingDialog.tsx`

**File**: `src/components/fields/PlantingDialog.tsx`

Uses existing `dialog`, `command`/`popover` (combobox), `input`, `label`, `button`.

Fields:
- **Catalog combobox** — sets `plant_id` + auto-fills `plant_name`.
- **Free-text input** — sets `plant_name` only, clears `plant_id`. (Mutually exclusive UX.)
- **Seeding date** `<input type="date">` — defaults to today; always pass as `YYYY-MM-DD` string.
- **Notes** `<textarea>` max 500 chars (optional).
- **Estimated harvest date** — read-only, computed from selected catalog plant + seeding date; shows "–" for free-text entries.
- **Submit** → POST (create) or PATCH (edit).
- **Delete button** (edit mode) → DELETE with confirmation.

---

### 6. Field detail page

**File**: `src/pages/dashboard/fields/[id].astro`

Replace placeholder with:
1. Server-side: fetch `field` (by `id`), `plantings` (by `field.id`), `plants` (full catalog).
2. Render `<FieldGrid client:load field={field} plantings={plantings} plants={plants} />`.
3. Keep "Back to Dashboard" link.

> Weather panel (S-04) is **out of scope** for this change.

---

## File Map

| File | Status | Action |
|---|---|---|
| `src/middleware.ts` | Exists | Add `/api/plantings` to `PROTECTED_ROUTES` |
| `src/pages/api/plantings/index.ts` | Does not exist | Create (POST) |
| `src/pages/api/plantings/[id].ts` | Does not exist | Create (PATCH + DELETE) |
| `src/components/fields/FieldGrid.tsx` | Does not exist | Create |
| `src/components/fields/PlantingDialog.tsx` | Does not exist | Create |
| `src/pages/dashboard/fields/[id].astro` | Exists (placeholder) | Expand |

No changes needed: `src/types.ts`, `src/lib/services/plantings.ts`, `src/lib/services/plants.ts`.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Empty plant catalog until S-05 | Medium | Combobox shows "No plants yet" message; free-text path is primary until S-05 |
| Large grid (20×20) on mobile | Medium | Compact cells, `overflow-hidden`, horizontal scroll |
| Duplicate cell (`23505`) | Low | Map to `400 "This cell is already occupied."` |
| Ownership bypass if RLS misconfigured | Medium | Defence-in-depth check in route handler |
| Timezone shift on `seeding_date` | Low | Always use `YYYY-MM-DD` string, never a `Date` object in Supabase calls |
