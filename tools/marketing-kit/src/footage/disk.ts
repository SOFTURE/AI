import { existsSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

/**
 * The free space a hyperframes render needs. hyperframes 0.8.85 refuses to render (exit code 1, "Low disk space")
 * when its temp folder (`os.tmpdir()`, where it also extracts the clips' frames) or its output's folder has under
 * 1 GiB free, measured as `statfs` `bsize * bavail`. The kit measures the same way, so it never refuses a render
 * hyperframes would run.
 */
export const RENDER_MIN_FREE_BYTES = 1024 ** 3;

/** Reads a folder's free bytes; null when it cannot be read. Injected in tests. */
export type FreeBytesReader = (folder: string) => number | null;

/** The nearest existing folder of a path: a folder the run creates later is measured on the disk it will live on. */
function findExistingFolder(path: string): string {
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

/** Free bytes for an unprivileged writer at `folder` (or its nearest existing parent); null when `statfs` fails. */
export function getFreeBytes(folder: string): number | null {
  try {
    const stats = statfsSync(findExistingFolder(folder));
    return stats.bsize * stats.bavail;
  } catch {
    // An unreadable disk is not reported: hyperframes passes it as "Unable to check" too.
    return null;
  }
}

/**
 * The temp folder the hyperframes process will use: `tempDir` when given (the kit passes it as `TMPDIR`), else the
 * `TMPDIR`, `TMP` or `TEMP` of the environment it runs with, else this process's `os.tmpdir()`.
 */
export function getRenderTempDir(env: NodeJS.ProcessEnv, tempDir?: string): string {
  if (tempDir !== undefined && tempDir.length > 0) return resolve(tempDir);
  for (const name of ["TMPDIR", "TMP", "TEMP"]) {
    const value = env[name];
    if (value !== undefined && value.length > 0) return resolve(value);
  }
  return tmpdir();
}

const toGiB = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1);

/**
 * One sentence per folder with less free space than a render needs, naming the folder and how to fix it. Folders
 * are checked once each; an unreadable one is skipped.
 */
export function findLowDiskProblems(folders: { temp: string; build?: string }, readFreeBytes: FreeBytesReader = getFreeBytes): string[] {
  const entries: { folder: string; role: string; hint: string }[] = [
    {
      folder: resolve(folders.temp),
      role: "the temp folder",
      hint: "hyperframes extracts the clips' frames there (hundreds of MB per minute of film): point TMPDIR (or renderFootage's tempDir) at a data volume, not a small tmpfs",
    },
  ];
  if (folders.build !== undefined && resolve(folders.build) !== entries[0]?.folder) {
    entries.push({ folder: resolve(folders.build), role: "the build folder", hint: "hyperframes writes the render there: free space or move buildDir to a larger disk" });
  }
  const problems: string[] = [];
  for (const entry of entries) {
    const free = readFreeBytes(entry.folder);
    if (free === null || free >= RENDER_MIN_FREE_BYTES) continue;
    problems.push(`${entry.role} ${entry.folder} has ${toGiB(free)} GiB free and a hyperframes render needs ${toGiB(RENDER_MIN_FREE_BYTES)} GiB; ${entry.hint}.`);
  }
  return problems;
}
