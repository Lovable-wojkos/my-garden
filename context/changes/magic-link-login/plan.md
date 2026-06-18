# Magic Link Login Implementation Plan

## Overview

Replace the bootstrap email/password auth with passwordless magic-link login via Supabase `signInWithOtp`, closing the gap between PRD access control ("Email + magic link — no password storage") and the current `signInWithPassword` / `signUp` implementation. Reuse the existing SSR cookie bridge (`createClient` + middleware `getUser()`); add send-OTP, callback exchange, and updated UI/tests.

## Current State Analysis

Research (`context/changes/magic-link-login/research.md`) established:

- PRD and shape notes require passwordless magic link; codebase uses email + password only
- `createClient` in `src/lib/supabase.ts:11–32` already wires Supabase SSR cookies correctly
- Middleware resolves sessions via `getUser()`; `/auth/*` and `/api/auth/*` are public
- No `signInWithOtp`, `exchangeCodeForSession`, or `/auth/callback` exists
- E2E auth setup (`playwright/auth/auth.setup.ts`) fills password fields — incompatible with passwordless
- `supabase/config.toml` `site_url` is `http://127.0.0.1:3000` but Astro dev/E2E use port **4321** — redirect allow-list must include `:4321`

### Key Discoveries:

- `src/pages/api/auth/signin.ts:13` — `signInWithPassword` (to remove)
- `src/pages/api/auth/signup.ts:13` — `signUp({ email, password })` (to remove)
- `src/components/auth/SignInForm.tsx` — password field + client validation (replace with email-only)
- `src/test/api/signin.test.ts` — redirect + cookie test pattern to mirror for magic-link route
- `playwright/tests/admin-plant-requests.spec.ts:15–18` — service-role client pattern for E2E
- `context/foundation/roadmap.md:57` — stale baseline claiming magic-link is already present

## Desired End State

After this plan:

1. User visits `/auth/signin`, enters email only, submits → redirected to `/auth/check-email`.
2. User clicks magic link in email → hits `/auth/callback?code=…` (PKCE) or `?token_hash=…&type=…` (admin/E2E links) → session cookies set → redirected to `/dashboard`.
3. New users are auto-provisioned on first magic-link login (`shouldCreateUser: true`); no password fields anywhere in UI or API.
4. `/auth/signup` redirects to `/auth/signin` (bookmark compatibility).
5. Unit tests cover magic-link send and callback exchange; middleware treats `/auth/callback` as public.
6. Playwright auth setup uses `auth.admin.generateLink` (service role) + `hashed_token` callback navigation instead of password form fill.
7. Local Supabase redirect URLs include `http://127.0.0.1:4321/auth/callback` and `http://localhost:4321/auth/callback`.

**Verification:** With local Supabase + Inbucket, submit email on signin → email arrives → click link → land on dashboard authenticated. `npm run lint`, `npm run build`, and Vitest pass.

## What We're NOT Doing

- OAuth / social login providers
- SMS OTP
- Keeping password auth as fallback (PRD forbids password storage)
- Separate signup page with its own form
- Email confirmation flow distinct from magic link (single OTP path for login + account creation)
- Hosted Supabase dashboard redirect URL changes (manual deploy step — documented, not automated)
- CI Supabase Docker stack for magic-link E2E (E2E skips when service env missing, same as admin E2E)

## Implementation Approach

Four phases: (1) core send + callback flow with updated signin UI, (2) remove password artifacts and unify entry points, (3) unit/middleware tests, (4) E2E + config/docs. Build `emailRedirectTo` dynamically from `new URL(context.request.url).origin` so the same code works on port 4321 locally and production Vercel URL.

## Critical Implementation Details

**Callback must stay public.** Do not add `/auth/callback` to `PROTECTED_ROUTES`. Middleware runs before the callback handler; unauthenticated users clicking the email link must reach the exchange handler.

