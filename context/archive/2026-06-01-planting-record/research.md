---
date: 2026-06-08T15:50:00Z
researcher: copilot
git_commit: deb8e4d
branch: agents/10x-research-planting-record
repository: my-garden
topic: "planting-record"
tags: [research, codebase, planting, harvest, grid, react, supabase]
status: complete
last_updated: 2026-06-08
last_updated_by: copilot
---

# Research: planting-record (S-03)

**Date**: 2026-06-08T15:50:00Z
**Researcher**: copilot
**Git Commit**: deb8e4d
**Branch**: agents/10x-research-planting-record
**Repository**: my-garden

## Research Question

What is already in place for S-03 (Planting record), what needs to be built, and how should the one open unknown — hybrid plant entry and harvest date calculation — be resolved so the feature can be planned and implemented?

## Summary

All database foundations for S-03 are complete (F-01). The `plantings` table, RLS policies, TypeScript types, and CRUD service wrappers exist. The field detail page (`/dashboard/fields/[id].astro`) is a placeholder. What remains is: (1) transforming the placeholder into a functional interactive grid, (2) a cell click → planting dialog flow, (3) API routes for planting CRUD, and (4) harvest date display. The open unknown (hybrid entry growth inference) is resolved below.

---

## Detailed Findings

### 1. What Already Exists

#### Database (`supabase/migrations/20260525000000_initial_schema.sql`)

- **`plantings` table** — fully specified:
  - `id`, `field_id` (FK → fields), `user_id` (FK → auth.users), `plant_id` (FK → plants, nullable), `plant_name` (text, nullable), `cell_row`, `cell_col`, `seeding_date` (date), `notes` (text, nullable), `created_at`, `updated_at`
  - `UNIQUE (field_id, cell_row, cell_col)` — enforces one planting per cell at the DB level.
  - RLS: owner-only SELECT / INSERT / UPDATE / DELETE (`user_id = auth.uid()`).
- **`plants` table** — `growth_days` (int NOT NULL) is the only column needed for harvest date calculation. Currently no rows are seeded (S-05 will seed the catalog via admin approval).
- **`fields` table** — has `cols` and `rows` integers that define the grid dimensions.

#### TypeScript types (`src/types.ts`)

```ts
// All three variants exist and are correct:
PlantingRow     // SELECT shape (plant_id nullable, plant_name nullable)
PlantingInsert  // INSERT shape
PlantingUpdate  // Partial<PlantingInsert>

PlantRow        // includes growth_days: number (NOT NULL)
```

#### Service layer (`src/lib/services/`)

- `plantings.ts`: `getPlantingsByField`, `createPlanting`, `updatePlanting`, `deletePlanting` — all implemented and type-safe. `updatePlanting` correctly strips `user_id` and `field_id` to prevent ownership changes.
- `plants.ts`: `getPlants` (ordered by name), `getPlantById`.
- `fields.ts`: `getFieldById`.

#### UI components (`src/components/ui/`)

Available: `button`, `input`, `label`, `popover`, `command`, `dialog`. All are already installed and working. No new shadcn primitives are needed for S-03.

#### Field detail page (`src/pages/dashboard/fields/[id].astro`)

Currently a placeholder — fetches the field and renders a "coming soon" message. This is the primary page to expand for S-03.

#### API routes

- `/api/fields` (POST) — field creation; pattern to follow for planting routes.
- No planting API routes exist yet.

#### Middleware (`src/middleware.ts`)

`PROTECTED_ROUTES` includes `/dashboard` (covers `/dashboard/fields/*`). No new entries are needed for planting API routes — they need to be added explicitly as `/api/plantings`.

---

### 2. Open Unknown: Hybrid Plant Entry + Harvest Date (FR-003, FR-011)

**Question**: When a user types a free-text plant name not found in the catalog, how is `growth_days` inferred for the harvest date estimate?

