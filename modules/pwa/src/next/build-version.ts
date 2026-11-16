import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isWorkersRuntime } from "@softure-ai/core";

/** The version outside a production build (`next dev`, tests). */
export const DEV_BUILD_VERSION = "dev";

const versions = new Map<string, string>();

/** The build id in `<dir>/.next/BUILD_ID`, or `dev` when there is none. Reads the file on every call. */
export function readBuildVersion(dir: string): string {
  try {
    const version = readFileSync(join(dir, ".next", "BUILD_ID"), "utf8").trim();
    return version === "" ? DEV_BUILD_VERSION : version;
  } catch (error) {
    // No build yet (`next dev`) is expected; any other failure (a permission, a folder in its place) is a bug to see.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEV_BUILD_VERSION;
    throw new Error(`readBuildVersion: reading ${join(dir, ".next", "BUILD_ID")} failed`, { cause: error });
  }
}

/** The environment variable that names the build where there is no `.next` folder (Cloudflare Workers). */
export const BUILD_VERSION_ENV = "SOFTURE_BUILD_VERSION";

/**
 * The build's version for the service worker and `/pwa/version`: `SOFTURE_BUILD_VERSION` when it is set, otherwise
 * `.next/BUILD_ID` under `dir` (the working directory by default), read once per process, `dev` when there is none. A
 * new build changes the worker's bytes, so the browser installs it. On Cloudflare Workers, which have no `.next`
 * folder, the variable is required: a `dev` version would keep the first service worker forever.
 */
export function getBuildVersion(dir: string = process.cwd()): string {
  const fromEnv = process.env[BUILD_VERSION_ENV]?.trim() ?? "";
  if (fromEnv !== "") return fromEnv;
  if (isWorkersRuntime()) {
    throw new Error(`@softure-ai/pwa: set ${BUILD_VERSION_ENV} on Cloudflare Workers (a Worker has no .next/BUILD_ID)`);
  }
  const known = versions.get(dir);
  if (known !== undefined) return known;
  const version = readBuildVersion(dir);
  versions.set(dir, version);
  return version;
}
