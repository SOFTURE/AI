import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_APP_LEDGER } from "../db/snapshot-query.js";
import type { DeployConfig, DeployHook, MaintainHook } from "../verify/schema.js";
import { readDeployConfig } from "./deploy-config.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

/** The hook points of deploy.sh, in the order a deploy and a maintain run reach them. */
export const HOOK_POINTS = ["pre-migrate", "post-up", "maintain"] as const;

/** One file per setting, so a shell script reads them without parsing JSON. */
export type ServerSettingsFiles = Record<string, string>;

/** A hook as NUL-separated fields: name, kind (compose or run), the number of arguments, the arguments. */
function toHookRecord(hook: DeployHook | MaintainHook): string {
  const [kind, args] = "compose" in hook ? ["compose", hook.compose] : ["run", hook.run];
  return [hook.name, kind, String(args.length), ...args].map((field) => `${field}\0`).join("");
}

/**
 * The files `server-settings` writes: `access`, `app-journal`, `app-ledger`, `exclude-table-data` (comma list), one
 * `hooks-<point>` per point (records of `toHookRecord`; a scheduled maintain hook is left out), `cron` (name and
 * schedule of each scheduled maintain hook, NUL-separated) and `scheduled-<name>` (that hook's record). Each value ends
 * in a newline or a NUL, or the file is empty.
 */
export function planServerSettings(config: DeployConfig): ServerSettingsFiles {
  const database = config.database;
  const hooks = config.hooks ?? {};
  const maintain = hooks.maintain ?? [];
  const scheduled = maintain.filter((hook) => hook.schedule !== undefined);
  const line = (value: string | undefined): string => (value === undefined ? "" : `${value}\n`);
  return {
    access: line(database?.access ?? "host"),
    "app-journal": line(database?.appMigrations?.journal),
    "app-ledger": line(database?.appMigrations === undefined ? undefined : (database.appMigrations.ledger ?? DEFAULT_APP_LEDGER)),
    "exclude-table-data": line(database?.excludeTableData?.join(",")),
    "hooks-pre-migrate": (hooks["pre-migrate"] ?? []).map(toHookRecord).join(""),
    "hooks-post-up": (hooks["post-up"] ?? []).map(toHookRecord).join(""),
    "hooks-maintain": maintain.filter((hook) => hook.schedule === undefined).map(toHookRecord).join(""),
    cron: scheduled.map((hook) => `${hook.name}\0${hook.schedule ?? ""}\0`).join(""),
    ...Object.fromEntries(scheduled.map((hook) => [`scheduled-${hook.name}`, toHookRecord(hook)])),
  };
}

/**
 * `softure-deploy server-settings --config=<deploy.json> --out-dir=<dir>`: validates the release's deploy.json and
 * writes what init's deploy.sh reads from it (database access, the app ledger, backup exclusions, hooks, cron lines).
 */
export function runServerSettings(args: string[], io: CliIo): void {
  const flags = readFlags("server-settings", args, {
    config: { type: "string" },
    "out-dir": { type: "string" },
  });
  if (flags.config === undefined || flags["out-dir"] === undefined) {
    fail("server-settings: --config and --out-dir are required.", USAGE_EXIT_CODE);
  }
  const config = readDeployConfig("server-settings", resolve(io.cwd, flags.config), flags.config);
  const files = planServerSettings(config);
  const dir = resolve(io.cwd, flags["out-dir"]);
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const hooks = HOOK_POINTS.map((point) => `${point} ${(config.hooks?.[point] ?? []).length}`).join(", ");
  io.stdout(`server-settings: access ${config.database?.access ?? "host"}; hooks ${hooks}\n`);
}
