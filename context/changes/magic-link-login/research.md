---
date: 2026-06-18T12:00:00+02:00
researcher: Auto
git_commit: ce8946214a111814ed377f0625ca2aa5430645df
branch: development
repository: my-garden
topic: "Magic link login — closing the gap between PRD passwordless auth and current email/password implementation"
tags: [research, codebase, auth, supabase, magic-link, passwordless]
status: complete
last_updated: 2026-06-18
last_updated_by: Auto
---

# Research: Magic link login

**Date**: 2026-06-18T12:00:00+02:00  
**Researcher**: Auto  
**Git Commit**: `ce8946214a111814ed377f0625ca2aa5430645df`  
**Branch**: `development`  
**Repository**: my-garden

## Research Question

What is required to implement magic link (passwordless email) login in my-garden, given the PRD specifies "Email + magic link (passwordless). No password storage" but the live codebase uses email/password?

## Summary

**The PRD and shape notes specify passwordless magic-link auth; the codebase implements email + password instead.** There is no `signInWithOtp`, `verifyOtp`, `exchangeCodeForSession`, or auth callback route anywhere under `src/`. The existing Supabase SSR cookie infrastructure (`createClient` + middleware `getUser()`) is already suitable for magic link — only the send-OTP and callback-exchange routes, UI, copy, tests, and E2E strategy are missing.

| Layer | Status |
|-------|--------|
| PRD / product intent | ✅ Email + magic link, no password storage |
| Roadmap baseline claim | ⚠️ Stale — says "magic-link flow present" but code is password-based |
| Supabase SSR client + cookies | ✅ `src/lib/supabase.ts` |
| Middleware session resolution | ✅ `getUser()` on every request |
| Magic link send (`signInWithOtp`) | ❌ Not implemented |
| Auth callback (code/token exchange) | ❌ No `/auth/callback` route |
| Sign-in UI | Password form only (`SignInForm.tsx`) |
| Sign-up UI | Password + confirm (`SignUpForm.tsx`) |
| Unit tests for auth API | ✅ Password signin/signup/signout |
| E2E auth setup | Password-only (`playwright/auth/auth.setup.ts`) |
| Supabase local config | OTP settings present; `enable_confirmations = false` |

**Recommended shape for `/10x-plan`:**

1. Replace (or demote) password sign-in with email-only magic link on `/auth/signin`.
2. Add `POST /api/auth/magic-link` calling `signInWithOtp({ email, options: { emailRedirectTo } })` → redirect to a "check your email" page (reuse or extend `confirm-email.astro` pattern).
3. Add `/auth/callback` (Astro page or API route) calling `exchangeCodeForSession(code)` via `createClient(headers, cookies)` — must stay **outside** `PROTECTED_ROUTES` until cookies are set.
4. Decide signup scope: Supabase `signInWithOtp` with `shouldCreateUser: true` can unify sign-in and sign-up (passwordless), aligning with PRD "no password storage" — remove or deprecate password signup.
5. Configure redirect allow-list: local `supabase/config.toml` + hosted Supabase dashboard for production URL.
6. Extend `pl.auth` copy, mirror redirect+cookie test patterns from `signin.test.ts`, update E2E strategy (service-role token injection or keep a test password bypass for CI only).

## Detailed Findings

### Product requirements vs implementation

**PRD** (`context/foundation/prd.md:133`):

> Authentication: Email + magic link (passwordless). No password storage.

**Shape notes** (`context/foundation/shape-notes.md:37`) repeat the same requirement.

**Roadmap baseline** (`context/foundation/roadmap.md:57`) incorrectly states auth is "present — Supabase SSR magic-link flow". This was written at bootstrap time and was never updated when password auth was scaffolded instead.

**Deployment checklist** (`context/deployment/deploy-plan.md:127,190`) still lists "Test authentication flow (magic link login)" as a verification step — confirming product intent was never retracted.

### Current auth architecture

#### Supabase SSR client

`createClient(requestHeaders, cookies)` in `src/lib/supabase.ts:11–32` wraps `@supabase/ssr` `createServerClient` with cookie read/write via Astro's `cookies.set()`. All auth routes and middleware use this same client — session cookies set during OTP exchange will flow through identically to password login.

#### Middleware

`src/middleware.ts:17–36`:

- Resolves `context.locals.user` via `supabase.auth.getUser()` on every request.
- Redirects unauthenticated users on `PROTECTED_ROUTES` prefixes to `/auth/signin`.
- **Public paths include** `/auth/*` and `/api/auth/*` — callback route must live under one of these (or another unlisted public prefix).

`PROTECTED_ROUTES` (`middleware.ts:6–15`): `/dashboard`, `/admin`, `/api/admin`, `/api/weather`, `/api/user-preferences`, `/api/geocoding-suggestions`, `/api/plantings`, `/api/plant-requests`.

