import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..", "..", "src");
const IMPORT = /^(?:import|export) (?!type )[^;]*from "([^"]+)";?$/gm;

/** Every module `entry` loads at run time (type-only imports and re-exports are erased), and the packages they name. */
function collectImports(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const [, specifier = ""] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      if (!specifier.startsWith(".")) {
        packages.add(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
      if (existsSync(target)) visit(target);
    }
  };
  visit(entry);
  return { files: [...files].map((file) => relative(SRC, file)), packages: [...packages] };
}

describe("@softure-ai/marketing-kit/og", () => {
  // A Next route imports this entry; it must not pull in a browser or the film pipeline.
  it("loads neither Playwright nor the recorder, the renderer or the CLI", () => {
    const { files, packages } = collectImports(join(SRC, "og", "index.ts"));
    expect(files.filter((file) => /^(?:record|render|cli|screenshot)\//.test(file))).toEqual([]);
    expect(packages.filter((name) => name === "playwright" || name === "hyperframes" || name === "gsap")).toEqual([]);
    expect(packages).toContain("satori");
  });
});
