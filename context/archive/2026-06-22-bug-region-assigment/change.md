---
change_id: bug-region-assigment
title: Bug region assigment
status: archived
created: 2026-06-22
updated: 2026-06-22
archived_at: 2026-06-22T12:00:00Z
---

## Notes

Suspect incorrect region assignment during region edit after switching between Warszawa and Ogony. Observed heavy rain on the ground vs low widget values (14 mm / 0.3 mm yesterday). Expected: user picks region → stored in DB → cron fetches weather; regions shared across users; region change creates/links new region row with lat/lng.
