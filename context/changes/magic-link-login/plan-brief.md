# Magic Link Login — Plan Brief

> Full plan: `context/changes/magic-link-login/plan.md`
> Research: `context/changes/magic-link-login/research.md`

## What & Why

The PRD specifies passwordless email + magic link auth with no password storage, but the app still uses email/password from bootstrap scaffolding. This change implements Supabase magic-link login so users sign in (and register) with a single email field and a link sent to their inbox.

## Starting Point

Supabase SSR cookie handling and middleware session resolution already work (`createClient` + `getUser()`). Password signin/signup API routes, password forms, and Playwright password-based auth setup exist. No OTP send, callback exchange, or magic-link UI.

## Desired End State

User enters email on `/auth/signin`, receives a magic link, clicks it, lands on `/dashboard` authenticated. New accounts are created automatically on first login. No password fields in UI or API. E2E uses service-role `generateLink` instead of password fill.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Password auth | Remove entirely | PRD: no password storage | Research + PRD |
| Sign-up flow | Unified on signin via `signInWithOtp` + `shouldCreateUser: true` | One email entry for login and registration | Research |
| Callback handler | `/auth/callback` Astro page + `exchangeCodeForSession` | Reuses SSR cookie bridge; must stay public | Research |
| Check-email page | New `/auth/check-email` | Replaces signup confirm-email with magic-link messaging | Plan |
| Legacy `/auth/signup` | Redirect to signin | Preserve bookmarks without separate form | Plan |
| `emailRedirectTo` | Built from request origin | Works on dev `:4321` and production without hardcoding | Plan |
| E2E auth | `auth.admin.generateLink` in setup | Matches existing service-role E2E pattern | Research + Plan |
| Hosted redirect URLs | Manual Supabase dashboard step | Production domain unknown at plan time | Research |

## Scope

**In scope:**

- `POST /api/auth/magic-link`, `/auth/callback`, `/auth/check-email`
- Email-only `SignInForm`, Polish copy updates
- Remove password routes, `SignUpForm`, `PasswordToggle`, `confirm-email`
- Unit + middleware tests; Playwright auth setup update
- Local `supabase/config.toml` redirect URLs; roadmap/deploy doc fixes

**Out of scope:**

- OAuth providers, SMS OTP, password fallback
- CI Supabase Docker for E2E
- Automating hosted Supabase dashboard config
- Disabling password provider in Supabase dashboard (optional follow-up)

## Architecture / Approach

```
POST /api/auth/magic-link
  → signInWithOtp(email, redirectTo: /auth/callback)
  → redirect /auth/check-email

User clicks email link
  → GET /auth/callback?code=…
  → exchangeCodeForSession(code) → cookies via createClient
  → redirect /dashboard

middleware getUser() → Astro.locals.user on all subsequent requests
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Send + callback | OTP send route, callback exchange, email-only signin UI | Port 4321 vs Supabase `site_url` :3000 mismatch |
| 2. Remove password | Delete password routes/components, unify entry points | Missed link to signup/confirm-email |
| 3. Tests | magic-link + callback Vitest, middleware updates | Astro callback hard to test without thin helper extract |
| 4. E2E + docs | Playwright generateLink setup, config.toml, roadmap fix | E2E needs service role key locally |

**Prerequisites:** Local Supabase (`npx supabase start`) for manual magic-link verification; `SUPABASE_SERVICE_ROLE_KEY` for E2E.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Production Vercel URL must be added to hosted Supabase redirect allow-list before prod magic link works.
- Local `email_sent` rate limit (2/hour) may slow repeated manual testing.
- Existing password-created users can still log in via magic link to the same email — no data migration needed.

## Success Criteria (Summary)

- Email-only signin sends magic link; callback establishes session on `/dashboard`.
- No password UI or API routes remain.
- Lint, build, Vitest, and Playwright (with E2E env) pass.
