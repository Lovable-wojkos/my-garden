---
name: what-next
description: >-
  Project status snapshot and prioritized next-step plan for my-garden. Scans
  roadmap, test-plan, active changes, and git state; writes
  context/YYYYMMDDHHMM_current.md. Reads prior snapshots for delta. Use when
  the user asks what to do next, /what-next, project status, or priorities.
argument-hint: "[optional focus area, e.g. testing or phase 3]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - AskUserQuestion
---

# /what-next — Project Status & Next Steps

Produce a **timestamped status snapshot** in `context/` and tell the user what to do next. Each run creates a **new** file; older snapshots are kept for investigation and delta.

## Invocation

- `/what-next` — full project check
- `/what-next testing` — same pipeline, weight test-plan and active test changes
- Trigger phrases: "what should I do next", "project status", "priorities", "where am I"

Optional first argument = **focus hint** (narrow recommendations, still run full scan).

## Pipeline (run in order)

### 1. Locate prior snapshots

```text
Pattern: context/YYYYMMDDHHMM_current.md
Regex:   ^\d{12}_current\.md$
```

1. `Glob` `context/*_current.md`
2. Keep only files matching `^\d{12}_current\.md$` on the basename
3. Sort by the 12-digit prefix **descending** (newest first)
4. **If ≥2 files:** read the **two newest** fully — latest is baseline, second is **previous** for delta
5. **If 1 file:** read it as **previous** for delta
6. **If 0 files:** no prior snapshot; skip delta section

Never delete or overwrite existing `*_current.md` files.

### 2. Gather current state (full scan)

Read these **fully** before writing:

| Source | What to extract |
| ------ | ---------------- |
| `context/foundation/roadmap.md` | At-a-glance table: done vs pending slices, north star, parked items |
| `context/foundation/test-plan.md` | §3 phased rollout status, §4–§5 gates, §6 cookbook TBDs |
| `context/changes/*/change.md` | Every **non-archived** change: `change_id`, `status`, title, notes |
| `context/changes/*/plan.md` | If present: `## Progress` unchecked items for in-flight work |
| `context/deployment/deploy-plan.md` | Pending deploy gates (if relevant) |
| `git status --porcelain` | Uncommitted / untracked files |
| `git log -5 --oneline` | Recent commits |
| `git branch --show-current` | Branch name |
| `git rev-parse HEAD` | Commit hash |

Also scan for **blockers** mentioned in prior snapshot delta (e.g. missing commit, broken `db reset`, CI gaps).

### 3. Ask one clarifying question (only when needed)

Use `AskUserQuestion` **only if** the scan surfaces a genuine fork the user must choose:

- Multiple active changes at similar priority with no clear ordering
- Uncommitted work spanning unrelated tracks (product vs testing vs infra)
- Focus hint conflicts with highest-risk open item

If unambiguous, skip questions and proceed.

### 4. Write new snapshot

**Filename:** `context/YYYYMMDDHHMM_current.md`

Timestamp = run time, 12 digits, no separators. Examples:

- PowerShell: `Get-Date -Format "yyyyMMddHHmm"`
- Bash: `date +"%Y%m%d%H%M"`

**Do not overwrite** an existing file with the same name; if collision (same minute), append seconds: `YYYYMMDDHHMMSS_current.md` and note in frontmatter.

Use [template.md](template.md). Required sections:

1. YAML frontmatter (`snapshot_at`, `git_commit`, `branch`, `previous_snapshot`, `focus`)
2. **Delta from previous** — what changed since last snapshot (only if previous exists)
3. **Roadmap** — slice status summary
4. **Test plan** — phase status
5. **Active changes** — table with status + next skill command
6. **Git & working tree** — branch, commit, notable uncommitted paths
7. **Blockers** — concrete impediments
8. **Recommended next steps** — numbered, prioritized (1 = do first)
9. **Suggested command** — single line, e.g. `/10x-implement testing-data-integrity phase 1`

### 5. Respond to user

Print a **short summary** (5–10 lines): top priority, top blocker, suggested command, path to full snapshot.

Link: `context/YYYYMMDDHHMM_current.md` (actual filename written).

## Rules

- **Investigation uses prior snapshots:** when ≥2 exist, compare newest previous vs scan — surface regressions (e.g. planned work still uncommitted, phase stuck)
- **Keep all snapshots** — retention is historical; never auto-delete
- **Foundation vs changes:** roadmap/test-plan = strategic; `context/changes/` = tactical; git = ground truth for uncommitted reality
- **Do not commit** unless the user explicitly asks
- **Do not edit** foundation docs or change folders during a what-next run (read-only audit unless user asks to fix something)

## Priority heuristics (my-garden)

Apply in order when ranking recommendations:

1. **Blockers** — broken local workflow (e.g. `db reset`, CI), missing secrets, failing tests on touched areas
2. **In-flight change with plan** — advance `implementing` / `planned` changes before opening new ones
3. **Test-plan phase order** — complete earlier phases before later unless phase is independent (e.g. Phase 3 data integrity ≠ Phase 2 RLS)
4. **Roadmap** — all MVP slices done → quality track or product gaps (watering logic, FR-013)
5. **Uncommitted WIP** — finish/commit or explicitly park before starting unrelated work

## What this skill does NOT do

- Does not replace `/10x-plan`, `/10x-research`, or `/10x-implement`
- Does not run E2E or full test suites (mention `npm run test:run` as a suggestion only)
- Does not modify `context/changes/` or archive changes

## Examples

```
/what-next
→ Writes context/202606171430_current.md, summarizes top 3 actions

/what-next phase 3
→ Same pipeline; weights testing-data-integrity and test-plan Phase 3
```
