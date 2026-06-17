---
change_id: fix-field-region
title: Unify field region with widget location and weather cache
status: implemented
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

All user fields share one garden location. Region = Open-Meteo location chosen in WeatherWidget (not a voivodeship list).

- `regions`: shared catalog of geocoded places; dedupe on **exact** Open-Meteo lat/lng; shared across users.
- `weather_records`: **historical only** (nightly cron); reduces duplicate Open-Meteo fetches per region.
- **No live/current weather cache** — widget keeps calling Open-Meteo for current data.
- Field create: auto-use `user_preferences.region_id`; no region picker.
- User **can change city** after fields exist → update prefs + all user's fields to new `region_id`.
