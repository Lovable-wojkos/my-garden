---
change_id: testing-data-integrity
title: Phase 3 data integrity — migration review and seed smoke tests
status: impl_reviewed
created: 2026-06-17
updated: 2026-06-22
archived_at: null
---

## Notes

Test-plan Phase 3 rollout for Risk #5: DB migration corrupts existing records.
Deliverables: migration dry-run review script/checklist, post-reset smoke tests against seed data, test-plan cookbook §6.5.
Test types: manual smoke + review script (not Vitest-with-mocks).
Independent of Phase 2 (weather/RLS integration); may reuse Phase 1 `EXPECTED_CATALOG` fixture.
