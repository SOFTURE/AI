import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { ANSIBLE_DIR, findCollectionsDir, type AnsiblePaths } from "../ansible/index.js";
import type { CliIo } from "./io.js";
import { createProcessRunner, type Runner } from "./process.js";

/** What the commands reach outside this process; tests replace each part. */
export interface HostDeps {
  runner: Runner;
  fetch: typeof fetch;
  ansible: AnsiblePaths;
}

/** The package's own version, which names its collections cache. */
export function readPackageVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as unknown;
  return z.object({ version: z.string() }).parse(manifest).version;
}

export function createHostDeps(io: CliIo): HostDeps {
  return {
    runner: createProcessRunner(io),
    fetch,
    ansible: { ansibleDir: ANSIBLE_DIR, collectionsDir: findCollectionsDir(io.env, readPackageVersion()) },
  };
}

/** A path from the command line or the inventory: `~/` is the user's home, a relative path is from the cwd. */
export function resolvePath(io: CliIo, path: string): string {
  if (path === "~" || path.startsWith("~/")) return join(io.env.HOME ?? homedir(), path.slice(1));
  return isAbsolute(path) ? path : resolve(io.cwd, path);
}

/** Prints one step line: `server: …`, `github: …`, `cloudflare: …`. */
export function say(io: CliIo, step: string, text: string): void {
  io.stdout(`${step}: ${text}\n`);
}
