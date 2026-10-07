// Architecture and shape rules for every workspace package, run once for all of them
// (docs/02-module-standard.md §2, §10, §11). A new package is covered by being created.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";
import { findWorkspaces } from "../../scripts/build-workspaces.mjs";
import { checkManifest } from "../../scripts/release/release-rules.mjs";
import { REPO_ROOT } from "./repo-files.js";

const SOURCE_CONDITION = "@softure-ai/source";
// One copy per app: two copies mean two token sets and two theme / locale contexts.
const UI_PACKAGE = "@softure-ai/ui";
const TEMPLATE_DIR = "templates/package";
// The template folder is named for what it is; its package name says what it becomes.
const EXPECTED_NAMES: Record<string, string> = { [TEMPLATE_DIR]: "@softure-ai/template-module" };

interface PackageManifest {
  name?: unknown;
  version?: unknown;
  type?: unknown;
  files?: unknown;
  engines?: { node?: unknown };
  scripts?: { build?: unknown };
  exports?: Record<string, unknown>;
  sideEffects?: unknown;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readManifest(dir: string): PackageManifest {
  return JSON.parse(readFileSync(join(REPO_ROOT, dir, "package.json"), "utf8")) as PackageManifest;
}

function getExpectedName(dir: string): string {
  return EXPECTED_NAMES[dir] ?? `@softure-ai/${dir.split("/").at(-1) ?? dir}`;
}

function isModule(dir: string): boolean {
  return dir.startsWith("modules/") || dir === TEMPLATE_DIR;
}

/** Every key path of a nested dictionary, e.g. `example.title`. */
function listKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => listKeyPaths(child, prefix ? `${prefix}.${key}` : key));
}

const packageDirs = findWorkspaces(REPO_ROOT).map((pkg) => pkg.dir);
const workspaceVersions = new Map(
  packageDirs.map((dir) => {
    const manifest = readManifest(dir) as { name: string; version: string };
    return [manifest.name, manifest.version];
  }),
);

/** Package names of the modules (folders with a module.json), the ones a manifest's dependsOn can name. */
const MODULE_PACKAGE_NAMES = new Set(
  packageDirs.filter((dir) => dir.startsWith("modules/") && existsSync(join(REPO_ROOT, dir, "module.json"))).map(getExpectedName),
);

function readModuleVersion(dir: string): string | null {
  const path = join(REPO_ROOT, dir, "module.json");
  if (!existsSync(path)) return null;
  return String((JSON.parse(readFileSync(path, "utf8")) as { version?: unknown }).version);
}

