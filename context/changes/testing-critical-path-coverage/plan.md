# Testing — Critical Path Coverage — Implementation Plan

## Overview

Install Vitest from scratch and write targeted tests covering the auth critical path and React form validation logic. The project currently has zero tests and no test framework. This plan establishes the test infrastructure and writes the first suite covering the most valuable, testable code that exists today.

## Current State Analysis

No test runner, no test files, no test-related devDependencies. The codebase contains:

- `src/lib/supabase.ts` — `createClient` returns `null` when env vars are absent
- `src/middleware.ts` — redirects unauthenticated users away from `PROTECTED_ROUTES`
- `src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts` — API route handlers with 2–3 redirect branches each
- `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx` — React forms with non-trivial client-side validation logic

The Astro config uses two virtual modules (`astro:env/server`, `astro:middleware`) that have no real counterpart at test time and must be aliased to mock files.

## Desired End State

`npm test` runs a Vitest suite with **all tests green**. The suite covers:

1. **Middleware**: unauthenticated access to `/dashboard` triggers redirect to `/auth/signin`
2. **API routes (error branches)**: Supabase-not-configured and auth-error redirects for signin, signup; null-client graceful handling for signout
3. **Form validation**: empty field, invalid format, boundary password length, password mismatch cases for both `SignInForm` and `SignUpForm`

No CI wiring — that is out of scope for this change.

### Key Discoveries

- `astro:env/server` and `astro:middleware` are Astro-injected virtual modules; Vitest must alias them to a mock file via `resolve.alias` in `vitest.config.ts` — `vi.mock()` alone cannot intercept virtual modules reliably
- A **separate `vitest.config.ts`** is required; extending `astro.config.mjs` causes `@astrojs/react` vs `@vitejs/plugin-react` conflicts
- `SubmitButton` uses `useFormStatus` (React 19 `react-dom` hook); it renders inside a `<form>` in both components so happy-dom handles it correctly
- Error messages in `FormField` are rendered as `<p>` elements containing the literal error string — queryable directly by text

## What We're NOT Doing

- No CI pipeline changes (`npm test` in GitHub Actions is a follow-up)
- No coverage reporting or threshold enforcement
- No E2E / Playwright tests
- No tests for `cn()` utility, `configStatuses`, or Astro page components
- No happy-path tests for API routes (errors-only scope by decision)
- No middleware test for authenticated user setting `context.locals.user`

## Implementation Approach

Three-phase approach: stand up infrastructure first so phases 2 and 3 are purely about writing test logic.

**Phase 1** installs Vitest and the React testing stack, creates the virtual-module mock file, a shared setup file, updates `tsconfig.json` for global type awareness, and adds `npm test` and `npm run test:run` scripts.

**Phase 2** writes pure-TypeScript unit tests for the three API routes and the middleware, all relying on `vi.mock('@/lib/supabase')` to control the Supabase client.

**Phase 3** writes React component tests for the two form components using `@testing-library/react` + `userEvent`.

---

## Phase 1: Test Infrastructure Setup

### Overview

Install all test dependencies, configure Vitest with virtual-module aliases and path resolution, create the shared mock and setup files, and wire `npm test` into `package.json`. After this phase `npm run test:run` exits 0 (no test files yet, that is acceptable).

### Changes Required

#### 1. Install test devDependencies

**File**: `package.json`

**Intent**: Add Vitest and the React testing stack as devDependencies so the test runner and DOM environment are available.

**Contract**: The following packages are added to `devDependencies`:
- `vitest` — test runner
- `@vitejs/plugin-react` — React JSX transform for Vitest (not `@astrojs/react`, which conflicts)
- `@testing-library/react` — component rendering and querying API
- `@testing-library/user-event` — simulates realistic browser interactions
- `@testing-library/jest-dom` — custom DOM matchers (`.toBeInTheDocument()` etc.)
- `happy-dom` — lightweight DOM environment for Vitest

Run `npm install` after editing to lock versions in `package-lock.json`.

#### 2. Add test scripts to package.json

**File**: `package.json`

**Intent**: Expose `npm test` (watch mode) and `npm run test:run` (single-pass CI-friendly run) as standard entry points.

**Contract**: Add to `scripts`:
```json
"test": "vitest",
"test:run": "vitest run"
```

#### 3. Create Vitest configuration

**File**: `vitest.config.ts` (project root)

**Intent**: Configure Vitest with happy-dom environment, global APIs, path alias, and module aliases for Astro virtual modules. Must be separate from `astro.config.mjs` to avoid Astro integration conflicts.

**Contract**: Key configuration fields:
- `plugins: [react()]` from `@vitejs/plugin-react`
- `test.environment: 'happy-dom'`
- `test.globals: true`
- `test.setupFiles: ['./src/test/setup.ts']`
- `resolve.alias`:
  - `@` → `./src` (mirrors tsconfig paths)
  - `astro:env/server` → `./src/test/mocks/astro-virtual.ts`
  - `astro:middleware` → `./src/test/mocks/astro-virtual.ts`

