// The entry-point guard for an app on `createProcessDatabase`: `db` is synchronous but opening is not, so every
// process entry (the server's instrumentation, an MCP stdio server, each script) must open the database before its
// first query. esbuild resolves each entry's import graph (path aliases and re-exports included); an entry that
// reaches the app's client module must call an opener in its own source. esbuild is an optional peer, loaded here.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Metafile } from "esbuild";

/** A call to `withDatabase(` or `open(` (`processDb.open(` too): what `createProcessDatabase` gives an entry. */
export const DEFAULT_DATABASE_OPENERS: readonly RegExp[] = [/\bwithDatabase\s*\(/, /\bopen\s*\(/];

export interface EntryGuardOptions {
  /** The process entry points, as paths (relative to `workingDir`) or absolute paths. */
  readonly entries: readonly string[];
  /** The app's module that calls `createProcessDatabase` (e.g. `src/db/index.ts`). */
  readonly clientModule: string;
  /** Patterns an entry's own source must match to count as opening the database. Default: `DEFAULT_DATABASE_OPENERS`. */
  readonly opens?: readonly RegExp[];
  /** The directory paths and the app's tsconfig resolve from. Default: `process.cwd()`. */
  readonly workingDir?: string;
  /** Extra import paths esbuild leaves out of the graph (packages are always left out). */
  readonly external?: readonly string[];
}

export interface EntryReach {
  /** The entry as given in `entries`. */
  readonly entry: string;
  /** Whether the entry's own source opens the database. */
  readonly opens: boolean;
}

const ASSET_EXTENSIONS = [".css", ".scss", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2"];

/**
 * The entries whose import graph (static and dynamic imports) reaches `clientModule`, in the order given, each
 * with whether its own source opens the database. Entries that never reach it are left out.
 */
export async function findEntriesReachingDatabase(options: EntryGuardOptions): Promise<EntryReach[]> {
  const workingDir = options.workingDir ?? process.cwd();
  const clientPath = resolve(workingDir, options.clientModule);
  if (!existsSync(clientPath)) {
    throw new Error(`findEntriesReachingDatabase: the client module does not exist: ${options.clientModule}`);
  }
  const metafile = await buildMetafile(options.entries.map((entry) => resolve(workingDir, entry)), workingDir, options.external ?? []);
  const opens = options.opens ?? DEFAULT_DATABASE_OPENERS;

  return options.entries.flatMap((entry) => {
    const entryPath = resolve(workingDir, entry);
    if (!reaches(metafile, workingDir, entryPath, clientPath)) return [];
    const source = readFileSync(entryPath, "utf8");
    return [{ entry, opens: opens.some((pattern) => pattern.test(source)) }];
  });
}

/** Throws, naming each one, when an entry reaches `clientModule` without opening the database. */
export async function expectEntriesOpenDatabase(options: EntryGuardOptions): Promise<void> {
  const missing = (await findEntriesReachingDatabase(options)).filter((reach) => !reach.opens);
  if (missing.length === 0) return;
  throw new Error(
    `These entries reach the database client without opening it (call withDatabase() or open() at the entry):\n` +
      missing.map((reach) => `  - ${reach.entry}`).join("\n"),
  );
}

async function buildMetafile(entryPoints: readonly string[], workingDir: string, external: readonly string[]): Promise<Metafile> {
  const { build } = await loadEsbuild();
  const result = await build({
    entryPoints: [...entryPoints],
    absWorkingDir: workingDir,
    // Never written (`write: false`); esbuild needs an output directory for several entries.
    outdir: resolve(workingDir, ".entry-guard"),
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    packages: "external",
    external: [...external],
    loader: Object.fromEntries(ASSET_EXTENSIONS.map((extension) => [extension, "empty" as const])),
    logLevel: "silent",
  });
  return result.metafile;
}

async function loadEsbuild(): Promise<typeof import("esbuild")> {
  try {
    return await import("esbuild");
  } catch (error) {
    throw new Error("findEntriesReachingDatabase: needs the \"esbuild\" package; run `npm install --save-dev esbuild`", { cause: error });
  }
}

function reaches(metafile: Metafile, workingDir: string, entryPath: string, clientPath: string): boolean {
  const keyByPath = new Map(Object.keys(metafile.inputs).map((key) => [resolve(workingDir, key), key]));
  const start = keyByPath.get(entryPath);
  if (start === undefined) return false;
  const seen = new Set<string>([start]);
  const queue = [start];
  for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
    if (resolve(workingDir, key) === clientPath) return true;
    for (const imported of metafile.inputs[key]?.imports ?? []) {
      if (imported.external === true || seen.has(imported.path)) continue;
      seen.add(imported.path);
      queue.push(imported.path);
    }
  }
  return false;
}
