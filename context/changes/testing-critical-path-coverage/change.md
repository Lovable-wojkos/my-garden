---
change_id: testing-critical-path-coverage
title: Bootstrap Vitest and add critical-path tests for auth, catalog, and harvest date
status: new
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical-path coverage".
Risks covered: #1 (auth regression blocks garden access), #2 (plant catalog silently incomplete), #6 (incorrect harvest date calculation). Test types planned: unit + integration.
Risk response intent:
- Risk #1: Prove authenticated user's request to own resource returns 200; unauthenticated request returns 401/redirect; another user's resource returns 403/404.
- Risk #2: Prove plant catalog endpoint returns all expected entries; harvest date calc uses correct growth category.
- Risk #6: Prove harvest date = seeding date + growth period produces correct estimated date.
After creating the folder, follow the downstream continuation rule.
