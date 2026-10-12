import { posix } from "node:path";
import type { SourceFile } from "../source-files.js";
import { DEFAULT_IMPLEMENTATION, type ImplementationOptions } from "./options.js";
import { formatHit, hasDirective, importsModule, parseFiles, readValueImports } from "./syntax.js";

export interface ClientImportOptions extends ImplementationOptions {
  /**
   * Import path prefixes and the folder (relative to the files' root) they stand for, as in
   * `tsconfig` `paths`: `{ "@/": "" }` or `{ "~/": "src/" }`. Relative specifiers always resolve.
   */
  aliases?: Readonly<Record<string, string>>;
}

/** A name shaped like a React component (`SaveButton`), not a constant (`MAX_ITEMS`) or a function (`formatDate`). */
const COMPONENT_NAME = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/;

/**
 * Rule 5: no plain value is imported from a `"use client"` module into server code, where it becomes
 * a client reference instead of the value. Server code is a `"use server"` module, an implementation
 * module or a file that imports `server-only`: any value import from a client module is reported
 * there. Other files without `"use client"` (server components) may import components, so only names
 * that are not component-shaped are reported. Only modules among `files` are resolved.
 */
export function findClientValueImports(files: readonly SourceFile[], options: ClientImportOptions = {}): string[] {
  const implementation = options.implementation ?? DEFAULT_IMPLEMENTATION;
  const aliases = Object.entries(options.aliases ?? {});
  const parsedFiles = parseFiles(files);
  const known = new Set(parsedFiles.map(({ file }) => file));
  const clientFiles = new Set(parsedFiles.filter(({ tree }) => hasDirective(tree, "use client")).map(({ file }) => file));
  return parsedFiles
    .filter(({ file }) => !clientFiles.has(file))
    .flatMap((parsed) => {
      const isServerCode = hasDirective(parsed.tree, "use server") || implementation.test(parsed.file) || importsModule(parsed.tree, "server-only");
      return readValueImports(parsed.tree).flatMap((imported) => {
        const target = resolveModule(parsed.file, imported.module, aliases, known);
        if (target === null || !clientFiles.has(target)) return [];
        const name = imported.imported === "default" ? imported.local : imported.imported;
        if (!isServerCode && (imported.imported === "*" || COMPONENT_NAME.test(name))) return [];
        const what = imported.imported === "*" ? `the namespace of ${target}` : `${name} from ${target}`;
        return [formatHit(parsed, imported.node, `server code imports ${what}, a "use client" module; it arrives as a client reference, not the value`)];
      });
    });
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];

/** The file among `known` that a specifier names, or null for a package or a file not given. */
function resolveModule(from: string, specifier: string, aliases: readonly [string, string][], known: ReadonlySet<string>): string | null {
  let base: string | null = null;
  if (specifier.startsWith("./") || specifier.startsWith("../")) base = posix.join(posix.dirname(from), specifier);
  for (const [prefix, folder] of aliases) {
    if (base === null && specifier.startsWith(prefix)) base = posix.join(folder, specifier.slice(prefix.length));
  }
  if (base === null) return null;
  const stem = base.replace(/\.[cm]?jsx?$/, "");
  const candidates = [base, ...SOURCE_EXTENSIONS.map((extension) => stem + extension), ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`)];
  return candidates.map((candidate) => posix.normalize(candidate)).find((candidate) => known.has(candidate)) ?? null;
}
