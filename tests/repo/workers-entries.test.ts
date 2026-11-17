// Every export a package declares Workers-safe (`"softure": { "workers": [...] }` in its package.json) reaches only
// the Node builtins Cloudflare Workers provide and only Workers entries of other SOFTURE packages
// (docs/07-runtime-providers.md).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { listRepoFiles, REPO_ROOT } from "./repo-files.js";
import { classifyImport, listValueImports } from "./workers-entries.js";

interface PackageInfo {
  readonly dir: string;
  readonly name: string;
  readonly exports: Record<string, unknown>;
  readonly workers: readonly string[];
}

const PACKAGES: readonly PackageInfo[] = listRepoFiles()
  .filter((file) => /^(foundation|modules|themes|tools)\/[^/]+\/package\.json$/.test(file))
  .map((file) => {
    const json = JSON.parse(readFileSync(join(REPO_ROOT, file), "utf8")) as {
      name: string;
      exports?: Record<string, unknown>;
      softure?: { workers?: string[] };
    };
    return { dir: dirname(file), name: json.name, exports: json.exports ?? {}, workers: json.softure?.workers ?? [] };
  });

const BY_NAME = new Map(PACKAGES.map((info) => [info.name, info]));

function getSourceEntry(info: PackageInfo, exportKey: string): string | undefined {
  const target = info.exports[exportKey];
  if (typeof target !== "object" || target === null) return undefined;
  const source = (target as Record<string, unknown>)["@softure-ai/source"];
  return typeof source === "string" ? join(info.dir, source) : undefined;
}

function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = join(dirname(fromFile), specifier);
  const stem = base.replace(/\.(m?js|jsx)$/, "");
  const candidates = [base, `${stem}.ts`, `${stem}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => /\.tsx?$/.test(candidate) && existsSync(join(REPO_ROOT, candidate)));
}

/** Every violation reachable from one Workers entry, as `<file>: <what>`. */
function findEntryProblems(info: PackageInfo, exportKey: string): string[] {
  const entry = getSourceEntry(info, exportKey);
  if (entry === undefined) return [`${info.name}: "${exportKey}" is listed in softure.workers but has no @softure-ai/source export`];
  const problems: string[] = [];
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string; // the loop condition guarantees an element
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of listValueImports(file, readFileSync(join(REPO_ROOT, file), "utf8"))) {
      const target = classifyImport(specifier);
      if (target.kind === "relative") {
        const resolved = resolveRelative(file, specifier);
        if (resolved !== undefined) queue.push(resolved);
      } else if (target.kind === "builtin" && !target.isAllowed) {
        problems.push(`${file}: imports node:${target.name}, which Workers do not provide`);
      } else if (target.kind === "package" && !target.isAllowed) {
        problems.push(`${file}: imports ${target.packageName}, which needs a Node process`);
      } else if (target.kind === "softure") {
        const dependency = BY_NAME.get(target.packageName);
        if (dependency !== undefined && !dependency.workers.includes(target.exportKey)) {
          problems.push(`${file}: imports ${specifier}, which ${target.packageName} does not list in softure.workers`);
        }
      }
    }
  }
  return problems;
}

describe("Workers-safe package entries", () => {
  it("are declared by at least core", () => {
    expect(BY_NAME.get("@softure-ai/core")?.workers).toEqual([".", "./next", "./og"]);
  });

  for (const info of PACKAGES.filter((candidate) => candidate.workers.length > 0)) {
    it.each(info.workers.map((exportKey) => [exportKey]))(`${info.name} %s reaches only Workers-safe imports`, (exportKey) => {
      expect(findEntryProblems(info, exportKey)).toEqual([]);
    });
  }
});

describe("Module manifests", () => {
  // defineSoftureConfig refuses a module whose manifest lacks the workers runtime in an app on Cloudflare, so a module
  // whose root entry is Workers-safe must say so in its manifest too, and the other way round.
  for (const info of PACKAGES.filter((candidate) => existsSync(join(REPO_ROOT, candidate.dir, "module.json")))) {
    it(`${info.name} declares the workers runtime exactly when its root entry is Workers-safe`, () => {
      const manifest = JSON.parse(readFileSync(join(REPO_ROOT, info.dir, "module.json"), "utf8")) as { runtimes?: string[] };
      expect((manifest.runtimes ?? ["node"]).includes("workers")).toBe(info.workers.includes("."));
    });
  }
});
