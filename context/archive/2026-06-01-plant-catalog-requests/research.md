---
date: 2026-06-09T00:00:00+02:00
researcher: Wojciech Kostanski
git_commit: 14a80df4f30bc1b3cf3c28c4c45cfbbc28b932a2
branch: claude/beautiful-lamport
repository: my-garden
topic: "Plant catalog requests: user submission + admin approval workflow (S-05)"
tags: [research, codebase, plant-catalog, plant-requests, admin, supabase, rls]
status: complete
last_updated: 2026-06-09
last_updated_by: Wojciech Kostanski
---

# Research: Plant catalog requests (S-05)

**Date**: 2026-06-09  
**Researcher**: Wojciech Kostanski  
**Git Commit**: 14a80df4f30bc1b3cf3c28c4c45cfbbc28b932a2  
**Branch**: claude/beautiful-lamport  
**Repository**: my-garden

## Research Question

What already exists in the codebase for the S-05 plant-catalog-requests slice (FR-014, FR-015), and what needs to be built? Map all the gaps across DB schema, service layer, API routes, and UI.

## Summary

The database layer (F-01) provided a near-complete foundation for S-05: both `plants` and `plant_requests` tables are migrated, RLS policies are in place, and the service layer has all five required functions. The main work remaining is **API routes** (4 endpoints), **React UI components** (2–3 components), and **Astro pages** (2 pages). One architectural decision is unresolved: the `plant_requests` table captures only `name` + `notes`, but the `plants` catalog requires `growth_days` (NOT NULL). Admin must supply plant attributes at approval time — the approval UI is a form, not a simple button.

## Detailed Findings

### 1. Database Schema — Fully in Place

Both tables are created and fully migrated.

**`plants` table** — `supabase/migrations/20260525000000_initial_schema.sql:30–59`
| Column | Type | Constraint |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `name` | text | NOT NULL |
| `growth_days` | int | NOT NULL |
| `watering_needs` | text | nullable |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

**`plant_requests` table** — `supabase/migrations/20260525000000_initial_schema.sql:64–95`
| Column | Type | Constraint |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid FK | REFERENCES auth.users ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `notes` | text | nullable |
| `status` | text | NOT NULL DEFAULT 'pending'; CHECK IN ('pending','approved','rejected') |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

Index on `plant_requests(user_id)`: `idx_plant_requests_user_id` — `supabase/migrations/20260526200000_merge_rls_admin_and_fk_indexes.sql:69`

### 2. RLS Policies — Fully in Place

**`plants` policies** — initial migration + patched in `20260526200000_merge_rls_admin_and_fk_indexes.sql:43–59`

- `plants_select_authenticated`: SELECT open to all `authenticated` users — `USING (true)`
- `plants_insert_admin`: INSERT only for `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`
- `plants_update_admin`: same check
- `plants_delete_admin`: same check

**`plant_requests` policies** — `supabase/migrations/20260525000000_initial_schema.sql:77–95`  
Updated in `20260526200000_merge_rls_admin_and_fk_indexes.sql:12–20`

- `plant_requests_select_owner`: SELECT only own rows (`user_id = auth.uid()`)
- `plant_requests_insert_owner`: INSERT own rows (`user_id = auth.uid()`)
- `plant_requests_update_owner` (patched): UPDATE own rows BUT status field is locked — the policy prevents users from changing status
- `plant_requests_delete_owner`: DELETE own rows

> **Key implication**: Admin must use a service-role client to approve/reject requests because:
>
> 1. There is no `plant_requests_select_admin` or `plant_requests_update_admin` policy
> 2. The `plant_requests_update_owner` policy prevents status changes even for the owner
> 3. RLS bypass = service-role client (`createServiceRoleClient()`)

### 3. TypeScript Types — Fully in Place

`src/types.ts`

- `PlantRow` (lines 26–33): full SELECT shape
- `PlantInsert` (lines 35–42): for INSERT, id/timestamps optional
- `PlantUpdate` (line 44): `Partial<PlantInsert>`
- `PlantRequestStatus` (line 47): `"pending" | "approved" | "rejected"`
- `PlantRequestRow` (lines 49–57): full SELECT shape
- `PlantRequestInsert` (lines 59–67): for INSERT, id/timestamps optional
- `PlantRequestUpdate` (line 69): `Partial<PlantRequestInsert>`

### 4. Service Layer — Nearly Complete

`src/lib/services/plants.ts`

