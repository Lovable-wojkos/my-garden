# Integration Hot-Spots — Plan Brief

> Full plan: `context/changes/testing-integration-hotspots/plan.md`
> Research: `context/changes/testing-integration-hotspots/research.md`

## What & Why

Phase 2 of the test rollout adds **live Supabase integration** and **Open-Meteo fixtures** to prove risks **#3** (weather sync fails silently) and **#4** (users access each other's field/planting data). Phase 1 mocked handlers and Phase 3 seed smoke stay — this change fills the behavioral gap between them.

## Starting Point

Vitest runs unit and mocked API tests with fake `astro:env` keys. Weather cron tests mock `getDailyWeather`; no Open-Meteo JSON fixtures exist. RLS policies are in migrations but no Vitest path exercises `auth.uid()` with two real users. `plantings` INSERT only checks `user_id`, not field ownership. `db:smoke` validates seed rows via raw Postgres and bypasses RLS.

## Desired End State

Contributors run `npm run test:integration` (local Supabase) and get green proofs that: cron upsert does not corrupt rows on failure; rainfall stale flags work on real `weather_records`; User A cannot read, mutate, or **plant on** User B's fields. A migration hardens `plantings` INSERT RLS. Playwright E2E covers cross-user `/dashboard/fields/[id]` (documents current SSR error UX). Cookbook §6.2 documents the pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Vitest integration config | Separate `vitest.integration.config.ts` | Keeps unit `astro-virtual.ts` mock isolated from real `.env` keys | Plan |
| Open-Meteo mocking | Recorded fixtures + `fetch` stub | MSW deferred in Phase 1; fixtures give real parse shape without new dependency | Research / Plan |
| Planting INSERT gap | Migration + integration test | User A must not plant on B's field — enforce at RLS layer | Plan |
| Field detail 500 on miss | E2E documents UX; no SSR fix | Test rollout scope; SSR error handling is a future change | Plan |
| E2E scope | **Required** Phase 5 (`/10x-e2e`) | SSR boundary not covered by Vitest integration | Plan |
| TDD skill routing | `/10x-implement` with test-first loops | Production code exists; `/10x-tdd` skill gates on absent implementation | Plan |
| CI integration | Deferred to Phase 4 | Local-only gate matches prior rollout phases | Research |

## Scope

**In scope:** Integration harness, Open-Meteo fixtures, parse + cron mocked hardening, live weather DB tests, plantings INSERT RLS migration, two-user RLS matrix, API cross-tenant tests, field URL E2E, test-plan §6.2 update.

**Out of scope:** SSR 500→404 fix, MSW install, CI Supabase, replacing Phase 1 mocks, weather widget E2E, legacy weather helper tests.

## Architecture / Approach

```
Phase 1 infra (vitest.integration + helpers + fixtures)
    → Phase 2 fast tests (Open-Meteo parse, mocked cron failures)
    → Phase 3 live weather_records (cron handler + getRainfall7dCalendarMm)
    → Phase 4 RLS migration + live two-user (service + API layers)
    → Phase 5 Playwright field URL E2E (required)
    → Phase 6 cookbook
```

Unit tests (`test:run`) stay fast with mocks. Integration tests (`test:integration`) require `npx supabase start` and real `.env` keys.

## Phases at a Glance

| Phase | What it delivers | Driver skill | Key risk |
| ----- | ---------------- | ------------ | -------- |
| 1. Infrastructure | Config, helpers, fixture dir, npm script | `/10x-implement` | Env alias leaks into integration |
| 2. Weather parse + mocked cron | Fixture tests, cron failure paths | `/10x-implement` | Fixture schema drift |
| 3. Live weather DB | Cron upsert + stale rainfall on real rows | `/10x-implement` | Teardown / data pollution |
| 4. RLS migration + live tests | INSERT policy fix + two-user IDOR matrix | `/10x-implement` | Migration + cookie wiring |
| 5. E2E field URL | Cross-user dashboard SSR boundary | `/10x-e2e` | Documents 500 UX; flake risk |
| 6. Close-out | test-plan §6.2 + change status | `/10x-implement` | Docs drift from code |

**Prerequisites:** Docker, local Supabase, `.env` with anon + service role keys, Phase 1 Vitest green.

**Estimated effort:** ~4–5 sessions across 6 phases.

## Open Risks & Assumptions

- Open-Meteo JSON shape may drift — re-record `warsaw-forecast.json` if parse tests fail after API change.
- Phase 5 E2E may observe 500 on cross-user field URL until a future SSR fix change.
- Integration suite stays local-only until Phase 4 CI wires Supabase.
- RLS migration must not break seed data — verify with `db:verify`.

## Success Criteria (Summary)

- `npm run test:run` and `npm run test:integration` (with Supabase) both pass.
- Risk #3: failed fetch does not corrupt `weather_records`; stale rainfall flagged on live rows.
- Risk #4: User A cannot access or plant on User B's fields/plantings; migration enforces INSERT boundary.
- `npm run test:e2e` field-idor spec passes; no B field data visible to A.
- test-plan §6.2 documents how to add the next live integration test.
