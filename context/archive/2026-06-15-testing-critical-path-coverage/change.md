---
change_id: testing-critical-path-coverage
title: Phase 1 critical-path coverage for auth, catalog, and harvest dates
status: archived
created: 2026-06-15
updated: 2026-06-17
archived_at: 2026-06-17T00:00:00Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical-path coverage".
Risks covered: #1 Auth regression blocks garden access, #2 Plant catalog silently incomplete, #6 Incorrect harvest date calculation.
Test types planned: unit + integration.
Risk response intent:
- #1: prove authenticated access to own resources works while unauthenticated/unauthorized access is denied.
- #2: prove catalog completeness and correct plant attributes used in estimates.
- #6: prove harvest date calculation follows seeding date + growth period mapping.
After creating the folder, follow the downstream continuation rule.
