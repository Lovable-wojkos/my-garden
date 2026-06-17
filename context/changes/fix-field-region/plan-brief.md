# Fix Field Region — Plan Brief

> Full plan: `context/changes/fix-field-region/plan.md`
> Research: `context/changes/fix-field-region/research.md`

## What & Why

The app has two disconnected location systems — voivodeship dropdown on field create and Open-Meteo city search in the weather widget — but the PRD assumes one garden location per user. This change unifies them: **region = the geocoded place chosen in WeatherWidget**, stored in a shared `regions` catalog, linked to user preferences and all fields, with historical weather cached per region via nightly cron.

## Starting Point

Today, `regions` holds 16 seeded Polish voivodeships with no coordinates. Field creation requires picking one via a combobox unrelated to the widget. `WeatherWidget` saves raw lat/lng to `user_preferences` without touching `regions`. The nightly cron dedupes by user coordinates and writes `weather_records` with `region_id: null`. Live weather always hits Open-Meteo directly.

## Desired End State

A user with no location sees a full-screen weather widget on the dashboard. After picking a city, the page reloads to the normal dashboard. Creating a field requires no region picker — the server assigns `region_id` from preferences. Changing city updates preferences and all fields. Cron caches historical weather once per shared geocoded region. Live widget weather stays on Open-Meteo.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Region identity | Open-Meteo geocoded place (city + exact lat/lng) | Matches S-01 coordinate precision; replaces voivodeship semantics | Research |
| Dedup key | Exact `latitude` + `longitude` (`numeric(9,6)`) | Shared catalog across users; no rounding | Research |
| Live weather cache | None — keep Open-Meteo for current data | Widget freshness; `weather_records` is historical-only | Research |
| Prefs shape | Keep city_name + lat/lng **and** add region_id | Widget live fetch needs no join; region_id is the canonical link | Plan |
| No-region UX | Full-screen widget on dashboard; auto-reload after pick | Forces location before fields; cleaner than disabled form | Plan |
| Field create gate | Redirect `/fields/new` → dashboard when no region | Belt-and-suspenders alongside dashboard gating | Plan |
| Existing dev data | Truncate fields + weather_records; drop voivodeship seed | Simplest MVP path; no voivodeship→geocode mapping | Plan |
| Orphan regions | Keep indefinitely | Harmless growth; periodic cleanup deferred to roadmap | Plan |
| Region change | Allowed anytime; updates prefs + all user fields | User may move garden location | Research |

## Scope

**In scope:**
- Reshape `regions` table (lat/lng/display_name, drop voivodeship seed)
- Add `user_preferences.region_id` FK
- `findOrCreateRegion` + wire into `POST /api/user-preferences`
- Bulk-update user fields on city change
- Cron writes `weather_records.region_id` per distinct region
- Remove region picker from field create; server-assign region
- Dashboard full-screen gating + `/fields/new` redirect
- Unit tests for upsert, field propagation, cron, field create

**Out of scope:**
- Live weather DB cache
- Blending widget rainfall with historical records
- Orphan region periodic cleanup (roadmap parked item)
- Voivodeship→geocode data migration
- E2E Playwright tests

## Architecture / Approach

```
WeatherWidget city pick
  → findOrCreateRegion(exact lat/lng)
  → user_preferences.region_id = regions.id
  → UPDATE all user fields SET region_id
  → (gating mode) page reload

Field create POST
  → read user_preferences.region_id
  → 400 if null; else create field with that region_id

Nightly cron
  → FOR EACH distinct regions row
  → getDailyWeather(lat, lng)
  → UPSERT weather_records(region_id, recorded_at, ...)
```

Live `/api/weather` path unchanged throughout.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Schema + region upsert | Geocoded regions catalog; prefs linked; fields updated on city change | Migration truncate loses dev fields; RLS INSERT on regions |
| 2. Cron → regions | Historical cache keyed by region_id; fewer duplicate fetches | Upsert conflict key switch (coord → region_id) |
| 3. Field create + gating | No region picker; dashboard full-screen widget; redirect guard | Reload timing after first city pick |

**Prerequisites:** Local Supabase (Docker) for migration verify; existing Open-Meteo integration from S-01/F-02.

**Estimated effort:** ~2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Dev data loss on migration is acceptable (fields/weather_records truncated).
- Authenticated INSERT on `regions` is sufficient; no rate-limiting on catalog growth for MVP.
- Field counts per user are small enough for synchronous bulk UPDATE on city change.
- `reloadOnSelect` prop cleanly separates dashboard gating from field-detail widget embed.

## Success Criteria (Summary)

- One location concept: widget city = field region = cron cache key.
- New user must pick city before seeing fields or creating a field.
- Two users at same coordinates share one `regions` row and one cron fetch.
- All automated tests and CI gates pass.
