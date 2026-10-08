import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Issue #254: satori 0.35.2 and 0.36.0 crash the process as soon as they are imported (their yoga loader reads
 * `__dirname`, which ESM lacks). The CLI must load satori only for `og`, and the kit must pin one known-good satori,
 * since an app running the kit through `npx` has no lockfile of its own to hold one.
 */
const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;

function readSpecifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(STATIC_IMPORT)].map((match) => match[1] ?? "");
}

function resolveSource(from: string, specifier: string): string {
  const target = resolve(dirname(from), specifier);
  const candidates = [target.replace(/\.js$/, ".ts"), target.replace(/\.js$/, ".tsx"), join(target, "index.ts")];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error(`cannot resolve ${specifier} from ${from}`);
  return found;
}

/** Every package a module reaches through static imports, following relative imports into the kit's sources. */
function findStaticPackages(entry: string): Set<string> {
  const packages = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of readSpecifiers(file)) {
      if (specifier.startsWith(".")) queue.push(resolveSource(file, specifier));
      else packages.add(specifier);
    }
  }
  return packages;
}

describe("satori isolation (#254)", () => {
  it("keeps satori out of the CLI's static import graph", () => {
    expect(findStaticPackages(join(SRC, "cli", "main.ts")).has("satori")).toBe(false);
  });

  it("still finds satori behind the og command, so the walker sees it", () => {
    expect(findStaticPackages(join(SRC, "cli", "og.ts")).has("satori")).toBe(true);
  });

  it("pins satori to one exact version", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(manifest.dependencies.satori).toBe("0.35.1");
  });
});
