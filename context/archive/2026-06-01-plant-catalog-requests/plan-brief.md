# Plant Catalog Requests — Plan Brief

> Full plan: `context/changes/plant-catalog-requests/plan.md`
> Research: `context/changes/plant-catalog-requests/research.md`

## What & Why

Build the admin approval side of the plant catalog request flow (S-05, FR-014, FR-015). Users will submit plant entries inline during planting (S-03); this change establishes the DB model, admin API, and admin UI so that an admin can promote pending user-created plants into the global catalog or remove them.

## Starting Point

F-01 created a two-table design (`plant_requests` + `plants`) that no longer matches the intended product design. The `plants` table needs two new columns (`user_id`, `status`) and a relaxed `growth_days NOT NULL` constraint. The `plant_requests` table is dropped entirely. No UI currently exists for either user submission or admin approval. No plants are in the catalog yet.

## Desired End State

An admin can visit `/admin/plant-requests`, see all pending plants that users have created, open an approval modal to supply `growth_days` and optional `watering_needs`, and publish the plant to the global catalog — or reject it (deleting the row). The global catalog is pre-seeded with 10 common vegetables at migration time.

## Key Decisions Made

| Decision                  | Choice                                          | Why (1 sentence)                                         | Source       |
| ------------------------- | ----------------------------------------------- | -------------------------------------------------------- | ------------ |
| DB design                 | Single `plants` table with `user_id` + `status` | User confirmed single-table over two-table design        | Plan Q&A     |
| User submission point     | Inline during planting — S-03                   | No dedicated request form in S-05                        | Plan Q&A     |
| Rejection behavior        | DELETE the row (no history)                     | "reject - remove" — user's explicit instruction          | Plan Q&A     |
| Approval UX               | Inline modal (shadcn Dialog)                    | Single-page flow; Dialog already installed               | Plan Q&A     |
| Admin routing             | `/admin/plant-requests`                         | Clean separation from the user `/dashboard`              | Plan Q&A     |
| `growth_days` nullability | Make nullable                                   | Pending plants don't have it; admin fills it at approval | Architecture |
| Admin DB client           | `createServiceRoleClient()`                     | Must bypass RLS to read/update any user's pending plants | Research     |

## Scope

**In scope:**

- DB migration: add `user_id`, `status`, relax `growth_days`, rewrite RLS, drop `plant_requests`, seed 10 global plants
- TypeScript types: update `PlantRow`/`PlantInsert`/`PlantUpdate`; remove all `PlantRequest*` types
- Service layer: remove obsolete functions; fix `getPlants()` filter; add `createUserPlant`, `getPendingPlants`, `approvePlant`, `rejectPlant`
- Middleware: add `/admin` and `/api/admin` to `PROTECTED_ROUTES`
- Admin API: `GET /api/admin/plant-requests`, `PATCH /api/admin/plant-requests/[id]`, `DELETE /api/admin/plant-requests/[id]`
- Admin UI: `src/components/plants/AdminPlantRequestList.tsx` + `src/pages/admin/plant-requests.astro`

**Out of scope:**

- User-facing submission form (S-03)
- User-facing request list / status tracking (S-03)
- Rejection notifications to users
- Admin user management
- `plant_requests` data migration (table is empty in dev)

## Architecture / Approach

One `plants` table, two plant states. Global plants (`status = 'global'`) are visible to all authenticated users. Pending plants (`status = 'pending'`) are visible only to their creator (`user_id = auth.uid()`). All admin DB operations use `createServiceRoleClient()` to bypass RLS. The admin Astro page (`/admin/plant-requests`) checks `app_metadata.role === 'admin'` server-side, SSR-fetches pending plants, and passes them to a `client:load` React island that handles approve (shadcn Dialog modal form → PATCH) and reject (window.confirm → DELETE) inline.

## Phases at a Glance

| Phase                   | What it delivers                                                     | Key risk                                                                                 |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. DB Migration + Types | Schema ready; 10 global plants seeded; `PlantRequest*` types removed | Must drop `plant_requests` policies/index before the table itself                        |
| 2. Service Layer        | Admin CRUD functions; `createUserPlant` ready for S-03               | `getPlants()` behavior changes (now filters global only) — verify no other callers break |
| 3. Admin API            | Three admin endpoints; middleware protection                         | Admin 403 check must be explicit in each route (middleware only guards auth, not role)   |
| 4. Admin UI             | `/admin/plant-requests` fully functional                             | No pending plants until S-03 ships; manual Studio seeding required for UI testing        |

**Prerequisites:** Supabase local running (`npx supabase start`); admin test user with `app_metadata.role = "admin"` set via Supabase dashboard  
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- Until S-03 ships, the admin page can only be tested by manually inserting pending plants via Supabase Studio. The approve/reject flows are fully functional but lack a real submission path.
- `watering_needs` is stored as free-text (the admin types a value). Downstream watering logic (S-04) will need to treat any casing or unexpected string gracefully.
- Seed INSERTs are not idempotent — `npx supabase db reset` is fine, but manually re-running the migration would duplicate seed rows.

## Success Criteria (Summary)

- Admin can visit `/admin/plant-requests`, see pending plants, approve (modal with `growth_days`), or reject — all on one page
- Approved plants appear immediately in `getPlants()` results (the global catalog)
- Non-admins are redirected before any admin data is fetched or rendered
