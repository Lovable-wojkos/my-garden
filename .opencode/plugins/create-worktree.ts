import type { Plugin } from "@opencode-ai/plugin";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const PreSkillWorktree: Plugin = async ({ worktree, $, client }) => {
  return {
    "tool.execute.before": async (_input, output) => {
      const args = (output as any)?.args;
      if (!args?.name) return;
      if (args.name !== "10x-implement" && args.name !== "10x-archive") return;

      const changesDir = resolve(worktree, "context/changes");
      if (!existsSync(changesDir)) return;

      const dirs = readdirSync(changesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => ({
          name: d.name,
          changeMd: resolve(changesDir, d.name, "change.md"),
        }))
        .filter((d) => existsSync(d.changeMd))
        .sort((a, b) => statSync(b.changeMd).mtimeMs - statSync(a.changeMd).mtimeMs);

      const latest = dirs[0];
      if (!latest) return;

      const changeId = latest.name;
      const worktreeDir = resolve(worktree, "worktrees", changeId);
      const branch = `feature/${changeId}`;
      const git = $.cwd(worktree);

      if (args.name === "10x-archive") {
        if (!existsSync(worktreeDir)) return;
        try {
          await git`git worktree remove ${worktreeDir}`;
        } catch {
          // branch may have uncommitted changes; ignore
        }
        return;
      }

      if (existsSync(worktreeDir)) return;

      try {
        await git`git worktree add -b ${branch} ${worktreeDir}`;
      } catch {
        // silent — agent will proceed regardless
      }
    },
  };
};
