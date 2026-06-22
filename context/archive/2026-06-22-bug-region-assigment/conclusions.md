# Conclusions: bug-region-assigment

> Closed after framing and regression tests. No implementation fix was required.

## Summary

The user suspected that switching between Warszawa and Ogony during city edit assigned the wrong `region_id`, causing rainfall in the weather widget to disagree with observed weather.

Investigation (frame + code review + tests) found **no evidence of a region-assignment bug** in the current implementation. The reported UI values (**14 mm / 7 days**, **last rain yesterday · 0.3 mm**) are consistent with **Open-Meteo daily aggregates** for the stored coordinates, shown on both dashboard and settings.

## Findings

### Region assignment path is coherent

`POST /api/user-preferences` always:

1. Calls `findOrCreateRegion` with the request lat/lng.
2. Upserts `user_preferences` with the same lat/lng and the returned `region_id`.
3. Propagates `region_id` to all user fields via `updateFieldsRegionForUser`.

Warszawa and Ogony are distinct shared regions (deduped on exact coordinates). Switching city updates all three consistently.

### Why the widget can disagree with “heavy rain on the ground”

1. **Open-Meteo uses model/grid data**, not a local rain gauge. Summer thunderstorms are highly localized; a nearby grid cell may report 0.3 mm while the user observes a downpour.
2. **Split data sources in WeatherWidget**:
   - **7-day total (dashboard)**: prefers cron-backed `weather_records` sum when available.
   - **7-day total (settings)**: live Open-Meteo only (no DB prop passed).
   - **Last rain (both pages)**: always live Open-Meteo by lat/lng — never `region_id`.
3. Identical low values on **dashboard and settings** strongly indicate the live API returned low totals for the stored coordinates, not a silent wrong `region_id`.

### Regression tests added

Tests lock the invariants the user cared about:

| File | What it guards |
| --- | --- |
| `src/test/api/user-preferences.test.ts` | Warszawa → Ogony switch; `region_id` always from `findOrCreateRegion`; coords match upsert |
| `src/test/lib/regions.test.ts` | Distinct region ids for Warszawa vs Ogony coordinates |
| `src/test/lib/weather-display.test.ts` | Prefs/region consistency; DB vs live 7-day display rules |
| `src/test/lib/weather-rainfall-region.test.ts` | `getRainfall7dCalendarMm` scopes queries by `region_id` |
| `src/lib/weather-display.ts` | Pure helpers extracted for testability; used by `WeatherWidget` |

## Outcome

- **No bug fix shipped** — assignment logic appears correct.
- **Tests added** — future regressions in region linking or rainfall scoping should fail CI.
- **If similar reports recur**, verify in this order:
  1. `user_preferences`: `region_id` vs `latitude`/`longitude` consistency.
  2. `weather_records` for that `region_id` vs widget values.
  3. Raw Open-Meteo response for stored coordinates.
  4. Only if (1) fails → investigate assignment; if (2) vs (3) diverge → investigate cron/DB path; if (3) matches UI → external data accuracy or geocoding pin, not app logic.

## Related artifacts

- Frame brief: `frame.md`
- Prior architecture: `context/archive/2026-06-17-fix-field-region/`