**Resolution**: It is not inferred. The harvest date estimate requires a known `growth_days` value, which only exists for catalog plants (`plants.growth_days NOT NULL`). Free-text entries store `plant_name` with `plant_id = null` — the harvest date is displayed as "Unknown" in that case.

This is the correct MVP behaviour:
- Catalog plant selected → harvest date = `seeding_date + plant.growth_days` days (displayed)
- Free-text name entered → `plant_id = null`, no `growth_days` available → harvest date shown as "–" or "Unknown"
- The user can always submit a plant request (S-05) to add their plant to the catalog, at which point future plantings will show estimated dates

This matches PRD FR-011 ("estimate automatically calculated from seeding date and plant category") — estimation is only possible when a plant category/entry with `growth_days` exists.

---

### 3. What Needs to Be Built

#### A. API Routes — `/api/plantings`

Three endpoints, following the `/api/fields` pattern exactly:

| Method     | Path                     | Action                                         |
| ---------- | ------------------------ | ---------------------------------------------- |
| `POST`     | `/api/plantings`         | Create planting; body: `PlantingInsert` shape  |
| `PATCH`    | `/api/plantings/[id]`    | Update planting (plant, seeding date, notes)   |
| `DELETE`   | `/api/plantings/[id]`    | Delete planting (clear cell)                   |

All three:
- Must export `export const prerender = false;`
- Must check `context.locals.user` (auth guard via middleware)
- Must validate with Zod
- Must add `/api/plantings` to `PROTECTED_ROUTES` in `src/middleware.ts`

**POST Zod schema:**
```ts
{
  field_id: z.string().uuid(),
  plant_id: z.string().uuid().nullable().optional(),
  plant_name: z.string().min(1).max(100).nullable().optional(),
  cell_row: z.number().int().min(0),
  cell_col: z.number().int().min(0),
  seeding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // ISO date
  notes: z.string().max(500).nullable().optional(),
}
```

Constraint: at least one of `plant_id` or `plant_name` must be present (Zod `.refine()`).

**PATCH Zod schema** (all optional):
```ts
{
  plant_id: z.string().uuid().nullable().optional(),
  plant_name: z.string().min(1).max(100).nullable().optional(),
  seeding_date: z.string().regex(...).optional(),
  notes: z.string().max(500).nullable().optional(),
}
```

**Ownership check for PATCH/DELETE**: After fetching the planting by ID, verify `planting.user_id === context.locals.user.id` before proceeding (defence in depth on top of RLS).

**DB conflict on duplicate cell**: Supabase will return error code `23505` (unique_violation) — map to `400` with message "This cell is already planted."

#### B. Field Grid React Component — `FieldGrid.tsx`

New file: `src/components/fields/FieldGrid.tsx`

Props:
```ts
interface FieldGridProps {
  field: FieldRow;
  plantings: PlantingRow[];
  plants: PlantRow[];  // catalog, for the combobox and harvest date display
}
```

Behaviour:
- Renders a `field.rows × field.cols` CSS grid of cells.
- Each cell shows: plant name (or "Empty") + seeding date if planted.
- Clicking an empty cell → opens `PlantingDialog` in "create" mode.
- Clicking a planted cell → opens `PlantingDialog` in "edit" mode with prefilled values.
- After successful create/update/delete, re-fetch or optimistically update the local state.

**Harvest date display** (computed client-side):
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

#### C. Planting Dialog Component — `PlantingDialog.tsx`

New file: `src/components/fields/PlantingDialog.tsx`

Uses the existing `dialog` shadcn component. Contains:
- **Plant selection**: `command`/`popover` combobox over `plants[]` (catalog). The user can also type a free-text name if not found in the list — two fields:
  - "Select from catalog" combobox (sets `plant_id` + auto-fills `plant_name`)
  - "Or enter plant name" text input (sets `plant_name` only, clears `plant_id`)
  - Exactly one of the two must be populated for the form to be valid.
