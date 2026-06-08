---
name: parallel-implementation-check
description: >
  Check status and consistency of parallel implementation tracks.
  Compares concurrent changes from the roadmap for drift, conflicts,
  and divergence from the shared baseline.
version: 1
params:
  - name: change-ids
    type: string[]
    position: 0..*
    description: >
      One or more change-ids to check. If omitted, checks all active
      changes whose roadmap `Parallel with` fields overlap.
    example: "db-schema-and-migrations imgw-weather-probe"
    required: false

  - name: scope
    type: enum
    flag: --scope
    values: [all, phase, stream]
    default: all
    description: "Scope of the check — all parallel tracks, a specific phase, or a roadmap stream."
    example: "--scope stream"

  - name: stream
    type: string
    flag: --stream
    description: "Roadmap stream letter (A, B, C). Only effective when --scope=stream."
    example: "--stream A"

  - name: phase
    type: integer
    flag: --phase
    description: "Phase number within each change. Only effective when --scope=phase."
    example: "--phase 2"

  - name: diff-only
    type: boolean
    flag: --diff-only
    description: "Skip status summary; only report file conflicts and schema drift."
    example: "--diff-only"
    default: false

  - name: output
    type: enum
    flag: --output
    values: [summary, detailed, json]
    default: summary
    description: "Output verbosity."
    example: "--output json"

  - name: file
    type: filepath
    flag: --plan
    description: "Path to a specific plan.md file. Uses @ convention."
    example: "--plan @context/changes/db-schema-and-migrations/plan.md"
---

# Parallel Implementation Check

Check that concurrently implemented changes from the roadmap do not conflict.
Reads `context/foundation/roadmap.md` for `Parallel with` relationships and
each change's `change.md` / `plan.md` for execution status.

## Inputs

- `context/foundation/roadmap.md` — `Parallel with` fields
- `context/changes/<change-id>/change.md` — `status` and `updated`
- `context/changes/<change-id>/plan.md` — `## Progress` section

## Outputs

- Report printed to stdout (or JSON via `--output json`)
- Writes to `.openspec/commands/parallel-implementation-check/reports/<date>-<hash>.md` when `--output detailed`

## Steps

1. **Resolve target changes** from positional args or roadmap `Parallel with` graph.
2. **Read status** from each `change.md` (`status`, `updated`).
3. **Check for file conflicts** — scan `plan.md` "Changes Required" paths for overlaps between parallel changes.
4. **Report** status summary and any conflicts found.

## Example invocations

```
# Check all parallel changes (default)
parallel-implementation-check

# Check two specific changes
parallel-implementation-check db-schema-and-migrations imgw-weather-probe

# Detailed JSON output for stream A
parallel-implementation-check --scope stream --stream A --output json

# Conflict scan only, no status summary
parallel-implementation-check --diff-only

# Check a specific phase across parallel tracks
parallel-implementation-check --scope phase --phase 1

# Check against a specific plan file
parallel-implementation-check --plan @context/changes/db-schema-and-migrations/plan.md
```

## Exit codes

| Code | Meaning                            |
| ---- | ---------------------------------- |
| 0    | All parallel tracks are consistent |
| 1    | Conflicts or drift detected        |
| 2    | Invalid arguments or missing files |

Check the roadmap and plans for S-05 and S-06. Assess whether they can be implemented in parallel. Pay attention to shared files, contracts, layers and other elements that may cause conflicts.
