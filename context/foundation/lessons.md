# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Keep commit subjects under 80 characters

- **Context**: All git commits in this repo
- **Problem**: Hook rejects messages over 80 chars, causing failed commits
- **Rule**: Keep commit subjects under 80 characters
- **Applies to**: implement, impl-review

## Prefer plain git commands over housekeeping scripts

- **Context**: Repo housekeeping, grouped commits, archiving finished changes (`/10x-archive`, end-of-session cleanup)
- **Problem**: Helper scripts (`housekeep.mjs`, one-off `.ps1`) hide what runs, fail silently when the terminal misbehaves, and add maintenance. The user still needs to understand and run the underlying git steps.
- **Rule**: For grouped commits and archive, give plain `git add` + `git commit` commands (one logical group per commit). Do not generate scripts unless the workflow is genuinely repetitive, non-trivial, or the user explicitly asks for automation.
- **Applies to**: implement, plan-review, all