describe("workspace packages", () => {
  it("include the template, so the rules run before the first real package exists", () => {
    expect(packageDirs).toContain(TEMPLATE_DIR);
  });

  describe.each(packageDirs)("%s", (dir) => {
    const manifest = readManifest(dir);

    it("is an ESM package named after its folder, for Node 22, publishing dist/", () => {
      expect(manifest.name).toBe(getExpectedName(dir));
      expect(manifest.type).toBe("module");
      expect(manifest.engines?.node).toBe(">=22");
      expect(manifest.files).toContain("dist");
    });

    it("passes the release manifest rules, so a tag can publish it (scripts/release/README.md)", () => {
      const problems = checkManifest({
        manifest: manifest as Record<string, unknown>,
        dir,
        version: String(manifest.version),
        moduleVersion: readModuleVersion(dir),
        workspaceVersions,
        // Private packages (the template) are never published, but keep the publishable shape.
        allowPrivate: true,
      });
      expect(problems).toEqual([]);
    });

    it("builds with tsc from its own tsconfig.build.json", () => {
      // A package with styles appends its CSS step (`tsc -p tsconfig.build.json && …`).
      expect(manifest.scripts?.build).toMatch(/^tsc -p tsconfig\.build\.json(?: && .+)?$/);
      expect(existsSync(join(REPO_ROOT, dir, "tsconfig.json"))).toBe(true);
      expect(existsSync(join(REPO_ROOT, dir, "tsconfig.build.json"))).toBe(true);
      expect(existsSync(join(REPO_ROOT, dir, "README.md"))).toBe(true);
    });

    it("exports every code entry as source, then types, then the built file", () => {
      const codeExports = Object.entries(manifest.exports ?? {}).filter(([, target]) => typeof target === "object");
      expect(codeExports.length).toBeGreaterThan(0);
      for (const [entry, target] of codeExports) {
        const conditions = target as Record<string, string>;
        expect(Object.keys(conditions), entry).toEqual([SOURCE_CONDITION, "types", "default"]);
        const source = conditions[SOURCE_CONDITION] ?? "";
        expect(source, entry).toMatch(/^\.\/src\/.+\.tsx?$/);
        expect(existsSync(join(REPO_ROOT, dir, source)), `${entry} -> ${source}`).toBe(true);
        const built = source.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, "");
        expect(conditions.types, entry).toBe(`${built}.d.ts`);
        expect(conditions.default, entry).toBe(`${built}.js`);
      }
    });

    const stylesheets = Object.values(manifest.exports ?? {}).filter(
      (target): target is string => typeof target === "string" && target.endsWith(".css"),
    );
    it.runIf(stylesheets.length > 0)("marks its stylesheets as side effects, so a bundler keeps a CSS import", () => {
      expect(manifest.sideEffects).toEqual(expect.arrayContaining(["*.css"]));
    });

    it.runIf(manifest.name !== UI_PACKAGE)(`takes ${UI_PACKAGE} as a peer, so the app keeps one copy`, () => {
      expect(Object.keys(manifest.dependencies ?? {})).not.toContain(UI_PACKAGE);
      if (manifest.peerDependencies?.[UI_PACKAGE] !== undefined) {
        expect(Object.keys(manifest.devDependencies ?? {})).toContain(UI_PACKAGE);
      }
    });

    it.runIf(isModule(dir))("has a module.json manifest and the twelve README sections", () => {
      const manifestJson = JSON.parse(readFileSync(join(REPO_ROOT, dir, "module.json"), "utf8")) as { id?: unknown };
      expect(manifestJson.id).toBe(getExpectedName(dir).replace("@softure-ai/", ""));
      const readme = readFileSync(join(REPO_ROOT, dir, "README.md"), "utf8");
      const sections = [...readme.matchAll(/^## (\d+)\. /gm)].map((match) => Number(match[1]));
      expect(sections).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it.runIf(isModule(dir))("names every module it depends on as a package in its dependsOn", () => {
      const manifestJson = JSON.parse(readFileSync(join(REPO_ROOT, dir, "module.json"), "utf8")) as { dependsOn?: Record<string, string> };
      const packageModules = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
        .filter((name) => MODULE_PACKAGE_NAMES.has(name))
        .map((name) => name.replace("@softure-ai/", ""))
        .sort();
      const named = Object.keys(manifestJson.dependsOn ?? {});
      expect(packageModules.filter((id) => !named.includes(id))).toEqual([]);
    });

    const messagesDir = join(REPO_ROOT, dir, "src/messages");
    it.runIf(existsSync(join(messagesDir, "en.ts")) || existsSync(join(messagesDir, "pl.ts")))(
      "has pl and en dictionaries with the same keys",
      async () => {
        const { en } = (await import(pathToFileURL(join(messagesDir, "en.ts")).href)) as { en: unknown };
        const { pl } = (await import(pathToFileURL(join(messagesDir, "pl.ts")).href)) as { pl: unknown };
        expect(listKeyPaths(pl).sort()).toEqual(listKeyPaths(en).sort());
      },
    );
  });
});

describe("the template build", () => {
  const outDir = mkdtempSync(join(tmpdir(), "softure-template-build-"));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it("emits ESM and declarations per file and keeps the use server directive", () => {
    const tsc = join(REPO_ROOT, "node_modules/.bin/tsc");
    execFileSync(tsc, ["-p", join(REPO_ROOT, TEMPLATE_DIR, "tsconfig.build.json"), "--outDir", outDir]);
    for (const file of ["index.js", "index.d.ts", "server/index.js", "server/index.d.ts", "ui/index.js"]) {
      expect(existsSync(join(outDir, file)), file).toBe(true);
    }
    const action = readFileSync(join(outDir, "next/actions.js"), "utf8");
    expect(action.startsWith('"use server";')).toBe(true);
    expect(readFileSync(join(outDir, "index.js"), "utf8")).toContain('from "./messages/index.js"');
  });
});

describe("import boundaries (NFR-3)", () => {
  const eslint = new ESLint({ cwd: REPO_ROOT });

  async function getRuleIds(file: string): Promise<(string | null)[]> {
    const [result] = await eslint.lintText('import { headers } from "next/headers";\nexport { headers };\n', {
      filePath: join(REPO_ROOT, TEMPLATE_DIR, file),
    });
    return result?.messages.map((message) => message.ruleId) ?? [];
  }

  it("rejects next/* in server/ and ui/", async () => {
    expect(await getRuleIds("src/server/index.ts")).toContain("no-restricted-imports");
    expect(await getRuleIds("src/ui/index.ts")).toContain("no-restricted-imports");
  });

  it("allows next/* in the next/ adapter", async () => {
    expect(await getRuleIds("src/next/index.ts")).not.toContain("no-restricted-imports");
  });
});
