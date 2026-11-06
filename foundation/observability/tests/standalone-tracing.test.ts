import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(import.meta.dirname, "..");
const START_SOURCE = readFileSync(join(PACKAGE_ROOT, "src/node/start.ts"), "utf8");
const MANIFEST = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
// A rolldown helper (`__require("x")`) hides a module from Next.js output file tracing.
const HIDDEN_REQUIRE = /__require\("([^"]+)"\)/g;

function listModuleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => join(entry.parentPath, entry.name));
}

// Node's lookup order for an installed package: this package's node_modules first, then each parent's.
function findInstalledPackage(name: string): string {
  for (let directory = PACKAGE_ROOT; directory !== dirname(directory); directory = dirname(directory)) {
    const candidate = join(directory, "node_modules", name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`findInstalledPackage: ${name} is not installed above ${PACKAGE_ROOT}`);
}

function findHiddenRequires(): { hidden: Map<string, string>; scanned: number } {
  const hidden = new Map<string, string>();
  let scanned = 0;
  for (const name of Object.keys(MANIFEST.dependencies).filter((dependency) => dependency.startsWith("@opentelemetry/"))) {
    const distDirectory = join(findInstalledPackage(name), "dist");
    for (const file of listModuleFiles(distDirectory)) {
      scanned += 1;
      for (const match of readFileSync(file, "utf8").matchAll(HIDDEN_REQUIRE)) {
        hidden.set(match[1] ?? "", name);
      }
    }
  }
  return { hidden, scanned };
}

describe("standalone output tracing", () => {
  it("requires every module an OpenTelemetry dependency loads through a hidden require", () => {
    // instrumentation-http 0.300 hid `forwarded-parse` this way; 0.301 imports it statically, which tracing follows.
    const { hidden, scanned } = findHiddenRequires();

    expect(scanned).toBeGreaterThan(0);
    for (const [module, owner] of hidden) {
      expect(START_SOURCE, `${owner} hides ${module}`).toMatch(new RegExp(`^\\s*require\\("${module}"\\);$`, "m"));
      expect(MANIFEST.dependencies[module], `${module} is a dependency`).toBeDefined();
    }
  });
});
