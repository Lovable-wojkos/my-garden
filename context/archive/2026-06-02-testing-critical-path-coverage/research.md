---
date: 2026-06-02T15:47:00Z
researcher: opencode
git_commit: 9e13d45bc44f623319d9fc5e30ad78b8161b051c
branch: development
repository: my-garden
topic: "testing-critical-path-coverage"
tags: [research, codebase, testing, e2e, coverage, authentication, supabase]
status: complete
last_updated: 2026-06-02
last_updated_by: opencode
---

# Research: testing-critical-path-coverage

**Date**: 2026-06-02T15:47:00Z
**Researcher**: opencode
**Git Commit**: 9e13d45bc44f623319d9fc5e30ad78b8161b051c
**Branch**: development
**Repository**: my-garden

## Research Question

Map out E2E coverage for main user journeys (auth, main features) and generate a detailed coverage document detailing untested critical paths and security boundaries.

## Summary

The repository currently has **zero testing tooling configured and zero test files** (no Vitest, Jest, Playwright, or Cypress). We identified the core critical paths that require End-to-End (E2E) test coverage. These paths encompass authentication (login, signup, session management via middleware), database security boundaries (Row Level Security), and the core application journeys related to garden field management, planting logic, and daily cron jobs.

## Detailed Findings

### Testing Setup (Or Lack Thereof)

- **Configuration:** No configuration files for testing frameworks (`vitest.config.ts`, `playwright.config.ts`, etc.) exist in the repository.
- **Scripts:** `package.json` contains no test-related scripts.
- **Existing Tests:** No files matching common test patterns (`*.test.ts`, `*.spec.ts`, or E2E directories) were found.

### Authentication & Session Security (Critical Paths)

Authentication relies heavily on standard Supabase SSR workflows and an Astro middleware guard.

- **Route Guarding:** [src/middleware.ts:11-23](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/src/middleware.ts#L11) checks for user sessions and explicitly protects paths starting with `/dashboard`.
- **Login Flow:** [src/pages/api/auth/signin.ts:4-19](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/src/pages/api/auth/signin.ts#L4) processes sign-in and redirects errors via query parameters.
- **Signup Flow:** [src/pages/api/auth/signup.ts:4-19](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/src/pages/api/auth/signup.ts#L4) processes registration and redirects to `/auth/confirm-email`.
- **Logout Flow:** [src/pages/api/auth/signout.ts:4-10](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/src/pages/api/auth/signout.ts#L4) terminates the session.
- **Cookie Management:** [src/lib/supabase.ts:12-32](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/src/lib/supabase.ts#L12) is responsible for correctly hydrating cookies for the SSR client to evaluate auth states.

### Core Application Journeys

The application centers around managing garden fields, selecting crops, and recording weather data. E2E tests must validate these database models and UI interactions.

- **Field Management:** Users must only be able to create, read, and manage their own `fields` (defined in [supabase/migrations/20260525000000_initial_schema.sql:100-131](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/supabase/migrations/20260525000000_initial_schema.sql#L100)).
- **Planting Restrictions:** Testing must cover the UNIQUE constraint in the `plantings` table ([supabase/migrations/20260525000000_initial_schema.sql:148](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/supabase/migrations/20260525000000_initial_schema.sql#L148)) which prevents multiple crops in the same field cell.
- **Admin vs. Standard Roles:** Standard users can request plants (`plant_requests`), but only `admin` users can approve them and add them to the global `plants` catalog. This relies on JWT custom claims defined in [supabase/migrations/20260526200000_merge_rls_admin_and_fk_indexes.sql:43-59](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/supabase/migrations/20260526200000_merge_rls_admin_and_fk_indexes.sql#L43).
- **Weather Cron Job:** [src/pages/api/cron/weather.ts:1-72](https://github.com/Lovable-wojkos/my-garden/blob/9e13d45bc44f623319d9fc5e30ad78b8161b051c/src/pages/api/cron/weather.ts#L1) runs daily to upsert weather data. Tests need to verify the `x-vercel-cron` authorization header and the logic that bypasses RLS with the `service_role` key.

## Architecture Insights

- **Strict SSR:** The repository adheres strictly to an Astro SSR model (`output: "server"`), meaning the UI state and authentication validation largely happen on the server, not in client-side React code. Playwright or Cypress would be ideal for validating these full server round-trips.
- **Supabase as Source of Truth:** Core domain logic (like cell uniqueness for planting and admin authorization roles) is offloaded entirely to the Supabase database schema via Row Level Security (RLS) constraints. The application relies entirely on these security boundaries.

## Open Questions

- **Missing `user_preferences` Table:** The cron job at `src/pages/api/cron/weather.ts` queries a `user_preferences` table (Line 18), but this table is not defined in any of the existing migration files. This will likely cause a runtime error when the cron job runs and should be addressed before testing.
- **Test Framework Choice:** Should we install Playwright for E2E testing given the full-stack SSR architecture of Astro?
