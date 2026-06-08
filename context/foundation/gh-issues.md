# GitHub Issues — Garden Management App

**Repo:** https://github.com/Lovable-wojkos/my-garden  
**Milestone:** MVP v1  
**Generated:** 2026-05-25

## Labels

| Label | Color | Description |
|---|---|---|
| `foundation` | `#0075ca` | Infrastructure/schema work, no direct user value |
| `slice` | `#e4e669` | User-facing vertical slice |
| `blocked` | `#d93f0b` | Cannot start yet |
| `DataFoundation` | `#bfd4f2` | Stream A: Data foundation + field lifecycle |
| `Weather` | `#c2e0c6` | Stream B: IMGW weather probe |
| `PlantCatalog` | `#d4c5f9` | Stream C: Plant catalog admin |

## Issues

| # | Roadmap ID | Title | Labels | State | URL |
|---|---|---|---|---|---|
| 1 | F-01 | [F-01] Design and migrate: fields, plants, plantings, weather_records tables with RLS | `foundation` `DataFoundation` `PlantCatalog` | In Progress | https://github.com/Lovable-wojkos/my-garden/issues/1 |
| 2 | S-01 | [S-01] Spike: IMGW API integration — region selection + weather display | `slice` `blocked` `Weather` | Open | https://github.com/Lovable-wojkos/my-garden/issues/2 |
| 3 | F-02 | [F-02] Scaffold Vercel Cron nightly IMGW fetch -> weather_records | `foundation` `DataFoundation` `Weather` | In Progress | https://github.com/Lovable-wojkos/my-garden/issues/3 |
| 4 | S-02 | [S-02] Field creation: grid layout editor (columns x rows) | `slice` `DataFoundation` | Open | https://github.com/Lovable-wojkos/my-garden/issues/4 |
| 5 | S-05 | [S-05] Plant catalog: user request + admin approval workflow | `slice` `PlantCatalog` | Open | https://github.com/Lovable-wojkos/my-garden/issues/5 |
| 6 | S-03 | [S-03] Planting record: assign plants to cells + seeding/harvest date | `slice` `DataFoundation` | Open | https://github.com/Lovable-wojkos/my-garden/issues/6 |
| 7 | S-04 | [S-04] Field view: planting details + live weather panel (US-01 complete) | `slice` `DataFoundation` `Weather` | Open | https://github.com/Lovable-wojkos/my-garden/issues/7 |
