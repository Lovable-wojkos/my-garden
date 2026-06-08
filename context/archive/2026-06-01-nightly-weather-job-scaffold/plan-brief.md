# Nightly Weather Job Scaffold — Plan Brief

> Full plan: `context/changes/nightly-weather-job-scaffold/plan.md`

## What & Why

Create a Vercel Cron job (F-02) that fetches Open-Meteo weather data nightly for every active user's saved coordinates and stores daily temperature + precipitation records in the database. This enables `S-04 Field Weather View` to display historical 7-day rainfall and last-rain date from stored data rather than live-fetched aggregation. FR-007 requires automatic nightly weather pulls; this is the infrastructure that makes it happen.

## Starting Point

F-01 is complete — `weather_records` table exists with columns for region-based storage and a unique index for cron dedup. S-01 is plan-reviewed but not implemented — no `open-meteo.ts` service exists yet. The table is region-keyed (16 voivodeships), but the weather probe settled on coordinate-level (gmina) precision. No `vercel.json`, no service-role Supabase client, and no background job infrastructure exist.

## Desired End State

A cron job runs nightly (midnight UTC), queries `user_preferences` for all unique coordinates, fetches daily weather from Open-Meteo via the shared service layer, and upserts records into `weather_records` with lat/lng. The first run backfills 7 days of history. The S-01 weather widget and S-04 field weather view can query `weather_records` by coordinates to show historical rainfall data alongside live current weather.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Open-Meteo service ownership | F-02 creates the shared service | S-01 is plan-reviewed but unimplemented; F-02 creates `open-meteo.ts` with `getWeather` (for S-01 widget) + `getDailyWeather` (for cron) + `geocodeCity` (for S-01), unblocking both | Plan |
| Weather storage granularity | Extend `weather_records` with lat/lng columns | Aligns with S-01 coordinate precision; single table for both region and coordinate data | Plan |
| Runtime | Vercel Cron Jobs | Native to stack, uses existing `@astrojs/vercel` adapter, no new infra | Plan |
| Auth for cron endpoint | `x-vercel-cron` header check only | No extra secrets; Vercel adds the header automatically on cron-triggered requests | Plan |
| Fetch targets | Only `user_preferences` coordinates | No region centroid fallback; fetches only what real users need | Plan |
| Middleware | Exclude `/api/cron` from `PROTECTED_ROUTES` | Cron route authenticates itself via the Vercel cron header | Plan |
| Error handling | Log per-location, continue | Simplest approach; no alerting in MVP scope | Plan |
| Backfill | Fetch 7 `past_days` on every run | Open-Meteo returns past 7 days naturally; upsert handles dedup — no separate first-run logic | Plan |
| Phase structure | 3 phases: schema, service, cron | Each phase independently testable; clean separation of concerns | Plan |
| Route path | `POST /api/cron/weather` | Dedicated cron directory; extensible for future cron jobs | Plan |

## Scope

**In scope:**
- Migration: add lat/lng to `weather_records`, make `region_id` nullable, coordinate dedup index
- Update TypeScript types and `weather.ts` helpers for coordinate queries
- Create `src/lib/services/open-meteo.ts` (shared service: `getWeather`, `getDailyWeather`, `geocodeCity`)
- Add `SUPABASE_SERVICE_ROLE_KEY` env var to `astro.config.mjs`
- Create service-role Supabase client factory in `src/lib/supabase.ts`
- Create `src/pages/api/cron/weather.ts` (Vercel CRON header check, coordinate fetch, upsert)
- Create `vercel.json` with cron schedule
- Add middleware comment excluding `/api/cron`

**Out of scope:**
- S-01 implementation (weather widget UI, API routes, user_preferences table — those are separate)
- Region-based fallback fetching
- Alerting or monitoring on cron failure
- Weather data for unfilled locations
- Deletion or migration of existing region-based rows

## Architecture / Approach

Three-tier: (1) **Schema** — extend `weather_records` with coordinate columns and unique index. (2) **Service** — shared `open-meteo.ts` wraps Open-Meteo API calls, exporting aggregate (`getWeather`) and daily (`getDailyWeather`) variants plus `geocodeCity`. (3) **Cron** — `POST /api/cron/weather` endpoint validates the Vercel CRON header, creates a service-role Supabase client, queries `user_preferences` for coordinates, loops through each coordinate calling `getDailyWeather`, and upserts daily records into `weather_records`. The `vercel.json` file schedules nightly invocation.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema Migration | lat/lng columns, nullable region_id, coordinate dedup index, updated types + helpers | Existing region-based rows unaffected; no data migration needed |
| 2. Open-Meteo Service | Shared `open-meteo.ts` with `getWeather`, `getDailyWeather`, `geocodeCity` | Open-Meteo response shape changes (unlikely but unversioned) |
| 3. Cron Job | `vercel.json` + cron route + service-role client + env vars | `SUPABASE_SERVICE_ROLE_KEY` must be configured in Vercel before deploy; cron testable only on deployment |

**Prerequisites:** F-01 deployed (done); S-01 plan reviewed (service contract settled)
**Estimated effort:** ~2 sessions across 3 phases

## Open Risks & Assumptions

- `user_preferences` table must exist and be populated before the cron job has coordinates to fetch — this is S-01's job. If S-01 is not implemented when F-02 deploys, the cron runs successfully but fetches zero coordinates until users set preferences.
- `SUPABASE_SERVICE_ROLE_KEY` is a new secret. It must be configured in Vercel environment variables before the cron endpoint can write to `weather_records`. Local dev without this key returns a 500 error from the cron route.
- Open-Meteo has no published SLA. If it degrades, the cron logs errors but has no fallback data source.
- Vercel hobby tier limits cron jobs to 1 invocation/day — sufficient for nightly pull. If more frequent polling is needed later, the runtime must change.

## Success Criteria (Summary)

- Nightly cron run creates daily `weather_records` rows for every coordinate in `user_preferences`
- Duplicate cron invocations do not create duplicate rows (unique index enforcement)
- Running without `x-vercel-cron` header returns 401
- `getDailyWeather` and `getWeather` return consistent data (aggregate matches sum of daily records)