**Port mismatch.** Astro dev and Playwright use `http://localhost:4321`. Supabase local `site_url` is `:3000`. Add `:4321` callback URLs to `supabase/config.toml` `additional_redirect_urls`; production URL is a manual Supabase dashboard step at deploy time.

**Security: uniform response.** On magic-link POST success, always redirect to `/auth/check-email` regardless of whether the email exists — do not leak account enumeration via different responses.

**Callback dual-path.** Extract `handleAuthCallback(searchParams, headers, cookies)` to `src/lib/auth/callback.ts`. If `code` is present → `exchangeCodeForSession(code)` (PKCE path from `signInWithOtp` emails). Else if `token_hash` and `type` are present → `verifyOtp({ token_hash, type })` (admin `generateLink` / E2E path). Else → signin error redirect. PKCE path requires the `code_verifier` cookie from the browser that submitted the sign-in form — user must open the email link in the same browser profile.

## Phase 1: Magic Link Send + Callback Exchange

### Overview

Add the server routes and pages that send the OTP email and exchange the callback code for a session. Update sign-in UI to email-only.

### Changes Required:

#### 1. Magic link send API route

**File**: `src/pages/api/auth/magic-link.ts`

**Intent**: Accept email via form POST, call Supabase OTP send, redirect to check-email page or back to signin with error.

**Contract**: Export `POST` handler. Read `email` from `FormData`. Use `createClient(context.request.headers, context.cookies)`. Call `signInWithOtp({ email, options: { emailRedirectTo: \`${origin}/auth/callback\`, shouldCreateUser: true } })` where `origin = new URL(context.request.url).origin`. On missing Supabase client → redirect `/auth/signin?error=…`. On Supabase error → redirect `/auth/signin?error=…` (encoded). On success → redirect `/auth/check-email`. Follow redirect-error pattern from `signin.ts`.

#### 2. Auth callback page + helper

**Files**: `src/pages/auth/callback.astro`, `src/lib/auth/callback.ts`

**Intent**: Exchange callback query params for session cookies, then redirect to dashboard.

**Contract**: `src/lib/auth/callback.ts` exports `handleAuthCallback(searchParams, headers, cookies)` returning `{ redirect: string }`. Logic: if `code` → `exchangeCodeForSession(code)`; else if `token_hash` + `type` → `verifyOtp({ token_hash, type })`; else → `/auth/signin?error=…`. On Supabase error → signin with encoded message. On success → `/dashboard`. Astro page calls the helper with `Astro.url.searchParams`, `Astro.request.headers`, `Astro.cookies`, then redirects. No React island; redirect-only page.

#### 3. Check-email page

**File**: `src/pages/auth/check-email.astro`

**Intent**: Static confirmation after magic link is sent — user knows to check inbox.

**Contract**: Astro page using `Layout`, centered card pattern matching `signin.astro`. Copy from `pl.auth.magicLinkSentTitle` / `magicLinkSentMessage` / `magicLinkSentBack`. Link back to `/auth/signin`.

#### 4. Email-only sign-in form

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Replace password form with single email field submitting to magic-link route.

**Contract**: Form `action="/api/auth/magic-link"`, `method="POST"`. Keep email validation regex and `FormField` / `SubmitButton` / `ServerError` pattern. Remove password state, `PasswordToggle`, and password validation. Update button copy to magic-link send label.

#### 5. Polish copy strings

**File**: `src/lib/copy/pl.ts`

**Intent**: Add magic-link strings; remove or leave unused password strings (remove if nothing references them after Phase 2).

**Contract**: Add under `auth`: `magicLinkSendButton`, `magicLinkSendPending`, `magicLinkSentTitle`, `magicLinkSentMessage`, `magicLinkSentBack`, optional `signInSubtitle` ("Podaj e-mail — wyślemy link do logowania"). Update `signInButton` usage or replace with new keys in form.

#### 6. Sign-in page cleanup

**File**: `src/pages/auth/signin.astro`

**Intent**: Remove signup cross-link; optional subtitle for unified login/register messaging.

