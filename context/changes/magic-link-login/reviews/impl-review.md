<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Magic Link Login

- **Plan**: context/changes/magic-link-login/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-18
- **Verdict**: APPROVED
- **Findings**: 0 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Raw Supabase errors reflected in redirect URL

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/magic-link.ts:32-34, src/lib/auth/callback.ts:20-34
- **Detail**: On OTP send or callback failure, Supabase error.message was encoded into /auth/signin?error=….
- **Fix**: Map Supabase failures to generic user-facing messages in pl.ts; log raw errors server-side only.
- **Decision**: FIXED

### F2 — No server-side email validation on magic-link POST

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/magic-link.ts:13-14
- **Detail**: Email was read via form.get without trim, format check, or zod.
- **Fix**: Validate with zod (z.string().trim().email()); on failure redirect with pl.auth.errors.emailInvalid.
- **Decision**: FIXED

### F3 — No CSRF protection on magic-link POST

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/magic-link.ts
- **Detail**: State-changing POST accepted requests from any origin.
- **Fix A ⭐ Recommended**: Validate Origin or Referer header matches request origin / SITE_URL on POST.
- **Decision**: FIXED via Fix A

### F4 — verifyOtp accepts broad type query values

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth/callback.ts:26-32
- **Detail**: type query param passed through to verifyOtp beyond magic-link scope.
- **Fix**: Allowlist types (email, magiclink, signup only); reject others with generic callbackFailed redirect.
- **Decision**: FIXED

### F5 — SubmitButton pending state ineffective with native form POST

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/SignInForm.tsx:38, src/components/auth/SubmitButton.tsx:12
- **Detail**: useFormStatus() only tracks React form actions, not native HTML POST navigations.
- **Fix**: Use local useState pending on submit, or switch to fetch-based submit handler.
- **Decision**: FIXED

### F6 — Dev redirect UX not in plan

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/auth/check-email.astro, src/pages/api/auth/magic-link.ts:73-75
- **Detail**: dev_redirect query param and check-email dev panel aid local Supabase debugging but are not in plan.
- **Fix**: Document as plan addendum or remove before production (dev-only today).
- **Decision**: FIXED — documented in plan addendum

### F7 — SITE_URL origin enhancement vs plan

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/auth/magic-link.ts:12-16
- **Detail**: Plan specified request origin only; implementation prefers SITE_URL when set. Documented in README and .env.example.
- **Fix**: Accept as intentional enhancement; update plan addendum.
- **Decision**: ACCEPTED — documented in plan addendum

### F8 — Test gaps for SITE_URL fallback and null client callback

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/test/api/magic-link.test.ts, src/test/api/auth-callback.test.ts
- **Detail**: No tests for SITE_URL unset vs request origin divergence; no callback test for createClient null.
- **Fix**: Add targeted test cases when touching auth again.
- **Decision**: FIXED