#### Auth API routes (password only)

| Route | Method | Supabase call | Success redirect |
|-------|--------|---------------|------------------|
| `src/pages/api/auth/signin.ts` | POST | `signInWithPassword` | `/dashboard` |
| `src/pages/api/auth/signup.ts` | POST | `signUp({ email, password })` | `/auth/confirm-email` |
| `src/pages/api/auth/signout.ts` | POST | `signOut()` | `/` |

**Patterns:**

- FormData input, no zod validation (contrast with domain API routes).
- Errors: redirect with `?error=` query param, URL-encoded.
- Missing-config guard: redirect with "Supabase is not configured".
- No `emailRedirectTo` anywhere.

#### Auth pages

| Page | Purpose |
|------|---------|
| `src/pages/auth/signin.astro` | Redirects if already logged in; renders `SignInForm` |
| `src/pages/auth/signup.astro` | Renders `SignUpForm`; link to signin |
| `src/pages/auth/confirm-email.astro` | Static post-signup messaging; **no token handling** |

`confirm-email.astro:5–19` switches copy in dev vs prod but never interacts with Supabase — it is a UX placeholder, not a confirmation handler.

#### Auth React components

| Component | Role |
|-----------|------|
| `SignInForm.tsx` | Email + password; POST `/api/auth/signin` |
| `SignUpForm.tsx` | Email + password + confirm password |
| `FormField.tsx` | Shared labeled input with inline errors |
| `ServerError.tsx` | Server-side error banner from `?error=` |
| `SubmitButton.tsx` | Pending state via `useFormStatus()` |
| `PasswordToggle.tsx` | Show/hide password |

Client validation uses inline regex/functions, not zod. Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

#### Copy strings

`src/lib/copy/pl.ts:34–67` — all auth strings assume password flows (`passwordLabel`, `passwordRequired`, etc.). No magic-link-specific strings exist.

### What is missing for magic link

Grep across `src/` finds **zero** references to:

- `signInWithOtp`
- `verifyOtp`
- `exchangeCodeForSession`
- `emailRedirectTo`

No `/auth/callback` page or API route exists (glob search returned 0 files).

**Supabase SSR magic-link flow (standard pattern):**

1. User submits email → server calls `signInWithOtp({ email, options: { emailRedirectTo: '<origin>/auth/callback' } })`.
2. User clicks link in email → Supabase redirects to callback with `?code=` (PKCE) or hash tokens depending on config.
3. Callback handler calls `exchangeCodeForSession(code)` (or `verifyOtp` for token hash) using the same `createClient` — cookies are written via `setAll`.
4. Redirect to `/dashboard`.

The cookie/session layer is ready; steps 1–3 and UI are not.

### Supabase configuration

`supabase/config.toml`:

| Setting | Value | Relevance |
|---------|-------|-----------|
| `[auth] site_url` | `http://127.0.0.1:3000` | Base for redirect allow-list |
| `additional_redirect_urls` | `https://127.0.0.1:3000` | Must add production URL + `/auth/callback` |
| `[auth.email] enable_confirmations` | `false` | Local dev: no email confirm step |
| `otp_length` | `6` | Email OTP config (unused by app) |
| `otp_expiry` | `3600` | 1 hour OTP lifetime |
| `[auth.rate_limit] token_verifications` | `30` | Rate limit for magic link clicks |
| `[auth.rate_limit] email_sent` | `2` | Very low local email cap — relevant for dev testing |

SMTP is commented out locally; magic link emails in dev come from Supabase Inbucket (default local mail catcher) when running `npx supabase start`.

Hosted Supabase project will need matching **Redirect URLs** in the dashboard (Site URL + additional redirect URLs including `/auth/callback`).

### Test coverage

**Unit tests** (`src/test/api/signin.test.ts`, `signup.test.ts`):

- Supabase-not-configured redirect
- Auth failure with encoded error message
- Success redirect + cookie write via `createClient`

These establish the test pattern for a new magic-link route: mock `signInWithOtp`, assert redirect to check-email page, assert `emailRedirectTo` includes callback URL.

**Middleware tests** (`src/test/middleware.test.ts`):

- Unauthenticated → redirect to `/auth/signin` for protected prefixes
- Public routes include `/api/auth/signin`, `/auth/signup`
- Should add `/auth/callback` as explicitly public if tested

**E2E** (`playwright/auth/auth.setup.ts:6–22`):

- Requires `E2E_EMAIL` + `E2E_PASSWORD`
- Fills password fields on signin page
- **Incompatible with passwordless-only** unless E2E uses an alternative (pre-seeded session, Supabase admin API to generate magic link, or a CI-only password bypass)

`.env.example` documents `E2E_EMAIL` and `E2E_PASSWORD` — would need updating if passwords are removed.

### Sign-out and session usage elsewhere

