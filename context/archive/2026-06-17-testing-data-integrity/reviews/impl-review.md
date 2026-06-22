<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phase 3 Data Integrity

- **Plan**: context/changes/testing-data-integrity/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-22
- **Verdict**: NEEDS ATTENTION (triage complete — all findings resolved)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — db-smoke.mjs imports .ts fixtures via plain node — runtime failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: scripts/db-smoke.mjs:6-7
- **Detail**: Dynamic import of `.ts` fixture files in a plain `node` script throws ERR_UNKNOWN_FILE_EXTENSION on Node 22.14 without `--experimental-strip-types`. `npm run db:smoke` and `db:verify` were non-functional as shipped.
- **Fix A ⭐ Applied**: Changed `"db:smoke": "tsx scripts/db-smoke.mjs"` in package.json. tsx is a transitive devDep via vitest — no new deps required.
- **Decision**: FIXED via Fix A

### F2 — migration-review.mjs regex misses standard ALTER TABLE … ALTER COLUMN form

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: scripts/migration-review.mjs:40, 50
- **Detail**: Both regexes anchored at line start (`^\s*`) only matched multi-line SQL form. Standard `ALTER TABLE foo ALTER COLUMN bar DROP NOT NULL` was silently skipped. Confirmed: migration 20260601 used the single-line form and was never detected by the tool. Fixing the regexes also revealed two unacknowledged DROP COLUMN statements in 20260617120000_reshape_regions_geocoded.sql.
- **Fix**: Removed `^\s*` anchor from both patterns → `/\bALTER\s+COLUMN\s+\w+\s+DROP\s+NOT\s+NULL\b/i` and `/\bDROP\s+COLUMN\b/i`. Added acknowledgment comments to 20260617120000_reshape_regions_geocoded.sql:10-11. db:review exits 0 confirmed.
- **Decision**: FIXED

### F3 — no-console not suppressed in scriptsConfig

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: eslint.config.js (scriptsConfig block)
- **Detail**: Base config sets `"no-console": "warn"`; scriptsConfig didn't override it. 25+ console calls in db-smoke.mjs generated lint warnings.
- **Fix**: Added `"no-console": "off"` to scriptsConfig.rules.
- **Decision**: FIXED
