// The Workers-safety guard (docs/07-runtime-providers.md): a package lists the export keys that must run on
// Cloudflare Workers under `"softure": { "workers": [...] }` in its package.json, and every module reachable from those
// entries through static imports, re-exports and dynamic imports may use only the Node builtins `nodejs_compat`
// provides, and only Workers entries of other `@softure-ai/*` packages. Type-only imports are skipped.
import { builtinModules } from "node:module";
import ts from "typescript";

/** Node builtins Cloudflare Workers provide under `nodejs_compat`, usable on a request path. */
export const WORKERS_BUILTINS: ReadonlySet<string> = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "crypto",
  "diagnostics_channel",
  // workerd resolves names over DNS-over-HTTPS (1.1.1.1).
  "dns",
  "dns/promises",
  "events",
  // workerd's node:fs is a virtual disk: the bundle read-only under /bundle and a /tmp that lasts one request. There is
  // no project folder, so a file the app ships next to it on Node (.next/BUILD_ID, a content folder) is not there:
  // request-path code that reads one handles Workers itself (docs/07-runtime-providers.md).
  "fs",
  "fs/promises",
  // workerd's node:http and node:https wrap fetch: no socket, so the `lookup` and `agent` options do nothing or are
  // refused (ERR_OPTION_NOT_IMPLEMENTED for `lookup`); a redirect comes back unfollowed and a body still encoded.
  "http",
  "https",
  // workerd has BlockList, isIP and SocketAddress; net.Server is not available.
  "net",
  "path",
  "process",
  "querystring",
  "stream",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "timers",
  "timers/promises",
  "url",
  "util",
  "zlib",
]);

/** Packages that need a Node process (an SDK that patches `node:http`, a native binding). */
export const NODE_ONLY_PACKAGES: ReadonlySet<string> = new Set(["@opentelemetry/sdk-node", "@opentelemetry/auto-instrumentations-node"]);

const BUILTINS = new Set(builtinModules);

/** The value imports of one source file: static, re-exports and dynamic `import("literal")`. */
export function listValueImports(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.isTypeOnly !== true) {
      if (!isAllTypeSpecifiers(node.importClause)) found.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      if (!isAllTypeExports(node.exportClause)) found.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument !== undefined && ts.isStringLiteral(argument)) found.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** `import { type A, type B } from "x"` brings no value; `import "x"` (no clause) runs the module, so it counts. */
function isAllTypeSpecifiers(clause: ts.ImportClause | undefined): boolean {
  if (clause === undefined || clause.name !== undefined) return false;
  const bindings = clause.namedBindings;
  return bindings !== undefined && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
}

function isAllTypeExports(clause: ts.NamedExportBindings | undefined): boolean {
  return clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly);
}

export type ImportKind =
  | { readonly kind: "relative" }
  | { readonly kind: "softure"; readonly packageName: string; readonly exportKey: string }
  | { readonly kind: "builtin"; readonly name: string; readonly isAllowed: boolean }
  | { readonly kind: "package"; readonly packageName: string; readonly isAllowed: boolean };

/** What an import specifier points at, and whether a Workers entry may import it. */
export function classifyImport(specifier: string): ImportKind {
  if (specifier.startsWith(".")) return { kind: "relative" };
  const bare = specifier.startsWith("node:") ? specifier.slice("node:".length) : specifier;
  if (specifier.startsWith("node:") || BUILTINS.has(bare)) return { kind: "builtin", name: bare, isAllowed: WORKERS_BUILTINS.has(bare) };
  const parts = specifier.split("/");
  const packageName = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
  const subpath = parts.slice(specifier.startsWith("@") ? 2 : 1).join("/");
  if (packageName.startsWith("@softure-ai/")) return { kind: "softure", packageName, exportKey: subpath === "" ? "." : `./${subpath}` };
  return { kind: "package", packageName, isAllowed: !NODE_ONLY_PACKAGES.has(packageName) };
}