Sign-out uses native HTML forms posting to `/api/auth/signout`:

- `src/components/AppShell.astro`
- `src/components/Topbar.astro`
- `src/pages/dashboard/settings.astro`

These are unaffected by magic link — `signOut()` works the same regardless of how the session was created.

Some dashboard pages also guard with `Astro.locals.user` and redirect to signin (e.g. `fields/[id].astro`, `fields/new.astro`) — no change needed once callback sets cookies.

## Code References

- `context/foundation/prd.md:133` — PRD passwordless requirement
- `context/foundation/shape-notes.md:37` — Same requirement in shape notes
- `context/foundation/roadmap.md:57` — Stale "magic-link flow present" baseline (incorrect)
- `src/lib/supabase.ts:11-32` — SSR client with cookie bridge (reuse for OTP exchange)
- `src/middleware.ts:6-36` — Protected routes + `getUser()` session resolution
- `src/pages/api/auth/signin.ts:4-20` — Current password sign-in (to replace or demote)
- `src/pages/api/auth/signup.ts:4-20` — Current password sign-up (conflicts with PRD)
- `src/pages/auth/signin.astro:6-19` — Sign-in page entry point
- `src/pages/auth/confirm-email.astro:5-35` — Static check-email page (pattern to reuse)
- `src/components/auth/SignInForm.tsx:13-88` — Password form (replace with email-only)
- `src/components/auth/SignUpForm.tsx` — Password signup form
- `src/lib/copy/pl.ts:34-67` — Auth UI strings (need magic-link copy)
- `supabase/config.toml:150-217` — Auth, email OTP, redirect URL config
- `src/test/api/signin.test.ts:24-78` — Auth API test patterns
- `playwright/auth/auth.setup.ts:6-22` — E2E password login (needs new strategy)
- `.env.example:4-6` — E2E credentials (password-based)

## Architecture Insights

1. **Redirect-based auth errors, not JSON** — Auth API routes always redirect with `?error=`; UI reads via `Astro.url.searchParams`. Magic link routes should follow the same pattern for consistency.

2. **No zod on auth routes** — Validation is minimal (FormData casts). Magic link route only needs email; client-side regex already exists in forms.

3. **Cookie writes happen inside Supabase client, not route handlers** — Tests mock `createClient` and verify `cookies.set` is called. Callback route tests should assert `exchangeCodeForSession` triggers cookie writes the same way.

4. **`getUser()` not `getSession()`** — Middleware uses the stricter JWT validation. Magic link sessions will work identically once cookies are set.

5. **Unified passwordless signup** — Supabase `signInWithOtp` with default `shouldCreateUser: true` creates accounts on first login. This aligns with PRD and could eliminate the separate signup page/password flow entirely, simplifying to a single email entry point.

6. **Callback must be public** — If `/auth/callback` were added to `PROTECTED_ROUTES`, users clicking the email link would hit middleware before cookies exist and get redirected to signin, breaking the flow.

## Historical Context (from prior changes)

- `context/archive/2026-05-26-imgw-weather-probe/plan.md:359` — E2E plan assumed "Log in via magic link → `/dashboard`" but was never implemented that way; password auth was used instead.
- `context/archive/2026-05-25-db-schema-and-migrations/plan.md:272` — Test plan mentioned "Create a test user via magic link" — aspirational, not implemented.
- `context/archive/2026-06-02-testing-critical-path-coverage/research.md` — Documents password signin/signup API routes as the auth critical path; no magic link coverage planned at that time.
- `context/foundation/tech-stack.md:24` — Stack selection rationale mentions "magic link auth" as a requirement driving Supabase choice.

No archived change folder documents a deliberate decision to switch from magic link to password — the password implementation appears to be bootstrap scaffolding that was never replaced.

## Related Research

- `context/archive/2026-06-02-testing-critical-path-coverage/research.md` — Auth critical path mapping (password-based)
- `context/archive/2026-06-15-testing-critical-path-coverage/research.md` — Risk #1 auth gating coverage gaps

## Open Questions

1. **Replace vs coexist** — Should password auth be removed entirely (PRD says yes) or kept temporarily for E2E/dev convenience?
2. **Signup page fate** — Single email entry on signin with auto-provisioning, or keep separate signup route that also sends magic link?
3. **Production redirect URL** — What is the deployed Vercel URL to add to Supabase redirect allow-list?
4. **E2E strategy** — Options: (a) Supabase admin API to generate verification links in CI, (b) inject session cookies via service role, (c) keep password auth behind a dev-only flag for Playwright.
5. **Email confirmation vs magic link** — With `enable_confirmations = false` locally, first OTP click logs user in directly. Confirm hosted Supabase settings match intended prod behavior.
6. **Roadmap correction** — Update `context/foundation/roadmap.md` baseline auth line once magic link lands (or note as in-progress during this change).
