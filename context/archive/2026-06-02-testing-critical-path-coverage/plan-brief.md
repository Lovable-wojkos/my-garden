# Testing — Critical Path Coverage — Plan Brief

> Full plan: `context/changes/testing-critical-path-coverage/plan.md`

## What & Why

The Garden Management App has zero tests and no test framework installed. Before any garden-domain features are built on top of the auth scaffolding, the auth critical path needs coverage to prevent regressions. This change installs Vitest and writes the first test suite targeting the code that is most valuable and most testable today.

## Starting Point

Three auth API route handlers (`signin`, `signup`, `signout`), an auth middleware guard, and two React form components with non-trivial validation logic exist — all written, all untested. No `vitest`, no `@testing-library`, no `npm test` script.

## Desired End State

`npm test` runs a Vitest suite. All tests are green. The suite covers the middleware unauthenticated-redirect path, the error-branch redirects in each API route handler, and the validation edge cases in both auth form components (empty fields, invalid email format, boundary password length, password mismatch).

## Key Decisions Made

| Decision                  | Choice                                | Why (1 sentence)                                                                                      |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Test framework            | Vitest                                | Astro 6 uses Vite internally — Vitest reuses Vite's transform pipeline with zero extra config.        |
| DOM environment           | happy-dom                             | 3–5× faster than jsdom; sufficient for form validation and DOM querying.                              |
| React testing layer       | @testing-library/react + userEvent    | Standard ecosystem choice; tests behaviour through the DOM, not implementation details.               |
| Virtual module mocking    | `resolve.alias` in `vitest.config.ts` | `vi.mock()` cannot intercept Astro virtual modules reliably; a shared alias mock file is more stable. |
| Separate vitest.config.ts | Yes (not extending astro.config.mjs)  | `@astrojs/react` and `@vitejs/plugin-react` conflict when the same Vite config is shared.             |
| API route test scope      | Error branches only (no happy path)   | Auth success paths require real Supabase sessions; error branches are fully unit-testable.            |
| CI integration            | Out of scope                          | Left as a follow-up change to keep this change focused on the test suite itself.                      |

## Scope

**In scope:**

- Vitest + @testing-library/react installation and configuration
- Virtual module mock (`astro:env/server`, `astro:middleware`)
- Middleware: unauthenticated redirect to `/dashboard`
- API routes: error-branch redirects for signin, signup, signout
- React forms: validation error cases for `SignInForm` and `SignUpForm`

**Out of scope:**

- Happy-path API route tests (Supabase success flows)
- Authenticated-user middleware branch
- `cn()` utility, `configStatuses`, Astro page components
- Coverage reporting or thresholds
- CI pipeline integration

## Architecture / Approach

A separate `vitest.config.ts` (root) uses `@vitejs/plugin-react`, `happy-dom`, and `resolve.alias` entries that redirect `astro:env/server` and `astro:middleware` imports to a single mock file at `src/test/mocks/astro-virtual.ts`. A shared setup file at `src/test/setup.ts` imports `@testing-library/jest-dom` (augments matchers) and registers `cleanup()` after each test. Server-side tests mock `@/lib/supabase` per-test via `vi.mock()`; component tests need no mocking — they exercise validation purely through the DOM.

## Phases at a Glance

| Phase                     | What it delivers                                                    | Key risk                                                    |
| ------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Test Infrastructure    | Vitest configured, `npm test` works, virtual module aliases resolve | `@vitejs/plugin-react` version mismatch with React 19       |
| 2. Server-side Unit Tests | 6 test cases covering middleware + API route error branches         | Astro `APIContext` mock shape may diverge from real type    |
| 3. React Component Tests  | 7 test cases covering form validation edge cases                    | `useFormStatus` (React 19) behaves differently in happy-dom |

**Prerequisites:** Node.js v22.14.0 (see `.nvmrc`); no Supabase credentials required (all mocked)
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- `useFormStatus` from `react-dom` is a React 19 hook — happy-dom + @testing-library/react@16 should support it, but if it causes issues the `SubmitButton` can be mocked at the component level
- Vitest's happy-dom does not support all browser APIs; if a tested component uses an unsupported API the test will fail with an unexpected error (mitigated by the narrow scope — only form validation logic is exercised)

## Success Criteria (Summary)

- `npm run test:run` exits 0 with all 13 test cases (6 server-side + 7 component) green
- `npm run lint` passes on all new test and config files
- `npm test` launches Vitest watch mode without errors