- **Seeding date**: `<input type="date">` (defaults to today).
- **Notes**: optional `<textarea>` (max 500 chars).
- **Estimated harvest date**: read-only, computed from selected catalog plant + seeding date. Shows "–" if no catalog plant selected.
- **Submit** → POST /api/plantings (create mode) or PATCH /api/plantings/[id] (edit mode).
- **Delete button** (edit mode only) → DELETE /api/plantings/[id] with confirmation.

#### D. Field Detail Page — `src/pages/dashboard/fields/[id].astro`

Replace the placeholder with the real content:
1. Server-side: fetch `field`, `plantings` (by field id), and `plants` (full catalog).
2. Render `<FieldGrid client:load field={field} plantings={plantings} plants={plants} />`.
3. Keep the "Back to Dashboard" link.

The page should not yet include the weather panel (that belongs to S-04).

---

### 4. Architecture Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Grid interaction | React island with `client:load` | Cells are interactive; static Astro is not viable |
| Data loading | Server-side on page load (props) | All three datasets (field, plantings, plants) are available at SSR time; no waterfall |
| Mutations | Via `/api/plantings` routes | Consistent with the `/api/fields` pattern; RLS enforced server-side |
| Optimistic update vs. re-fetch | Re-fetch after mutation | Simpler for MVP; grid is small (max 400 cells) so full re-fetch is fast |
| Harvest date calculation | Client-side in React | Pure date arithmetic; no server round-trip needed |
| Free-text entry UX | Two separate inputs (combobox + text) | Avoids ambiguity; makes clear which path sets `plant_id` |
| New shadcn components | None required | `dialog`, `command`, `popover`, `input`, `label`, `button` already present |

---

### 5. File Map

| File | Status | Action |
| --- | --- | --- |
| `src/pages/dashboard/fields/[id].astro` | Exists (placeholder) | Expand: add server-side fetching of plantings + plants; mount FieldGrid island |
| `src/components/fields/FieldGrid.tsx` | Does not exist | Create |
| `src/components/fields/PlantingDialog.tsx` | Does not exist | Create |
| `src/pages/api/plantings/index.ts` | Does not exist | Create (POST) |
| `src/pages/api/plantings/[id].ts` | Does not exist | Create (PATCH + DELETE) |
| `src/middleware.ts` | Exists | Add `/api/plantings` to `PROTECTED_ROUTES` |
| `src/types.ts` | Exists | No changes needed — all types present |
| `src/lib/services/plantings.ts` | Exists | No changes needed — all service functions present |
| `src/lib/services/plants.ts` | Exists | No changes needed — `getPlants` already present |

---

### 6. Gaps and Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Plant catalog is empty until S-05 ships | Medium | S-03 must handle 0-length catalog gracefully (combobox shows "No plants in catalog yet — enter a name manually"); free-text path is the primary entry method until S-05 lands |
| Cell grid at max size (20×20 = 400 cells) on mobile | Medium | Use compact cells with overflow-hidden text; CSS grid scrolls horizontally if needed; set a `min-w` on cells |
| Unique constraint violation (cell already planted) | Low | Map Supabase `23505` to user-facing error "This cell is already occupied" |
| Ownership check on PATCH/DELETE bypassed if RLS misconfigured | Medium | Defence-in-depth: check `planting.user_id === user.id` in the route handler before calling the service |
| `seeding_date` stored as `date` in Postgres; JS `Date` timezone shifts | Low | Always format/parse as `YYYY-MM-DD` string (never pass a `Date` object to Supabase); compare as strings |

---

### 7. Open Questions for /10x-plan

All resolved in this research. No blockers.

1. ~~Hybrid plant entry growth inference~~ → resolved above: free-text = no harvest date estimate.
2. ~~Grid interaction model~~ → resolved: React island, click-to-open dialog.
3. ~~Cell update strategy~~ → resolved: full re-fetch after each mutation.
4. **S-05 dependency**: S-03 must be fully functional with an empty plant catalog. The free-text entry path is the fallback. This is explicitly in-scope and handled.
