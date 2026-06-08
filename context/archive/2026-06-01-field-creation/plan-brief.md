# Field Creation — Plan Brief

> Full plan: `context/changes/field-creation/plan.md`
> PRD: `context/foundation/prd.md`

## What & Why

Users need a way to define their garden fields so they can assign plants to them later. This feature provides a form to capture a field's name, physical dimensions (columns and rows), and geographic region (required for weather data integration).

## Starting Point

The database schema (`fields` table) and CRUD service wrappers are already in place (from F-01). The dashboard currently lacks specific feature pages beyond the auth shell.

## Desired End State

A user can navigate to `/dashboard/fields/new`, fill out a form with a searchable region dropdown and numeric grid dimensions, and save the field. Upon success, they are redirected to a placeholder field view, and the field is persisted in the database.

## Key Decisions Made

| Decision                 | Choice                 | Why (1 sentence)                                                                                        | Source |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| Grid UI Interaction      | Numeric inputs         | Simple to build and reliable on mobile screens; drag-to-draw is too complex for MVP.                    | Plan   |
| Region Selection         | Searchable combobox    | Better UX for locating specific regions; implemented as a React client component using shadcn.          | Plan   |
| Grid Size Limits         | Max 20x20              | Prevents performance issues and accidental DB bloat while accommodating small farms.                    | Plan   |
| Form Submission UX       | React client-side      | Provides smooth, instantaneous feedback and works naturally with the React combobox.                    | Plan   |
| Post-Creation Routing    | Redirect to Field      | Takes the user directly to the new field (via a placeholder page) to immediately begin planting (S-03). | Plan   |
| Field Naming Constraints | Required, max 50 chars | Fast, synchronous validation without needing a DB uniqueness check.                                     | Plan   |

## Scope

**In scope:**

- Region combobox selection (React + shadcn UI)
- Numeric column/row inputs (max 20x20)
- API route with Zod validation
- Redirection to a placeholder Field Details page

**Out of scope:**

- Visual grid drag-and-drop builder
- Rendering the actual grid UI (reserved for S-04)

## Architecture / Approach

A standard Astro page (`/dashboard/fields/new`) fetches the available regions server-side and passes them to a React island (`<CreateFieldForm client:load>`). The form manages local state and submits a JSON payload to a new Astro API endpoint (`/api/fields`). The endpoint validates with Zod, inserts the record via the existing Supabase service wrappers, and returns the new ID to the client for redirection.

## Phases at a Glance

| Phase                           | What it delivers                      | Key risk                                           |
| ------------------------------- | ------------------------------------- | -------------------------------------------------- |
| 1. Dependencies & UI Components | Zod + shadcn primitives               | Missing shadcn dependencies (`popover`, `command`) |
| 2. API Route                    | `/api/fields` endpoint                | RLS misconfiguration or missing user context       |
| 3. Create Field Form Component  | React client form                     | Combobox complexity                                |
| 4. Pages & Routing              | `/dashboard/fields/new` + placeholder | -                                                  |

**Prerequisites:** Database schema (`fields`, `regions`) and service wrappers (F-01).
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Assumes shadcn CLI works smoothly with the current Astro + React 19 setup for complex components like `command`.

## Success Criteria (Summary)

- User can see a polished form at `/dashboard/fields/new`.
- Form prevents invalid dimensions (>20) or missing regions.
- Successfully submitting the form creates a DB row and redirects to the field placeholder page.
