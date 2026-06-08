# Field Creation Implementation Plan

## Overview

We are building the "Field Creation" feature (S-02), allowing users to define a new garden field. This involves creating a UI to capture the field name, region (for weather data), and physical layout dimensions (columns and rows). 

## Current State Analysis

- The database schema is fully prepared via F-01 (`fields` and `regions` tables exist with RLS).
- Typed service wrappers for DB access (`createField`, `getRegions`) exist in `src/lib/services/`.
- The dashboard layout structure relies on a single global layout, with pages acting as layout wrappers.
- There are no form validation libraries installed yet, though `AGENTS.md` mandates Zod for API boundaries.

## Desired End State

Users can navigate to `/dashboard/fields/new` and see a React-based form. They can input a field name (max 50 chars), specify width and height using numeric inputs (max 20x20), and select a region using a searchable combobox. Upon submission, the data is sent to a new API route, validated with Zod, inserted into the database, and the user is redirected to the field's detail page (which will serve as a placeholder until S-04 is built).

### Key Discoveries:

- React components are used as interactive islands (`client:load`). Astro does *not* use Next.js `"use client"` directives.
- No shadcn/ui components for inputs, comboboxes, or labels exist yet; they must be generated.
- The `regions` table is pre-seeded, and `getRegions` fetches all available regions.

## What We're NOT Doing

- No drag-to-draw interactive grid UI (we are using standard numeric inputs to keep it simple and mobile-friendly).
- No complex visualization of the field layout (this belongs to S-04).
- No client-side database writes (all writes go through an API route for secure validation and RLS user enforcement).

## Implementation Approach

We will build a React form component that receives the list of regions as a prop. The form handles local state and uses a shadcn combobox for region selection. On submit, it performs a `fetch` POST to a new Astro API endpoint (`/api/fields`). The API route validates the payload with Zod, creates the field via the service layer, and returns the new field's ID. The client then redirects to `/dashboard/fields/[id]`.

## Critical Implementation Details

- **Astro Directives**: Do not use `"use client"`. The form component will be hydrated on the Astro page using `<CreateFieldForm client:load regions={regions} />`.
- **Combobox Component**: Shadcn doesn't have a single "Combobox" installation command. It's built by composing `popover` and `command`. You will need to install these and create the combobox pattern manually.

## Phase 1: Dependencies & UI Components

### Overview

Install required form validation libraries and shadcn UI primitives.

### Changes Required:

#### 1. NPM Dependencies
**Intent**: Install `zod` for API validation. 
**Contract**: `package.json` will include `zod`.

#### 2. Shadcn UI Primitives
**Intent**: Add necessary UI components using the shadcn CLI.
**Contract**: Run `npx shadcn@latest add input label popover command` to generate components in `src/components/ui/`. 

### Success Criteria:

#### Automated Verification:
- `zod` is in `package.json`.
- `src/components/ui/input.tsx`, `label.tsx`, `popover.tsx`, and `command.tsx` exist and pass type checks.

#### Manual Verification:
- (None for this phase)

---

## Phase 2: API Route

### Overview

Create the API endpoint that validates and processes the field creation request.

### Changes Required:

#### 1. Field Creation API
**File**: `src/pages/api/fields/index.ts`
**Intent**: Accept a POST request with the new field data, validate it using Zod, and insert it into the database via `createField`. It must read the authenticated user from `context.locals.user` to pass to the Supabase client (which automatically enforces RLS).
**Contract**: 
- Export a `POST` function. 
- Must export `export const prerender = false;`
- Expects JSON body: `{ name: string, cols: number, rows: number, region_id: string }`.
- Zod schema: `name` (required, max 50), `cols` (min 1, max 20), `rows` (min 1, max 20), `region_id` (uuid).
- Returns `201 Created` with `{ id: string }` on success, or `400 Bad Request` with errors.

### Success Criteria:

#### Automated Verification:
- Type checking passes: `npm run tsc` or `npm run lint`.

