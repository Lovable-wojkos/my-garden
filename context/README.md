# Context directory

| Path | Purpose |
| ---- | ------- |
| `foundation/` | Long-lived docs (PRD, roadmap, test-plan) — edit in place |
| `changes/` | Active change folders (`change.md`, `plan.md`, …) |
| `archive/` | Completed changes |
| `deployment/` | Deploy runbooks |
| `YYYYMMDDHHMM_current.md` | **what-next snapshots** — one per `/what-next` run |

## `*_current.md` snapshots

Created by the `/what-next` skill (`.cursor/skills/what-next/`).

- **Naming:** `YYYYMMDDHHMM_current.md` (12-digit timestamp prefix)
- **Retention:** all snapshots kept; newest used as baseline, second-newest for delta
- **Not foundation docs** — point-in-time status; do not edit old snapshots
