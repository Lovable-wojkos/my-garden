---
change_id: testing-critical-path-coverage
title: Testing - Critical Path Coverage
status: archived
created: 2026-06-02
updated: 2026-06-03
archived_at: 2026-06-03T11:28:05Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical-path coverage".
Risks covered: #1 (auth regression blocks garden access), #2 (plant catalog silently incomplete), #6 (incorrect harvest date calculation). Test types planned: unit + integration.
Risk response intent:
- Risk #1: Prove authenticated user's request to own resource returns 200; unauthenticated request returns 401/redirect; another user's resource returns 403/404.
- Risk #2: Prove plant catalog endpoint returns all expected entries; harvest date calc uses correct growth category.
- Risk #6: Prove harvest date = seeding date + growth period produces correct estimated date.
Establish Vitest test coverage for the auth critical path (middleware, API route error branches) and React form validation logic. Zero tests exist today; this change installs the test framework and writes the first suite.
