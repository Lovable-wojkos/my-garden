---
change_id: imgw-weather-probe
title: "S-01: IMGW weather probe — region selection + weather display"
status: archived
created: 2026-05-26
updated: 2026-06-08
archived_at: 2026-06-08T10:58:11Z
---

## Notes

S-01 from `context/foundation/roadmap.md`. North-star slice: validates that a weather API can deliver current temperature, 7-day rainfall, and last-rain date for Polish gmina-level locations.

Key discovery during planning: IMGW public REST API is current-snapshot only (no historical time series). Open-Meteo (free, uses IMGW data for Poland, full historical API) is used instead for all three weather requirements.