**Contract**: Remove "Nie masz konta? Załóż konto" block (magic link handles both). Keep logged-in redirect to `/dashboard`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Submit valid email on `/auth/signin` → lands on `/auth/check-email`
- With local Supabase + Inbucket (`npx supabase start`), magic link email arrives and link contains `/auth/callback`
- Clicking link sets session and redirects to `/dashboard`
- Invalid/missing callback params redirects to signin with error
- PKCE email link opened in same browser as sign-in form succeeds; different browser shows signin error (expected)

**Implementation Note**: Pause for human confirmation of end-to-end magic link flow locally before Phase 2.

---

## Phase 2: Remove Password Auth & Unify Entry Points

### Overview

Delete password routes, components, and signup form. Redirect legacy signup URLs. Collapse landing CTAs to a single sign-in entry.

### Changes Required:

#### 1. Remove password API routes

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Eliminate password auth endpoints per PRD.

**Contract**: Delete both files.

#### 2. Remove password components

**Files**: `src/components/auth/SignUpForm.tsx`, `src/components/auth/PasswordToggle.tsx`

**Intent**: Remove unused password UI.

**Contract**: Delete both files.

#### 3. Signup page redirect

**File**: `src/pages/auth/signup.astro`

**Intent**: Preserve `/auth/signup` bookmarks without a separate form.

**Contract**: Replace body with server redirect to `/auth/signin` (same pattern as logged-in guard on signin page).

#### 4. Remove confirm-email page

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Signup confirmation page is obsolete; check-email replaces it.

**Contract**: Delete file. Grep for `/auth/confirm-email` references and remove/update.

#### 5. Landing and nav links

**Files**: `src/components/Welcome.astro`, `src/components/Topbar.astro`

**Intent**: Single auth entry point — no separate signup link.

**Contract**: `Welcome.astro` — remove secondary signup CTA button (keep primary sign-in). `Topbar.astro` — remove signup link for unauthenticated users.

#### 6. Copy cleanup

**File**: `src/lib/copy/pl.ts`

**Intent**: Remove dead password/signup strings if no longer referenced.

**Contract**: Remove all dead auth copy after grep. Password keys: `passwordLabel`, `passwordPlaceholder`, `confirmPasswordLabel`, `confirmPasswordPlaceholder`. Signup/confirm-email keys: `signUpTitle`, `signUpButton`, `signUpPending`, `confirmEmailTitle`, `confirmEmailMessage`, `confirmEmailBack`, `confirmEmailDevTitle`, `confirmEmailDevMessage`, `confirmEmailDevLink`, `noAccount`, `linkSignUp`, `hasAccount`, `linkSignIn`. Nav/CTA keys: `nav.signUp`, `ctaSignUp`. Run grep for `confirmEmail`, `signUp`, `ctaSignUp`, `noAccount`, `linkSignUp`, `passwordLabel` — zero hits outside `pl.ts` before marking done.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Grep confirms no remaining imports of deleted components or routes

#### Manual Verification:

- `/auth/signup` redirects to `/auth/signin`
- Landing page shows one auth CTA
- No password inputs visible anywhere in the app

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Unit & Middleware Tests

### Overview

Replace password auth tests with magic-link and callback tests. Update middleware public-route assertions.

### Changes Required:

#### 1. Magic link API tests

**File**: `src/test/api/magic-link.test.ts`

**Intent**: Cover send-OTP route behavior mirroring former signin tests.

**Contract**: Mock `createClient`. Cases: (a) null client → redirect signin with error, (b) Supabase error → redirect signin with encoded error, (c) success → redirect `/auth/check-email`, (d) success path passes `emailRedirectTo` ending in `/auth/callback` and uses request origin.

#### 2. Callback tests

**File**: `src/test/api/auth-callback.test.ts`

**Intent**: Verify dual-path callback helper success/failure redirects.

