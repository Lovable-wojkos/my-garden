# Snapshot template for `context/YYYYMMDDHHMM_current.md`

Copy structure below. Replace placeholders; omit **Delta** section when no prior snapshot.

```markdown
---
snapshot_at: YYYY-MM-DDTHH:MM:SS+00:00
git_commit: <hash>
branch: <branch>
previous_snapshot: <YYYYMMDDHHMM_current.md or null>
focus: <optional user focus or "full">
---

# Project Status — <human date>

## Delta from previous

<!-- Only when previous_snapshot exists. Compare prior recommendations vs current reality. -->

| Area | Previous said | Now |
| ---- | ------------- | --- |
| … | … | … |

**Carried forward:** items still open from last snapshot
**Resolved since last:** items completed or no longer relevant

## Roadmap

<!-- From context/foundation/roadmap.md At a glance -->

- **Done:** …
- **Open / parked:** …
- **Product gap (if any):** …

## Test plan

<!-- From context/foundation/test-plan.md §3 -->

| Phase | Status | Change folder |
| ----- | ------ | ------------- |
| … | … | … |

## Active changes

| change_id | status | Next command |
| --------- | ------ | ------------ |
| … | … | `/10x-…` |

## Git & working tree

- **Branch:** … @ `…`
- **Uncommitted:** … (group by theme if many files)
- **Recent commits:** …

## Blockers

- …

## Recommended next steps

1. **…** — why
2. **…** — why
3. **…** — why

## Suggested command

`/…` or shell one-liner
```
