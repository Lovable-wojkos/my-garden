<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Magic Link Login Implementation Plan

- **Plan**: context/changes/magic-link-login/plan.md
- **Mode**: Deep
- **Date**: 2026-06-18
- **Verdict**: SOUND
- **Findings**: 1 critical, 4 warnings, 1 observation (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — E2E `generateLink` incompatible with PKCE-only callback

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 4 — Playwright auth setup; Phase 1 — Auth callback page
- **Detail**: Phase 4 calls `auth.admin.generateLink({ type: 'magiclink', … })` and navigates to `action_link`, expecting `/auth/callback` + `exchangeCodeForSession(code)` to establish a session. `generateLink` does not create PKCE `code_verifier` cookies (setup never calls `signInWithOtp`). The callback contract only handles `?code=` via `exchangeCodeForSession` — this E2E path will fail even in the same browser. `@supabase/ssr` forces `flowType: "pkce"` in `createServerClient`.
- **Fix A ⭐ Recommended**: Extend callback to handle `token_hash` + `type` query params via `verifyOtp({ token_hash, type })`, and update E2E setup to navigate to `/auth/callback?token_hash=${hashed_token}&type=magiclink` (from `data.properties.hashed_token`) instead of bare `action_link`.
- **Decision**: FIXED via Fix A

### F2 — Callback omits `verifyOtp` path documented in research

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — Auth callback page; Phase 3 — Callback tests
- **Detail**: Research (`research.md:138-140`) documents callback handling both `?code=` (PKCE via `exchangeCodeForSession`) and token-hash (`verifyOtp`). Plan callback contract only handles `code`. PKCE exchange requires the `code_verifier` cookie from the browser that called `signInWithOtp` — opening the email link in a different browser/device/incognito fails with `AuthPKCECodeVerifierMissingError`. Fixing F1 also resolves this for admin/E2E links; production email links still need same-browser unless `verifyOtp` is added for hash-style redirects.
- **Fix**: Add dual-path callback contract: if `code` present → `exchangeCodeForSession(code)`; else if `token_hash` + `type` present → `verifyOtp({ token_hash, type })`; else → signin error. Mirror in `src/lib/auth/callback.ts` helper and Phase 3 tests.
- **Decision**: FIXED

### F3 — Playwright skip strategy incomplete for missing E2E env

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 — Playwright auth setup
- **Detail**: Plan says setup should skip when env vars missing (non-fatal CI). Current `auth.setup.ts` throws. `admin-plant-requests.spec.ts` uses `test.skip` inside a spec — that pattern does not apply to the `setup` dependency project. `playwright.config.ts` has `chromium` depending on `setup` with `storageState: "playwright/.auth/user.json"`. If setup skips without writing that file, `dashboard.spec.ts` and `seed.spec.ts` fail. CI currently runs lint/build/vitest only (no Playwright), but local `npx playwright test` breaks without a gate.
- **Fix A ⭐ Recommended**: Add env guard in `playwright.config.ts` — conditionally include `setup` + `chromium` projects only when `E2E_EMAIL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are set; add a lightweight `no-auth` project or document that E2E requires full env.
- **Decision**: FIXED via Fix A

### F4 — Phase 4 docs miss README.md and CLAUDE.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Documentation
- **Detail**: `README.md:115-117` still documents email/password sign-in, sign-up, and confirm-email routes. `CLAUDE.md:28-29` lists `signin,signup` API endpoints and `confirm-email` page. Phase 4 updates `roadmap.md`, `deploy-plan.md`, and `DESIGN.md` but not these agent/onboarding docs.
- **Fix**: Add `README.md` (auth routes table) and `CLAUDE.md` (API endpoints + auth pages list) to Phase 4 doc updates with magic-link wording.
- **Decision**: FIXED

### F5 — Copy cleanup under-specified for signup/confirm-email keys

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Copy cleanup
- **Detail**: Phase 2 copy contract targets password keys (`passwordLabel`, `confirmPasswordLabel`, etc.) but `pl.ts` also has `nav.signUp`, `ctaSignUp`, `confirmEmail*`, `noAccount`, `linkSignUp`, `signUpButton`, `signUpPending` used by Welcome, Topbar, and confirm-email page. After deletions, grep may leave dead strings or broken references if not enumerated.
- **Fix**: Expand Phase 2 copy contract to list all signup/confirm-email keys and require grep for `confirmEmail`, `signUp`, `ctaSignUp`, `noAccount`, `linkSignUp` after component deletions.
- **Decision**: FIXED

### F6 — PKCE same-browser constraint not documented as product limit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Migration Notes
- **Detail**: If callback stays PKCE-only (`exchangeCodeForSession` without `verifyOtp`), users who open the magic link in a different browser than where they submitted the email will fail to log in. Common on desktop (email client vs default browser). Acceptable for MVP if documented; mitigated if F2 fix is applied.
- **Fix**: If keeping PKCE-only callback, add one sentence to Critical Implementation Details: "Magic link must be opened in the same browser profile that requested the link." If F2 is applied, downgrade to no action.
- **Decision**: DISMISSED — same-browser note added to Critical Implementation Details alongside dual-path callback (F2)

## Triage Summary

- **Fixed**: F1 (Fix A), F2, F3 (Fix A), F4, F5 (5)
- **Dismissed**: F6 (1) — covered by F2 + PKCE note in plan
- **Verdict after fixes**: SOUND