**Contract**: Test `handleAuthCallback` from `src/lib/auth/callback.ts` (extracted in Phase 1). Cases: (a) no `code` or `token_hash` → signin error redirect, (b) `code` + exchange error → signin error, (c) `code` + success → dashboard redirect + cookies.set called, (d) `token_hash` + `type` + verifyOtp error → signin error, (e) `token_hash` + `type` + success → dashboard redirect + cookies.set called.

#### 3. Remove obsolete auth tests

**Files**: `src/test/api/signin.test.ts`, `src/test/api/signup.test.ts`

**Intent**: Password routes deleted — tests go with them.

**Contract**: Delete both files.

#### 4. Middleware public routes

**File**: `src/test/middleware.test.ts`

**Intent**: Reflect new public auth paths.

**Contract**: Replace `/api/auth/signin` in public route list with `/api/auth/magic-link`. Add `/auth/callback` to public routes test. Remove `/auth/signup` if redirect-only (still public — may keep or replace with `/auth/check-email`).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx vitest run src/test/api/magic-link.test.ts src/test/api/auth-callback.test.ts src/test/middleware.test.ts` passes
- Full Vitest suite passes: `npx vitest run`

#### Manual Verification:

- None required beyond automated

---

## Phase 4: E2E, Supabase Config & Documentation

### Overview

Update Playwright auth setup for passwordless login, fix local redirect URLs, document production Supabase config, correct stale roadmap baseline.

### Changes Required:

#### 1. Playwright config env guard

**File**: `playwright.config.ts`

**Intent**: Only run auth-dependent projects when E2E env is complete — prevents storageState failures when secrets are missing.

**Contract**: Compute `hasE2EAuthEnv = Boolean(E2E_EMAIL && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)`. Include `setup` + `chromium` projects only when `hasE2EAuthEnv` is true. When false, omit those projects (or log that E2E auth specs are skipped). Document in a comment that `npx playwright test` requires full E2E env for dashboard/seed specs.

#### 2. Playwright auth setup

**File**: `playwright/auth/auth.setup.ts`

**Intent**: Authenticate E2E projects without password form.

**Contract**: Require `E2E_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (drop `E2E_PASSWORD`). Create service-role client (`@supabase/supabase-js`, same pattern as `admin-plant-requests.spec.ts`). Call `auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: \`${baseURL}/auth/callback\` } })`. Navigate browser to `\`${baseURL}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink\`` (not bare `action_link` — PKCE verifier is absent for admin-generated links). Wait for `/dashboard`. Save `storageState`. Env guard in `playwright.config.ts` handles skip when vars missing.

#### 3. Environment example

**File**: `.env.example`

**Intent**: Document E2E env changes.

**Contract**: Remove `E2E_PASSWORD`. Add comment that E2E magic link requires `SUPABASE_SERVICE_ROLE_KEY`. Keep `E2E_EMAIL`.

#### 4. Supabase local redirect URLs

**File**: `supabase/config.toml`

**Intent**: Allow callback on Astro dev port.

**Contract**: Add to `additional_redirect_urls`: `http://127.0.0.1:4321/auth/callback`, `http://localhost:4321/auth/callback`. Optionally update `site_url` comment noting Astro default is 4321.

#### 5. Roadmap baseline correction

**File**: `context/foundation/roadmap.md`

**Intent**: Fix inaccurate auth baseline after implementation.

**Contract**: Line ~57: change to reflect passwordless magic-link auth via Supabase SSR (accurate post-change wording).

#### 6. Deploy plan note

**File**: `context/deployment/deploy-plan.md`

**Intent**: Remind operator to add production callback URL in hosted Supabase.

**Contract**: Under auth verification checklist, note: add `https://<production-domain>/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs before testing magic link in production.

#### 7. DESIGN.md auth note (minimal)

**File**: `context/foundation/DESIGN.md`

**Intent**: Record auth UX decision for future UI work.

**Contract**: One sentence under auth/forms: sign-in is email-only magic link; no password fields.

#### 8. README and CLAUDE.md auth routes

**Files**: `README.md`, `CLAUDE.md`

**Intent**: Keep onboarding docs accurate after password auth removal.

**Contract**: `README.md` auth routes table — replace email/password entries with magic-link flow (`/auth/signin`, `/auth/check-email`, `/auth/callback`, `/auth/signup` redirect). `CLAUDE.md` — update API endpoints to `magic-link` + `signout`; auth pages to `signin`, `check-email`, `callback` (signup redirects).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npx vitest run` passes

