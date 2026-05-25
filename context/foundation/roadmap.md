---
project: Garden Management App
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-25
prd_version: 1
main_goal: market-feedback
top_blocker: external
---

# Roadmap: Garden Management App

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A garden management app that replaces paper notebooks with digital tracking for home gardeners and small-scale farmers. The core value is correlating weather data with planting history so a user can answer "should I drive out to water today?" without guessing. Data loss prevention and weather context are the two pillars; everything else is secondary.

## North star

**S-01: użytkownik widzi aktualne dane pogodowe dla wybranego regionu** — the smallest end-to-end slice that proves the core product hypothesis: that IMGW API can deliver the weather context this product depends on.

> "Gwiazda przewodnia" (north star) here means the smallest end-to-end flow whose successful delivery proves that the riskiest product assumption is true — placed first because everything else only matters if this works. Here the assumption is: IMGW API is usable and returns the data FR-006–FR-010 require.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | db-schema-and-migrations | (foundation) schema for fields, plants catalog, plantings, and weather_records in place | — | FR-001, FR-002, FR-003, FR-005, FR-006, FR-007, FR-011, FR-014, FR-015 | ready |
| S-01 | imgw-weather-probe | select a region and see current weather, 7-day rainfall, and last-rain date | — | FR-006, FR-008, FR-009, FR-010 | blocked |
| F-02 | nightly-weather-job-scaffold | (foundation) Vercel Cron job fetches IMGW data nightly and stores records in weather_records | F-01 | FR-007 | proposed |
| S-02 | field-creation | add a field with columns-and-rows layout | F-01 | FR-001, FR-002 | proposed |
| S-05 | plant-catalog-requests | request a new plant type; admin approves and it appears in the catalog | F-01 | FR-014, FR-015 | proposed |
| S-03 | planting-record | assign plants to field cells, set seeding date, and see auto-calculated harvest date | F-01, S-02 | FR-003, FR-005, FR-011 | proposed |
| S-04 | field-weather-view | view full field with planting details and live weather panel (current weather + 7-day rain + last rain) | S-01, S-03, F-02 | FR-006, FR-008, FR-009, FR-010, US-01 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Data foundation + field lifecycle | `F-01` → `F-02` → `S-02` → `S-03` → `S-04` | Core must-have path; S-04 is where main_goal (market-feedback) gets its first real user. |
| B | IMGW probe (north star) | `S-01` → `S-04` | Validates the riskiest external dependency first; joins Stream A at `S-04`. |
| C | Plant catalog admin | `F-01` → `S-05` | Standalone admin flow; parallel with S-02 once F-01 lands. |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands + Tailwind 4 + shadcn/ui; pages at `src/pages/`, components at `src/components/ui/`
- **Backend / API:** partial — auth API routes present (`src/pages/api/auth/`); no business-domain API routes, no background jobs or cron handlers
- **Data:** partial — Supabase client wired (`src/lib/supabase.ts`); `supabase/migrations/` directory exists but is empty; no schema, no seeds
- **Auth:** present — Supabase SSR magic-link flow; middleware guards `/dashboard` (`src/middleware.ts:6–22`)
- **Deploy / infra:** partial — GitHub Actions CI present (`.github/workflows/ci.yml`); no `vercel.json`, no Dockerfile
- **Observability:** absent — no logging, error tracking, or monitoring anywhere

## Foundations

### F-01: Database schema and migrations

- **Outcome:** (foundation) Supabase migrations in place for `fields`, `plants` (catalog), `plantings`, and `weather_records` tables with RLS policies; all data-dependent slices can be planned and implemented.
- **Change ID:** db-schema-and-migrations
- **PRD refs:** FR-001, FR-002, FR-003, FR-005, FR-006, FR-007, FR-011, FR-014, FR-015
- **Unlocks:** S-02 (field creation), S-03 (planting record), S-04 (field weather view), S-05 (plant catalog requests), F-02 (weather_records table needed by nightly job)
- **Prerequisites:** —
- **Parallel with:** S-01 (probe has no DB dependency)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** If the schema is under-specified (missing columns for plant growth times or region mapping), downstream slices will require migration corrections — worth designing carefully before S-02/S-03.
- **Status:** ready

### F-02: Nightly weather job scaffold

- **Outcome:** (foundation) Vercel Cron function fetches IMGW data for all active user regions nightly and writes records to `weather_records`; historical rainfall queries are now possible.
- **Change ID:** nightly-weather-job-scaffold
- **PRD refs:** FR-007
- **Unlocks:** S-04 (7-day historical rainfall display requires stored records)
- **Prerequisites:** F-01 (weather_records table), S-01 (IMGW API integration code reused or validated by probe)
- **Parallel with:** S-02, S-05
- **Blockers:** —
- **Unknowns:**
  - Which runtime for the cron job — Vercel Cron (hobby plan has limits) vs Supabase Edge Function scheduled trigger? Owner: dev. Block: no (decision can be made at /10x-plan time).
- **Risk:** Vercel Cron on hobby tier is limited to 1 invocation/day — sufficient for nightly pull; if frequency needs to increase, runner must change.
- **Status:** proposed

## Slices

### S-01: IMGW weather probe

- **Outcome:** user can select a Polish region and immediately see current temperature, rainfall in mm for the last 7 days, and the date of last rain
- **Change ID:** imgw-weather-probe
- **PRD refs:** FR-006, FR-008, FR-009, FR-010
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - What endpoints does IMGW API expose? What is the data format, auth method, and rate limits? Owner: dev. Block: yes.
  - Does IMGW provide current weather (FR-008) or only historical measurements? Owner: dev. Block: yes.