| Function                                       | Line  | Purpose                           | Client           |
| ---------------------------------------------- | ----- | --------------------------------- | ---------------- |
| `getPlants(client)`                            | 4–6   | Fetch all plants ordered by name  | anon             |
| `getPlantById(client, id)`                     | 8–10  | Fetch single plant by ID          | anon             |
| `createPlantRequest(client, insert)`           | 12–14 | Insert a new plant request        | anon (user)      |
| `getPlantRequestsByUser(client, userId)`       | 16–23 | User's own requests, newest first | anon (user)      |
| `updatePlantRequestStatus(client, id, status)` | 25–28 | Admin approve/reject              | **service-role** |

**Missing service functions:**

- `createPlant(client, insert: PlantInsert)` — needed by admin approval flow to insert into the `plants` catalog. Currently absent.
- `getAllPlantRequests(client)` or `getPlantRequestsByStatus(client, status)` — for admin to list all/pending requests. Currently absent. Must use service-role client to bypass owner RLS.

### 5. Admin Role Detection Pattern

No admin middleware or helper exists. Admin role is checked via Supabase JWT claim:

- DB layer: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`
- App layer: `context.locals.user.app_metadata?.role === 'admin'`

`context.locals.user` is typed as `import("@supabase/supabase-js").User | null` (`src/env.d.ts:2–4`). The `User` type from `@supabase/supabase-js` includes `app_metadata: { [key: string]: any }`, so the check is:

```ts
const isAdmin = context.locals.user?.app_metadata?.role === "admin";
```

This check must be added:

- In admin API routes (return 403 if not admin)
- In admin Astro pages (redirect if not admin)

### 6. API Routes — Not Yet Created

Current protected routes in middleware: `["/dashboard", "/api/weather", "/api/user-preferences"]`  
`src/middleware.ts:4–6`

**Missing API endpoints to build:**

| Endpoint                         | Method | Who                | Client used  | Notes                                    |
| -------------------------------- | ------ | ------------------ | ------------ | ---------------------------------------- |
| `/api/plant-requests`            | POST   | authenticated user | anon         | Submit a new plant request               |
| `/api/plant-requests`            | GET    | authenticated user | anon         | List own plant requests                  |
| `/api/admin/plant-requests`      | GET    | admin only         | service-role | List all requests (any status)           |
| `/api/admin/plant-requests/[id]` | PATCH  | admin only         | service-role | Approve/reject + optionally create plant |

Add `/api/admin` to PROTECTED_ROUTES (or handle auth inside each admin route with a 403 check).

The Zod validation pattern to follow: `src/pages/api/fields/index.ts:8–13` — schema, `safeParse`, aggregate per-field errors into `Record<string, string[]>`.

### 7. Existing UI Patterns to Follow

**React islands approach** (`src/pages/dashboard/fields/new.astro:1–22`):

1. Astro server fetches data (regions list)
2. Data passed as props to React component: `<CreateFieldForm client:load regions={regions} />`
3. React component handles form state, calls fetch, navigates on success

**Client-side data fetching** (`src/components/fields/CreateFieldForm.tsx:40–49`):

```ts
const res = await fetch("/api/plant-requests", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, notes }),
});
const data = await res.json();
if (!res.ok) {
  if (data.errors)
    setErrors(data.errors); // Zod field errors
  else setErrors({ general: data.error }); // general
  return;
}
// on success: show list update or navigate
```

**Error + loading state pattern** (`src/components/fields/CreateFieldForm.tsx`):

- `errors: Record<string, string[]>` for field-level Zod errors
- `errors.general: string` for API-level errors
- `const [loading, setLoading] = useState(false)` for button disabled state
- Inline `{errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}` per field

**shadcn components available**: Button, Input, Label, Popover, Command, Dialog  
`src/components/ui/` — all already installed

**No toast component installed yet** — if needed for approval feedback, it must be added: `npx shadcn@latest add toast`.

**Badge component not installed** — useful for showing request status (pending/approved/rejected). Add: `npx shadcn@latest add badge`.

### 8. Pages — Not Yet Created

**Needed Astro pages:**

| Path                        | Who                | Data fetched server-side |
| --------------------------- | ------------------ | ------------------------ |
| `/dashboard/plant-requests` | authenticated user | user's plant requests    |
| `/admin/plant-requests`     | admin              | all pending requests     |

`/dashboard/*` is already covered by PROTECTED_ROUTES. `/admin/*` needs to be added.

The `/admin/plant-requests` page must check admin role server-side and redirect non-admins.

## Code References

- `supabase/migrations/20260525000000_initial_schema.sql:30–95` — plants + plant_requests schema + RLS
- `supabase/migrations/20260526200000_merge_rls_admin_and_fk_indexes.sql:12–59` — patched RLS policies + index
- `src/types.ts:26–69` — all plant/request TypeScript types
- `src/lib/services/plants.ts:4–28` — all five service functions
- `src/lib/supabase.ts:39–56` — service-role client factory (`createServiceRoleClient`)
- `src/middleware.ts:4–6` — PROTECTED_ROUTES array
- `src/env.d.ts:2–4` — `App.Locals.user: User | null`
- `src/pages/api/fields/index.ts:8–70` — reference API route pattern (Zod + service + 201/4xx/5xx)
- `src/pages/dashboard/fields/new.astro:1–22` — reference Astro page with React island
- `src/components/fields/CreateFieldForm.tsx:1–167` — reference React island with fetch + errors + loading

## Architecture Insights

### Critical Gap: Missing Plant Attributes in Requests

The `plant_requests` table only stores `name` + `notes`. The `plants` catalog requires `growth_days` (NOT NULL). When admin approves a request and creates the plant, they must supply:

- `growth_days: int` — days from seeding to harvest (required)
- `watering_needs: text` — "low" / "medium" / "high" (optional)

**Decision required**: Does the approval UI collect these inline (a modal form), or does admin pre-populate them in the request and the approval is a one-click confirm?

The roadmap calls this out as an open question (`context/foundation/roadmap.md:125`):

> What data fields does an admin need to fill in when approving a plant?

**Recommendation**: Approval flow = PATCH `/api/admin/plant-requests/[id]` accepts `{ status: "approved", growth_days: number, watering_needs?: string }`. When approving, the API atomically: (1) updates `plant_requests.status` to `approved`, and (2) inserts a new row into `plants`. Rejection = PATCH with `{ status: "rejected" }` only.

### Admin Client Pattern

All admin DB operations (read all requests, update status, insert plant) must use `createServiceRoleClient()` because:

1. `plant_requests` has no admin SELECT policy — owner RLS would filter out other users' requests
2. `plant_requests_update_owner` blocks status changes even for the row's owner
3. `plants` INSERT/UPDATE/DELETE require `app_metadata.role = 'admin'` via JWT — but the service-role client bypasses RLS entirely, which is simpler and consistent with the cron pattern

### Two-Client Dispatch Pattern

API routes that serve admins must:

1. Check `context.locals.user.app_metadata?.role === 'admin'` → return 403 if not
2. Call `createServiceRoleClient()` for all DB operations
3. NOT use the anon client (which would be restricted by RLS)

## Historical Context

- `context/archive/2026-05-25-db-schema-and-migrations/plan.md:205–218` — service layer design decision: `updatePlantRequestStatus` documented as admin-only, must be called with service-role client. A `createPlant` function was not planned in F-01 but is needed.
- `context/archive/2026-05-25-db-schema-and-migrations/plan.md:32` — F-01 explicitly deferred "small initial seed of common plants" to S-05.
- `context/foundation/roadmap.md:117–127` — S-05 entry: prerequisite F-01 (done), parallel with S-01/S-02.

## Related Research

- `context/archive/2026-05-25-db-schema-and-migrations/plan.md` — F-01 plan with full schema design
- `context/changes/imgw-weather-probe/plan.md` — most recently reviewed plan, reference for API route + React island patterns

## Open Questions

1. **Approval UX**: Modal with growth_days/watering_needs form, or separate edit step? The atomic approve-and-create pattern requires both pieces in one PATCH call.
2. **Reject vs Delete**: When rejected, does the request stay in the DB (visible to user with "rejected" status), or is it deleted? Current schema supports keeping it (status = 'rejected'). Recommended: keep it for user transparency.
3. **Plant seed data**: F-01 plan deferred an initial plant catalog seed to S-05. How many initial plants should be seeded in a follow-up migration, and who seeds them (migration vs admin UI)?
4. **Admin access**: How is the admin role assigned to a user? Via Supabase dashboard (`app_metadata` update) only — no self-service admin promotion in MVP.
5. **Admin page routing**: `/admin/*` or `/dashboard/admin/*`? The `/dashboard` prefix is already protected; `/admin` would be cleaner but requires adding to PROTECTED_ROUTES.
