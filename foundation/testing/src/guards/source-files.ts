import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** A source file read for a guard: its path relative to the root it was read from, and its text. */
export interface SourceFile {
  /** Relative to the root, with `/` separators on every platform, e.g. `ui/button.tsx`. */
  file: string;
  source: string;
}

export interface ReadSourceFilesOptions {
  /** Folders under the root to read; the root itself when omitted. A missing folder fails the read. */
  dirs?: readonly string[];
  /** Which file names count. Default: `.ts` and `.tsx`, without tests (`*.test.ts(x)`, `*.spec.ts(x)`). */
  include?: RegExp;
  /** Folder names skipped at any depth. Default: `node_modules`. */
  skipDirs?: readonly string[];
  /** `false` reads only the files directly in each folder. Default: true. */
  recursive?: boolean;
}

const DEFAULT_INCLUDE = /^(?!.*\.(?:test|spec)\.tsx?$).*\.tsx?$/;
const DEFAULT_SKIP_DIRS = ["node_modules"];

/**
 * Reads the source files under `root` (or under its `dirs`), recursively and sorted by path, so a
 * guard reports the same order on every machine.
 */
export function readSourceFiles(root: string, options: ReadSourceFilesOptions = {}): SourceFile[] {
  const include = options.include ?? DEFAULT_INCLUDE;
  const skipDirs = new Set(options.skipDirs ?? DEFAULT_SKIP_DIRS);
  const walk = { include, skipDirs, isRecursive: options.recursive !== false };
  const dirs = options.dirs ?? [""];
  return dirs
    .flatMap((dir) => listFiles(join(root, dir), walk))
    .map((path) => ({ file: relative(root, path).split(sep).join("/"), source: readFileSync(path, "utf8") }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

interface Walk {
  include: RegExp;
  skipDirs: ReadonlySet<string>;
  isRecursive: boolean;
}

function listFiles(dir: string, walk: Walk): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk.isRecursive && !walk.skipDirs.has(entry.name) ? listFiles(path, walk) : [];
    return entry.isFile() && walk.include.test(entry.name) ? [path] : [];
  });
}
