# Repository Guidelines

Astro 6 SSR app (React 19 islands, Tailwind 4, shadcn/ui, Supabase auth) deployed to Vercel. Node.js v22.14.0 required (see `@.nvmrc`).

## Hard Rules

- All pages are SSR (`output: "server"` in `astro.config.mjs`). API routes must export `const prerender = false`.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are server-only secrets declared via `astro:env` — never expose them to the client.
- Use `cn()` from `@/lib/utils` for Tailwind class merging; never concatenate Tailwind class strings manually.
- Use Astro components for static content and layout; use React only when interactivity is needed.
- `astro/no-set-html-directive` is an ESLint error — do not use `set:html`.
- Prefix intentionally unused variables with `_` to satisfy `@typescript-eslint/no-unused-vars`.

## UI & Design

- Before any UI change (layout, styling, components, pages), read `context/foundation/DESIGN.md` and follow the design direction documented there.
- When UI work establishes or updates design decisions, reflect them in `context/foundation/DESIGN.md` so future changes stay consistent.

## Project Structure

- `context/foundation/DESIGN.md` — UI/UX design spec (colors, typography, layout patterns, component usage)
- `src/layouts/` — Astro layouts
- `src/pages/` — SSR pages; `src/pages/api/` for API endpoints
- `src/components/` — Astro + React components; `src/components/ui/` for shadcn/ui
- `src/lib/` — Supabase client, utilities, and extracted services
- `src/middleware.ts` — auth guard; add protected paths to the `PROTECTED_ROUTES` array
- `src/types.ts` — shared entities and DTOs
- `supabase/migrations/` — SQL migration files

See `@CLAUDE.md` for architecture detail and auth flow.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build; requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` in env
- `npm run lint` — ESLint with type-checked rules (CI gate — must pass before merging)
- `npm run lint:fix` — auto-fix ESLint issues
- `npm run format` — Prettier with Astro and Tailwind plugins

Pre-commit: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Coding Conventions

- Path alias `@/*` resolves to `./src/*` (see `@tsconfig.json`).
- Prettier: double quotes, 2-space indent, 120-char print width, trailing commas. See `@.prettierrc.json`.
- shadcn/ui components live in `src/components/ui/` ("new-york" variant); install new ones with `npx shadcn@latest add [name]`.
- API route handlers export uppercase named functions (`GET`, `POST`, etc.) and validate input with zod.
- Hooks go in `src/components/hooks/`; business logic extracted from components goes in `src/lib/services/`.
- Migrations use the naming format `YYYYMMDDHHmmss_short_description.sql`; always enable RLS with per-operation, per-role policies on new tables.
- React: no `"use client"` or Next.js-style directives — this is not a Next.js project.

## Environment & Secrets

- Local dev: copy `@.env.example` to `.env`.
- Deploy: `npx vercel deploy`. Set secrets via Vercel dashboard or `npx vercel env add SUPABASE_URL`.

## CI

`@.github/workflows/ci.yml` runs `npm run lint` then `npm run build` on every push and PR to `master`. Both `SUPABASE_URL` and `SUPABASE_ANON_KEY` must be configured as GitHub repository secrets for the build step to pass.
