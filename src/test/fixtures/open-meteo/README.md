# Open-Meteo test fixtures

Recorded responses for Risk #3 weather sync tests. Do not fetch live in unit tests — use `vi.stubGlobal("fetch")` with these files.

## `warsaw-forecast.json`

- **Captured**: 2026-06-23
- **Coordinates**: 52.229676, 21.012229 (Warsaw)
- **URL**: `https://api.open-meteo.com/v1/forecast?latitude=52.229676&longitude=21.012229&daily=temperature_2m_max,precipitation_sum&timezone=auto&past_days=7&forecast_days=1&format=json`
- **Used by**: `src/test/lib/open-meteo.test.ts`, integration weather cron tests

Re-record if Open-Meteo changes response shape.
