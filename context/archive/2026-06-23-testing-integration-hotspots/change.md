---
change_id: testing-integration-hotspots
title: Integration tests for weather sync and RLS data boundaries
status: archived
created: 2026-06-23
updated: 2026-06-24
planned: 2026-06-23
archived_at: 2026-06-24T00:00:00Z
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Integration around hot-spots".
Risks covered: #3 (Weather sync breaks silently), #4 (IDOR on field/planting data). Test types planned: integration (Supabase local).
Risk response intent:
- Risk #3: prove weather fetch returns expected fields, stale data is flagged, and failed fetch does not corrupt existing records; challenge that HTTP 200 means correct data was stored; avoid over-mocking the external API.
- Risk #4: prove User A cannot read or modify User B's fields/plantings; harden plantings INSERT RLS so User A cannot plant on B's field; use real cookie/session shape with Supabase local.
