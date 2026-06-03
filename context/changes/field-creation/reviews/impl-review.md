<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Field Creation Implementation Plan

- **Plan**: `context/changes/field-creation/plan.md`
- **Scope**: Phases 1-4 of 4
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | FAIL |

## Findings

### F1 — Region combobox trigger can submit the form accidentally

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/fields/CreateFieldForm.tsx:130`
- **Detail**: The region selector trigger is a `Button` inside the form without `type="button"`. Native buttons default to submit, so opening the combobox can trigger an unintended submit before the user has finished the form.
- **Fix**: Add `type="button"` to the combobox trigger.
- **Decision**: PENDING

### F2 — API exposes raw database errors to the browser

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/fields/index.ts:60`
- **Detail**: The API returns `error.message` from Supabase directly to the client on insert failure. That leaks internal constraint details and makes expected user mistakes, such as an unknown `region_id`, surface as opaque server errors instead of controlled validation feedback.
- **Fix**: Catch expected insert failures and map them to a `400` field error; return a generic `500` for unexpected failures while keeping the raw error server-side.
  - **Strength**: Preserves the current route shape while removing internal error leakage.
  - **Tradeoff**: Requires deciding which database failures are safe to classify as client errors.
  - **Confidence**: HIGH — the current code already separates parse/validation failures from insert failures, so this is a targeted extension.
  - **Blind spot**: I did not verify the exact Supabase error codes emitted for every foreign-key failure mode.
- **Decision**: PENDING

### F3 — Field pages hide backend failures behind normal-looking fallbacks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/dashboard/fields/new.astro:9`, `src/pages/dashboard/fields/[id].astro:10`
- **Detail**: Both pages ignore the service-layer `error` result. If the regions query fails, the new-field page silently renders an empty selector. If the detail query fails, the detail page redirects to `/dashboard`, making an outage indistinguishable from a missing field.
- **Fix**: Handle `{ data, error }` explicitly and render an error state or failure response instead of silently falling back.
  - **Strength**: Makes real backend failures observable and easier to diagnose.
  - **Tradeoff**: Introduces a user-facing error path the current pages do not yet design for.
  - **Confidence**: HIGH — both pages currently discard `error`, so the failure mode is directly visible in code.
  - **Blind spot**: I did not inspect whether the app already has a shared dashboard-level error presentation pattern to reuse.
- **Decision**: PENDING

### F4 — A global ESLint parser override was introduced outside the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: `eslint.config.js:62`
- **Detail**: The implementation added a repo-wide Astro ESLint override (`@typescript-eslint/no-misused-promises: "off"`) with a comment about `return` inside `.astro` frontmatter. That is a cross-cutting tooling change with effects beyond field creation, but the plan only called for feature files and component dependencies.
- **Fix A ⭐ Recommended**: Update the plan with an addendum that documents the tooling change and why the placeholder page required it.
  - **Strength**: Keeps the implementation intact while restoring the plan as the source of truth for future reviews.
  - **Tradeoff**: Accepts broader scope after the fact instead of reining it back in.
  - **Confidence**: HIGH — the config change is present and directly tied to a field-creation page pattern.
  - **Blind spot**: I did not verify whether another Astro-safe implementation could have avoided the override entirely.
- **Fix B**: Rework the page logic to avoid the parser edge case, then remove the global override.
  - **Strength**: Restores strict scope and avoids a repo-wide lint rule exception.
  - **Tradeoff**: Higher effort and some uncertainty because the parser limitation may still require a workaround elsewhere.
  - **Confidence**: MEDIUM — feasible in principle, but not proven against this parser behavior in this repo.
  - **Blind spot**: I did not test alternative page-control-flow structures.
- **Decision**: PENDING

### F5 — Recorded success criteria do not match the current observable state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `context/changes/field-creation/plan.md:187`
- **Detail**: The progress block still contains unresolved merge markers in Phase 2, and `npm run lint` currently fails despite Phase 2 and Phase 3 being marked complete. The failing command reports project-service parsing errors in `.opencode/plugins/*.ts` plus Prettier line-ending errors in tracked files including `CreateFieldForm.tsx`, `astro.config.mjs`, and `eslint.config.js`. `npm run build` does pass.
- **Fix**: Resolve the merge conflict in `## Progress`, then re-run and reconcile the automated checklist so only verifiable passing items remain checked.
  - **Strength**: Restores a trustworthy review surface and aligns the plan with the actual repo state.
  - **Tradeoff**: May require deciding which lint failures belong to this change versus the wider branch.
  - **Confidence**: HIGH — both the merge markers and the failing lint output are directly observable.
  - **Blind spot**: I did not bisect whether every lint failure was introduced by the field-creation commits themselves.
- **Decision**: PENDING

### F6 — Generated UI primitives drift from this Astro repo’s client-component pattern

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/ui/popover.tsx:1`, `src/components/ui/command.tsx:1`
- **Detail**: The new shadcn primitives add `"use client"` directives and bring in `src/components/ui/dialog.tsx` as a supporting dependency. The feature still works, but these files are the only UI primitives in the repo using Next.js-style directives, which conflicts with the project’s Astro guidance.
- **Fix**: Remove the directives if they are unnecessary here, or document the exception in the plan if the generated components truly require them.
- **Decision**: PENDING
