<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Nightly Weather Job Scaffold Implementation Plan

- **Plan**: context/changes/nightly-weather-job-scaffold/plan.md
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: REVISE
- **Findings**: 2 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | FAIL |

## Grounding
Grounding: 4/4 paths ✓, brief↔plan ✓

## Findings

### F1 — HTTP Method Mismatch for Vercel Cron

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Cron API route
- **Detail**: The plan defines the cron route handler as `export async function POST(context: APIContext)` but Vercel Cron jobs trigger endpoints using `GET` requests. If implemented as POST, Vercel will receive a 405 Method Not Allowed error, and the cron will fail.
- **Fix**: Change the exported handler from `POST` to `GET`.
- **Decision**: FIXED (Fix in plan)

### F2 — Insecure Cron Authentication

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Cron API route / What We're NOT Doing
- **Detail**: The plan relies solely on checking the `x-vercel-cron` header for authentication and explicitly states "No CRON_SECRET env var". As noted in the `vercel-cron.md` research, Vercel cron endpoints should validate the `Authorization: Bearer <secret>` header using `CRON_SECRET` to prevent unauthorized execution.
- **Fix**: Require `CRON_SECRET` validation instead of `x-vercel-cron` header. Update `astro.config.mjs` to include `CRON_SECRET` and remove the explicit rejection of it in the "What We're NOT Doing" section.
- **Decision**: PENDING