#### Manual Verification:
- Sending a valid POST request via curl/Postman to `/api/fields` (with a valid session cookie) creates a row in the `fields` table.

---

## Phase 3: Create Field Form Component

### Overview

Build the interactive React form.

### Changes Required:

#### 1. Form Component
**File**: `src/components/fields/CreateFieldForm.tsx`
**Intent**: A React component maintaining form state (name, cols, rows, region_id) and handling the `fetch` submission. It uses shadcn UI inputs and constructs a searchable combobox for the region select.
**Contract**:
- Props: `{ regions: RegionRow[] }`
- State: form values, loading status, and error messages.
- Upon successful fetch, redirects via `window.location.href = "/dashboard/fields/" + data.id`.

### Success Criteria:

#### Automated Verification:
- Linter passes on the new component.

#### Manual Verification:
- Form renders correctly in Storybook or when temporarily mounted.
- Combobox filters the region list when typing.

---

## Phase 4: Pages & Routing

### Overview

Create the Astro pages that host the form and act as the redirect destination.

### Changes Required:

#### 1. New Field Page
**File**: `src/pages/dashboard/fields/new.astro`
**Intent**: The page where users go to create a field. It fetches regions server-side and passes them to the React form. 
**Contract**: 
- Must export `export const prerender = false;`
- Fetches regions via `getRegions` and passes them to `<CreateFieldForm client:load regions={regions} />`.
- Wrapped in `<Layout>`.

#### 2. Field Detail Placeholder Page
**File**: `src/pages/dashboard/fields/[id].astro`
**Intent**: A placeholder page so the redirect has a valid destination until S-04 is implemented.
**Contract**:
- Must export `export const prerender = false;`
- Fetches the field via `getFieldById(client, Astro.params.id)`.
- Displays a simple header (e.g., `<h1>{field.name}</h1>`) and a "Coming Soon" or basic info block.

### Success Criteria:

#### Automated Verification:
- Pages compile successfully.

#### Manual Verification:
- Navigating to `/dashboard/fields/new` shows the form.
- Filling out the form and submitting successfully redirects to `/dashboard/fields/[id]`.
- The placeholder page displays the correct field name.

---

## Testing Strategy

### Unit Tests:
- N/A for this feature, standard integration handles it.

### Integration Tests:
- N/A for MVP.

### Manual Testing Steps:
1. Log in to the application.
2. Navigate to `/dashboard/fields/new`.
3. Try to submit an empty form (verify validation errors).
4. Enter dimensions larger than 20x20 (verify validation prevents submission).
5. Fill out valid data, select a region via search, and submit.
6. Verify smooth redirection to the new field's detail page.
7. Verify the new field exists in the Supabase table `fields`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dependencies & UI Components

#### Automated
- [x] 1.1 `zod` is in `package.json` — 93f5ce3
- [x] 1.2 `src/components/ui/input.tsx`, `label.tsx`, `popover.tsx`, and `command.tsx` exist and pass type checks — 93f5ce3

### Phase 2: API Route

#### Automated
<<<<<<< HEAD
- [x] 2.1 Type checking passes

#### Manual
- [x] 2.2 Valid POST request creates a row in the `fields` table
=======
- [x] 2.1 Type checking passes — 7b03efb

#### Manual
- [x] 2.2 Valid POST request creates a row in the `fields` table — 7b03efb
>>>>>>> agents/field-creation-implementation-49667d4e

### Phase 3: Create Field Form Component

#### Automated
- [x] 3.1 Linter passes on the new component — 74c7b88

#### Manual
- [x] 3.2 Form renders correctly — 74c7b88
- [x] 3.3 Combobox filters the region list when typing — 74c7b88

### Phase 4: Pages & Routing

#### Automated
- [x] 4.1 Pages compile successfully — 366c921

#### Manual
- [x] 4.2 Navigating to `/dashboard/fields/new` shows the form — 366c921
- [x] 4.3 Successful submission redirects to `/dashboard/fields/[id]` — 366c921
- [x] 4.4 The placeholder page displays the correct field name — 366c921