#### Manual Verification:

- With full E2E env, `npx playwright test` auth setup completes and dashboard spec passes
- Hosted Supabase redirect URL documented for production deploy

**Implementation Note**: E2E auth specs run only when `E2E_EMAIL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are set (`playwright.config.ts` guard). CI (lint/build/vitest only) unaffected.

---

## Testing Strategy

### Unit Tests:

- Magic-link POST: config missing, Supabase error, success redirect, `emailRedirectTo` contract
- Callback helper: missing params, PKCE exchange failure/success, verifyOtp failure/success + cookies
- Middleware: `/auth/callback` and `/api/auth/magic-link` public

### Integration Tests:

- Vitest mocks Supabase client (existing pattern) — no live Supabase in unit tests

### Manual Testing Steps:

1. `npx supabase start` → open Inbucket (mail catcher)
2. `npm run dev` → `/auth/signin` → submit email
3. Open magic link from Inbucket → confirm `/dashboard` loads with user email in shell
4. Sign out → confirm session cleared
5. Visit `/auth/signup` → confirm redirect to signin

## Performance Considerations

Negligible — one Supabase API call per login attempt. Rate limits in local config (`email_sent = 2/hour`) may affect rapid manual testing; use Inbucket resend sparingly or adjust local limit only if blocking dev (out of scope unless needed).

## Migration Notes

Existing users created via password signup retain Supabase auth accounts — magic link login works for the same email without migration. No DB schema changes. Remove password UI only; Supabase project may still allow password auth at provider level until disabled in dashboard (optional hardening, out of scope).

## References

- Research: `context/changes/magic-link-login/research.md`
- Supabase SSR client: `src/lib/supabase.ts:11-32`
- Auth redirect pattern: `src/pages/api/auth/signin.ts` (removed in Phase 2)
- E2E service-role pattern: `playwright/tests/admin-plant-requests.spec.ts:15-18`
- PRD access control: `context/foundation/prd.md:133`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Magic Link Send + Callback Exchange

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run build` passes

#### Manual

- [x] 1.3 Submit email → check-email page; click Inbucket link → dashboard session

### Phase 2: Remove Password Auth & Unify Entry Points

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes
- [x] 2.3 No remaining imports of deleted password auth files

#### Manual

- [x] 2.4 Signup redirect and single landing CTA verified

### Phase 3: Unit & Middleware Tests

#### Automated

- [x] 3.1 Magic-link and callback tests pass
- [x] 3.2 Middleware tests pass
- [x] 3.3 Full Vitest suite passes

### Phase 4: E2E, Supabase Config & Documentation

#### Automated

- [x] 4.1 Lint, build, Vitest pass

#### Manual

- [x] 4.2 Playwright auth setup + dashboard spec pass with E2E env
- [x] 4.3 Production Supabase redirect URL documented

## Implementation Addenda

Post-implementation notes captured during impl-review (2026-06-18):

### Dev redirect debugging (Phase 1)

In `import.meta.env.DEV`, `POST /api/auth/magic-link` appends `?dev_redirect=<emailRedirectTo>` to the check-email redirect. `check-email.astro` shows the exact callback URL sent to Supabase so local redirect-URL mismatches are visible without digging through mail. Production builds omit the query param and panel.

### SITE_URL origin override (Phase 1)

`resolveAppOrigin()` prefers `SITE_URL` from `astro:env/server` when set, falling back to `new URL(request.url).origin`. Supports Vercel preview/production where the request origin may differ from the canonical app URL. Documented in `README.md` and `.env.example`.
