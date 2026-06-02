/**
 * persist-permissions plugin
 *
 * When the user chooses "always" on a permission prompt, this plugin writes
 * the approved rule into the project's opencode.json so it is remembered
 * across sessions.
 *
 * How it works:
 *  - `permission.ask` hook fires before the prompt is shown. We stash the
 *    full Permission (id, tool type, pattern) keyed by permission id.
 *  - The `event` hook fires for every server event. When we see
 *    `permission.replied` with response === "always", we look up the
 *    stashed permission and merge a rule into opencode.json.
 *
 * The hook signatures match @opencode-ai/plugin types (see
 * `Hooks` in packages/plugin/src/index.ts upstream).
 */

import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = resolve(import.meta.dirname, "../../opencode.json");

type StashedPermission = {
  tool: string;
  pattern?: string | string[];
};

const pending = new Map<string, StashedPermission>();

function readConfig(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { $schema: "https://opencode.ai/config.json" };
  }
}

function writeConfig(cfg: Record<string, unknown>): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/**
 * Merge "allow" rule(s) for a tool into the permission config.
 *
 * Rules are last-match-wins, so specific patterns are inserted before any
 * existing catch-all "*" so the catch-all keeps applying to everything else.
 */
function mergePermission(
  existing: Record<string, unknown>,
  tool: string,
  patterns: string[],
): boolean {
  if (!patterns.length) return false;

  const permission = (existing.permission ?? {}) as Record<string, unknown>;
  const current = permission[tool];

  if (patterns.length === 1 && patterns[0] === "*") {
    if (current === "allow") return false;
    permission[tool] = "allow";
    existing.permission = permission;
    return true;
  }

  let ruleset: Record<string, string>;
  if (typeof current === "string") {
    ruleset = { "*": current };
  } else if (current && typeof current === "object") {
    ruleset = { ...(current as Record<string, string>) };
  } else {
    ruleset = { "*": "ask" };
  }

  const catchAll = ruleset["*"];
  delete ruleset["*"];

  let changed = false;
  for (const pattern of patterns) {
    if (pattern === "*") continue;
    if (ruleset[pattern] !== "allow") {
      ruleset[pattern] = "allow";
      changed = true;
    }
  }

  if (catchAll !== undefined) ruleset["*"] = catchAll;

  if (!changed) return false;
  permission[tool] = ruleset;
  existing.permission = permission;
  return true;
}

function toPatternArray(p: string | string[] | undefined): string[] {
  if (!p) return ["*"];
  if (Array.isArray(p)) return p.length ? p : ["*"];
  return [p];
}

export const PersistPermissions: Plugin = async ({ client }) => {
  const log = async (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => {
    try {
      await client.app.log({
        body: { service: "persist-permissions", level, message, extra },
      });
    } catch {
      // ignore
    }
  };

  return {
    "permission.ask": async (input) => {
      // Stash the permission so we can resolve it when the reply event fires.
      pending.set(input.id, { tool: input.type, pattern: input.pattern });
    },

    event: async ({ event }) => {
      if (event.type !== "permission.replied") return;

      const { permissionID, response } = event.properties;
      const stashed = pending.get(permissionID);
      pending.delete(permissionID);

      if (response !== "always") return;
      if (!stashed) {
        await log("warn", "permission.replied without stashed entry", { permissionID });
        return;
      }

      const patterns = toPatternArray(stashed.pattern);

      try {
        const cfg = readConfig();
        const changed = mergePermission(cfg, stashed.tool, patterns);
        if (changed) {
          writeConfig(cfg);
          await log("info", "persisted permission rule", { tool: stashed.tool, patterns });
        }
      } catch (err) {
        await log("error", "failed to write config", { error: String(err) });
      }
    },
  };
};
