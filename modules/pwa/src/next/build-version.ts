import { readFileSync } from "node:fs";
import { join } from "node:path";

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

/**
 * The build's version for the service worker and `/pwa/version`: `.next/BUILD_ID` under `dir` (the working directory
 * by default), read once per process, `dev` when there is none. A new build changes the worker's bytes, so the
 * browser installs it.
 */
export function getBuildVersion(dir: string = process.cwd()): string {
  const known = versions.get(dir);
  if (known !== undefined) return known;
  const version = readBuildVersion(dir);
  versions.set(dir, version);
  return version;
}