Use `fileURLToPath` + `new URL(path, import.meta.url)` for all alias values (ESM-safe).

#### 4. Create Astro virtual module mock

**File**: `src/test/mocks/astro-virtual.ts` (new file)

**Intent**: Provide named exports that satisfy every import from `astro:env/server` and `astro:middleware` so that the files under test can be imported without errors.

**Contract**: Must export:
- `SUPABASE_URL: string` — a placeholder URL (e.g. `'http://localhost:54321'`)
- `SUPABASE_ANON_KEY: string` — a placeholder JWT string
- `defineMiddleware: (fn: unknown) => unknown` — identity/passthrough function (Astro's real implementation does the same; it is purely a type helper)

Individual test files that need different env values (e.g. to simulate missing config) will override via `vi.mock('astro:env/server', ...)` inline — the alias provides the default.

#### 5. Create test setup file

**File**: `src/test/setup.ts` (new file)

**Intent**: Run once before the test suite starts: import jest-dom custom matchers and register `@testing-library/react` cleanup after each test.

**Contract**: Two side-effect imports:
- `import '@testing-library/jest-dom'` — augments Vitest's `expect` with DOM matchers
- `afterEach` calling `cleanup()` from `@testing-library/react` — prevents DOM leaks between tests

#### 6. Update tsconfig.json for Vitest globals

**File**: `tsconfig.json`

**Intent**: Make the TypeScript compiler aware of Vitest's global APIs (`describe`, `it`, `expect`, `vi`) so test files type-check without explicit imports.

**Contract**: Add `"types": ["vitest/globals"]` to `compilerOptions`. The existing `extends`, `paths`, and `jsx` settings remain unchanged.

### Success Criteria

#### Automated Verification

- `npm install` completes without errors
- `npm run test:run` exits 0 (zero test files is acceptable — confirms Vitest resolves, aliases load, and setup file runs without crashing)
- `npm run lint` passes (new config files pass ESLint)

#### Manual Verification

- `npm test` launches Vitest in watch mode and shows the "No test files found" message (not an error or crash)

**Implementation Note**: After completing this phase and automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Server-side Unit Tests

### Overview

Write pure TypeScript unit tests for the auth middleware and three API route handlers. All tests mock `@/lib/supabase` via `vi.mock()` to control what `createClient` returns, avoiding any real network calls or environment dependency.

### Changes Required

#### 1. Middleware test

**File**: `src/test/middleware.test.ts` (new file)

**Intent**: Verify that an unauthenticated request to `/dashboard` is redirected to `/auth/signin`. This is the only middleware branch in scope.

**Contract**: Mock setup:
- `vi.mock('@/lib/supabase')` — then `vi.mocked(createClient).mockReturnValue(mockSupabaseClient)` where `mockSupabaseClient.auth.getUser` resolves to `{ data: { user: null } }`
- Construct a fake Astro middleware context with `url: new URL('http://localhost/dashboard')`, `request`, `cookies: {}`, `locals: {}`, and `redirect: vi.fn()`
- Import and call `onRequest` from `@/middleware` directly (it is the raw handler — `defineMiddleware` is mocked as a passthrough in `astro-virtual.ts`)
- Assert `context.redirect` was called with `'/auth/signin'`

#### 2. Signin API route tests

**File**: `src/test/api/signin.test.ts` (new file)

**Intent**: Verify the two error redirect branches in the signin handler: when Supabase is not configured (null client) and when the auth call returns an error.

**Contract**: Helper: build a minimal Astro-like `APIContext` with `request` (a `POST Request` with a `FormData` body containing `email` and `password`), `cookies` (object with `set` spy), and `redirect` (a `vi.fn()` returning a `Response`).

Two test cases:
1. `createClient` returns `null` → assert `context.redirect` called with a URL matching `/auth/signin?error=`
2. `createClient` returns a mock client whose `auth.signInWithPassword` resolves to `{ error: { message: 'Invalid login credentials' } }` → assert `context.redirect` called with URL containing the encoded message

Use `vi.mock('@/lib/supabase')` + `vi.mocked(createClient).mockReturnValue(...)` per test.

#### 3. Signup API route tests

**File**: `src/test/api/signup.test.ts` (new file)

**Intent**: Mirror the signin test structure for the signup handler's two error branches.

**Contract**: Same helper pattern. Two test cases:
1. `createClient` returns `null` → redirect to `/auth/signup?error=`
2. `createClient` returns mock client whose `auth.signUp` resolves with error → redirect to `/auth/signup?error=<encoded message>`

#### 4. Signout API route test

**File**: `src/test/api/signout.test.ts` (new file)

**Intent**: Verify the null-client graceful-degradation branch: when Supabase is not configured, signout still redirects to `/` without throwing.

**Contract**: One test case: `createClient` returns `null` → handler completes without error → `context.redirect` called with `'/'`.

### Success Criteria

#### Automated Verification

- `npm run test:run` runs all 6 server-side test cases and reports 0 failures
- `npm run lint` passes

#### Manual Verification

- Run `npm test` in watch mode, confirm no skipped or pending tests appear in the output

**Implementation Note**: After completing this phase and automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: React Component Tests

### Overview

Write `@testing-library/react` tests for the two auth form components, covering the validation error cases selected during planning. Each test renders the component, submits the form without valid input, and asserts the expected error message appears in the DOM.

### Changes Required

#### 1. SignInForm validation tests

**File**: `src/test/components/SignInForm.test.tsx` (new file)

**Intent**: Cover the three validation branches in `SignInForm.validate()`: empty email, invalid email format, and empty password.

**Contract**: Each test uses `render(<SignInForm />)`, then submits the form via `fireEvent.submit` on the `<form>` element (or click the submit button), and queries for the error `<p>` text using `screen.getByText`.

Three test cases:
1. Submit with both fields empty → `'Email is required'` and `'Password is required'` visible
2. Type an invalid email (e.g. `'notavalid'`), leave password empty, submit → `'Enter a valid email address'` visible
3. Type a valid email, leave password empty, submit → `'Password is required'` visible; no email error

No mocking needed — the form never reaches the network in these tests (invalid data prevents submission).

#### 2. SignUpForm validation tests

**File**: `src/test/components/SignUpForm.test.tsx` (new file)

**Intent**: Cover the boundary and mismatch cases in `SignUpForm.validate()`: invalid email format, password shorter than 6 characters, and mismatched confirm password.

**Contract**: Same render-and-submit pattern. Four test cases:
1. Type invalid email, leave other fields empty, submit → `'Enter a valid email address'` visible
2. Type valid email + 5-character password, submit → `'Password must be at least 6 characters'` visible
3. Type valid email + 6-character password + different confirm, submit → `'Passwords do not match'` visible
4. Submit with all fields empty → `'Email is required'`, `'Password is required'`, `'Please confirm your password'` all visible

Use `userEvent.setup()` + `await user.type(...)` for typing (triggers `onChange` → clears errors correctly); use `fireEvent.submit` for the form submission (synchronous, avoids async timing issues with the `noValidate` form).

### Success Criteria

#### Automated Verification

- `npm run test:run` runs all component test cases (7 cases across both files) and reports 0 failures
- Full suite (phases 2 + 3) passes: `npm run test:run`
- `npm run lint` passes on all new `.test.tsx` files

#### Manual Verification

- `npm test` shows all test files with green checkmarks
- No console errors or warnings about missing DOM context, `useFormStatus`, or missing React imports

**Implementation Note**: After completing this phase and automated verification passes, pause here for manual confirmation before closing this change.

---

## Testing Strategy

### Unit Tests

- `src/lib/supabase.ts` — covered indirectly (mocked in all server-side tests; `createClient` null-return path exercised in every "not configured" case)
- `src/middleware.ts` — unauthenticated redirect
- `src/pages/api/auth/signin.ts` — 2 error branches
- `src/pages/api/auth/signup.ts` — 2 error branches
- `src/pages/api/auth/signout.ts` — null-client branch
- `src/components/auth/SignInForm.tsx` — 3 validation cases
- `src/components/auth/SignUpForm.tsx` — 4 validation cases

### Manual Testing Steps

1. Run `npm run test:run` — confirm all tests pass, no skipped
2. Run `npm test` — confirm watch mode launches without errors

## Performance Considerations

happy-dom is ~3–5× faster than jsdom for small suites. Full test run should complete in under 5 seconds.

## References

- PRD: `context/foundation/prd.md`
- Tech stack: `context/foundation/tech-stack.md`
- Vitest virtual module mocking: https://vitest.dev/guide/mocking#modules

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Infrastructure Setup

#### Automated

- [x] 1.1 `npm install` completes without errors
- [x] 1.2 `npm run test:run` exits 0 (no test files — confirms setup resolves)
- [x] 1.3 `npm run lint` passes on new config files

#### Manual

- [ ] 1.4 `npm test` launches Vitest watch mode showing "No test files found" (not a crash)

### Phase 2: Server-side Unit Tests

#### Automated

- [x] 2.1 `npm run test:run` — all 6 server-side test cases pass, 0 failures
- [x] 2.2 `npm run lint` passes (test files + eslint.config.js clean; pre-existing errors in supabase.ts, middleware.ts, confirm-email.astro are out of scope)

#### Manual

- [ ] 2.3 `npm test` watch mode — no skipped or pending tests

### Phase 3: React Component Tests

#### Automated

- [ ] 3.1 `npm run test:run` — all 7 component test cases pass, 0 failures
- [ ] 3.2 Full suite passes: all phases combined
- [ ] 3.3 `npm run lint` passes on new `.test.tsx` files

#### Manual

- [ ] 3.4 `npm test` — all test files show green checkmarks, no console errors
