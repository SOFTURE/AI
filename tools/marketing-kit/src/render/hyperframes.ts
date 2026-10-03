import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * hyperframes, the renderer that turns the HTML composition into an MP4. An npm dependency pinned to
 * the version the composition contract was measured on (`compose.ts`), run from `node_modules`
 * with the current Node, never through `npx`.
 */

export const HYPERFRAMES_VERSION = "0.8.85";

const require = createRequire(import.meta.url);

/** Absolute path of the installed hyperframes CLI. */
export function getHyperframesBin(): string {
  return join(dirname(require.resolve("hyperframes/package.json")), "bin", "hyperframes.mjs");
}

/**
 * The environment hyperframes runs with: anonymous render telemetry stays off unless the caller set
 * `HYPERFRAMES_NO_TELEMETRY` themselves. `HYPERFRAMES_BROWSER_PATH` (a local Chrome) passes through.
 */
export function getHyperframesEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...env, HYPERFRAMES_NO_TELEMETRY: env.HYPERFRAMES_NO_TELEMETRY ?? "1" };
}

export function runHyperframes(args: string[], options: { cwd: string; stdio: "inherit" | "ignore" }): SpawnSyncReturns<Buffer> {
  return spawnSync(process.execPath, [getHyperframesBin(), ...args], { cwd: options.cwd, stdio: options.stdio, env: getHyperframesEnv() });
}