- **Risk:** IMGW is a Polish government meteorological service (`top_blocker: external`). If its API structure does not match FR-006–FR-010 assumptions, the weather layer requires redesign (alternative: open-meteo.com as fallback). Sequenced first so this risk surfaces before any dependent slice is built.
- **Status:** blocked

### S-02: Field creation

- **Outcome:** user can add a named field to their garden and define its layout using a columns-and-rows grid
- **Change ID:** field-creation
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-05
- **Blockers:** —
- **Unknowns:**
  - What is the exact UI interaction for "drawing columns and rows"? Grid drag-to-define, or a numeric dimensions form? Owner: dev. Block: no (UI decision at /10x-plan time).
- **Risk:** FR-002 ("draw columns and rows") is the most UI-complex requirement in the PRD. If the visual grid editor is underestimated, S-02 blocks S-03 and S-04. A numeric dimensions form is a simpler fallback if timeline is tight.
- **Status:** proposed

### S-05: Plant catalog requests

- **Outcome:** user can submit a request for a new plant type; admin can review and approve it so it appears in the catalog
- **Change ID:** plant-catalog-requests
- **PRD refs:** FR-014, FR-015
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:**
  - What data fields does an admin need to fill in when approving a plant (growth category, watering needs, harvest ratio)? These feed FR-003, FR-005, FR-011 downstream. Owner: dev. Block: no.
- **Risk:** Admin UI is rarely used but must be correct — missing plant data attributes block watering logic and harvest date calculation.
- **Status:** proposed

### S-03: Planting record

- **Outcome:** user can assign plants from the catalog to field cells, set a seeding date, and see the automatically calculated expected harvest date
- **Change ID:** planting-record
- **PRD refs:** FR-003, FR-005, FR-011
- **Prerequisites:** F-01, S-02
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:**
  - Hybrid plant entry (FR-003): when a user types a free-text plant name not in the catalog, how is growth category inferred for harvest date calculation? Owner: dev. Block: no.
- **Risk:** If the plant catalog (seeded in F-01 or added via S-05) has incomplete growth-category data, harvest date calculation (FR-011) will silently produce wrong estimates.
- **Status:** proposed

### S-04: Field weather view (US-01 complete)

- **Outcome:** user can view their planted field with crop details and a live weather panel showing current weather, rainfall in mm for the last 7 days, and the date of last rain — completing the end-to-end flow of US-01
- **Change ID:** field-weather-view
- **PRD refs:** FR-006, FR-008, FR-009, FR-010, US-01
- **Prerequisites:** S-01, S-03, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Offline capability (NFR): should the weather panel show cached data when offline, or simply show a "no connection" state? Owner: user. Block: no (MVP can show "no connection"; caching is a v2 enhancement).
- **Risk:** S-04 depends on three upstream items (S-01, S-03, F-02); any slip in those three blocks this slice. S-01 is currently blocked by the IMGW unknown — resolving that unknown is the critical path.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | db-schema-and-migrations | Design and migrate: fields, plants, plantings, weather_records tables with RLS | yes | Run `/10x-plan db-schema-and-migrations` |
| S-01 | imgw-weather-probe | Spike: IMGW API integration — region selection + weather display | no | Blocked — resolve IMGW API structure first (see Open Roadmap Questions #1) |
| F-02 | nightly-weather-job-scaffold | Scaffold Vercel Cron nightly IMGW fetch → weather_records | no | Depends on F-01; best planned after S-01 IMGW spike resolves |
| S-02 | field-creation | Field creation: grid layout editor (columns × rows) | no | Depends on F-01 |
| S-05 | plant-catalog-requests | Plant catalog: user request + admin approval workflow | no | Depends on F-01; parallel with S-02 |
| S-03 | planting-record | Planting record: assign plants to cells + seeding/harvest date | no | Depends on F-01, S-02 |
| S-04 | field-weather-view | Field view: planting details + live weather panel (US-01 complete) | no | Depends on S-01, S-03, F-02 |

## Open Roadmap Questions

1. **IMGW API: What endpoints are available, what data format, what are the rate limits, and does it provide current weather or only historical measurements?** — Owner: dev. Block: S-01, S-04 (and transitively F-02, S-03, S-04 timeline).
2. **Offline scope: Which features must work without internet connectivity?** The NFR states "core features should function with limited or intermittent internet access" but does not specify which features. — Owner: user. Block: no (MVP can display a "no connection" state; decision affects S-04 and any caching work).

## Parked

- **FR-004 (seed quantity/weight recording)** — Why parked: PRD resolution removed from MVP; data entry burden without use in any MVP calculation.
- **FR-012 (harvest data recording)** — Why parked: nice-to-have per PRD; defer to v2. Value for yield tracking over time but not critical for core watering decision flow.
- **FR-013 (watering notifications)** — Why parked: nice-to-have; in-app only if MVP phases complete early. Push notifications explicitly deferred to v2.
- **Multiple garden locations per user** — Why parked: PRD §Non-Goals; single location per user for MVP.
- **Community / sharing features** — Why parked: PRD §Non-Goals.
- **Marketplace (seeds/harvests)** — Why parked: PRD §Non-Goals.
- **Push notifications** — Why parked: PRD §Non-Goals (v2).
- **Observability / error tracking** — Why parked: not in PRD scope; add before scaling beyond pilot users.
- **Multi-language beyond Polish/English** — Why parked: PRD §Non-Goals.

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)
