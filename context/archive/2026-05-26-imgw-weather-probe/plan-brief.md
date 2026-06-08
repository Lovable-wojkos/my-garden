# IMGW Weather Probe — Plan Brief

> Full plan: `context/changes/imgw-weather-probe/plan.md`

## What & Why

Build a weather widget on the dashboard (S-01) so users can see current temperature, 7-day cumulative rainfall, and the date of last rain for their Polish location. This is the north-star slice: it validates the weather data layer before any dependent feature (F-02, S-03, S-04) is built. IMGW's public API turned out to be current-snapshot only — Open-Meteo (free, IMGW-sourced, full historical REST API) is used instead.

## Starting Point

F-01 is fully complete: six DB tables with RLS, TypeScript types, and service scaffolds exist. No external HTTP client exists in the codebase. The `regions` table has 16 voivodeships but gmina-level precision (~2500 municipalities) requires coordinate-based queries — voivodeship granularity is too coarse for meaningful weather correlation.

## Desired End State

A logged-in user on `/dashboard` types a Polish city/gmina name, picks from geocoded suggestions, and sees a weather card: current °C, 7-day rainfall in mm, and last rain date. The city preference is saved to the DB so weather loads automatically on every subsequent visit. On API failure the widget shows the last fetched result with a "dane z HH:MM" stale badge.

## Key Decisions Made

| Decision            | Choice                       | Why (1 sentence)                                                                                  |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Weather API         | Open-Meteo only              | IMGW REST is current-snapshot; Open-Meteo covers all three requirements with a single integration |
| Region granularity  | Gmina-level coordinates      | Poland has ~2500 gminas; voivodeship dropdown is too coarse for real weather correlation          |
| Region selection UX | Free-text city + geocoding   | Matches gmina-level need; Open-Meteo has a free geocoding API (no extra dependency)               |
| Widget placement    | Dashboard widget             | Aligns with S-04 goal; weather visible alongside field data                                       |
| API failure UX      | In-memory stale badge        | User always sees something; persistent caching belongs to F-02                                    |
| Region persistence  | DB (user_preferences table)  | City preference must survive page refresh and device switches                                     |
| F-01 dependency     | Wait for F-01                | F-01 is done; no workarounds needed                                                               |
| Weather refresh     | Auto every 30 min + on mount | Open-Meteo updates hourly; 30-min polling is a reasonable freshness/cost balance                  |

## Scope

**In scope:**

- `user_preferences` DB table (city_name, latitude, longitude per user)
- Open-Meteo HTTP client service (geocoding + weather fetch)
- `/api/weather`, `/api/user-preferences`, `/api/geocoding-suggestions` API routes
- `WeatherWidget` React island: city search, suggestions, weather card, stale badge, 30-min refresh
- Dashboard page integration with server-side preferences load

**Out of scope:**

- IMGW direct integration
- Server-side weather caching (F-02)
- Nightly cron job (F-02)
- `weather_records` DB writes (F-02)
- Watering recommendations (S-03 dependency)
- Multiple locations per user

## Architecture / Approach

Three-tier: (1) Open-Meteo HTTP client in `src/lib/services/open-meteo.ts` — all external calls centralized here. (2) Three thin Astro API routes that validate input, call services, return JSON. (3) A React island (`WeatherWidget`) that orchestrates city search, weather fetch, and 30-min refresh via `setInterval`. The dashboard page pre-loads the user's saved preference server-side and passes it as a prop so the widget renders with data on first paint.

## Phases at a Glance

| Phase                         | What it delivers                                                      | Key risk                                                           |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. User Preferences Migration | `user_preferences` table + TypeScript types + service wrappers        | None — straightforward schema addition                             |
| 2. Open-Meteo HTTP Client     | `geocodeCity` + `getWeather` service functions                        | Open-Meteo API response shape changes (unlikely but unversioned)   |
| 3. API Routes                 | `/api/weather`, `/api/user-preferences`, `/api/geocoding-suggestions` | Auth guard misconfiguration leaks unauthenticated access           |
| 4. Weather Widget + Dashboard | Full end-to-end UI, 30-min refresh, stale badge                       | Geocoding suggestion UX on mobile — small targets, debounce timing |

**Prerequisites:** F-01 deployed (done); Supabase project accessible for `db push`
**Estimated effort:** ~1-2 sessions across 4 phases

## Open Risks & Assumptions

- Open-Meteo `past_days=7` returns daily precipitation arrays — the implementer must sum all values for the 7-day total and scan from the end for the last non-zero day.
- Open-Meteo has no published SLA — if it degrades, the stale badge buys time but there's no fallback API in scope for S-01.
- The `user_preferences` table stores lat/lng as `numeric(9,6)` — sufficient precision for Polish coordinates.

## Success Criteria (Summary)

- User types "Kraków", selects the suggestion, sees temperature + 7-day rainfall + last rain date — all three values present
- Refresh the page — widget loads Kraków automatically (no re-entry)
- Supabase `user_preferences` table contains one row per user with the chosen city coordinates
