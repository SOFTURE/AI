// The pack step of the release workflow, run on a copy of the real template (scripts/release/README.md).
// A copy, because packing writes into the package folder (the LICENSE) and the build writes `dist/`,
// while other repository tests list and read the files of this checkout in parallel.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { packPackage, readReleasePackages } from "../../scripts/release/pack.mjs";
import { REPO_ROOT } from "./repo-files.js";

const TEMPLATE_DIR = "templates/package";

/** A minimal repository holding the template, with this checkout's toolchain linked in. */
function createTemplateRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "softure-release-pack-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "copy", private: true, workspaces: ["templates/*"] }));
  for (const file of ["LICENSE", "tsconfig.base.json"]) cpSync(join(REPO_ROOT, file), join(root, file));
  symlinkSync(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "dir");
  mkdirSync(join(root, "templates"));
  cpSync(join(REPO_ROOT, TEMPLATE_DIR), join(root, TEMPLATE_DIR), {
    recursive: true,
    filter: (source) => !source.includes("/dist") && !source.endsWith("/LICENSE"),
  });
  return root;
}

describe("packPackage on the template", () => {
  const root = createTemplateRepository();
  const outDir = join(root, "out");
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const packages = readReleasePackages(root);
  const template = packages.find((pkg) => pkg.dir === TEMPLATE_DIR);
  if (!template) throw new Error(`Reading workspaces: ${TEMPLATE_DIR} is missing`);
  const workspaceVersions = new Map(packages.map((pkg) => [pkg.name, String(pkg.manifest.version)]));

  function packTemplate(allowPrivate: boolean) {
    if (!template) throw new Error(`Reading workspaces: ${TEMPLATE_DIR} is missing`);
    return packPackage({
      root,
      pkg: template,
      version: String(template.manifest.version),
      allowPrivate,
      outDir,
      workspaceVersions,
    });
  }

  function listTarball(tarball: string): string[] {
    return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^package\//, ""));
  }

  // Same command as the template's `build` script: the tarball ships `dist/`.
  execFileSync(join(REPO_ROOT, "node_modules/.bin/tsc"), ["-p", join(root, TEMPLATE_DIR, "tsconfig.build.json")]);

  it("packs a dry run with no problems: build, sources, license, no tests", () => {
    const { tarball, problems } = packTemplate(true);
    expect(problems).toEqual([]);
    const files = listTarball(tarball);
    expect(files).toEqual(expect.arrayContaining(["dist/index.js", "dist/index.js.map", "src/index.ts", "LICENSE", "module.json"]));
    expect(files.filter((file) => file.startsWith("tests/") || file.endsWith(".test.ts"))).toEqual([]);
  });

  it("removes the LICENSE it copied into the package folder", () => {
    packTemplate(true);
    expect(existsSync(join(root, TEMPLATE_DIR, "LICENSE"))).toBe(false);
  });

  it("refuses to release the private template", () => {
    expect(packTemplate(false).problems).toEqual([expect.stringContaining('"private": true')]);
  });
});

describe("the pack command", () => {
  const root = createTemplateRepository();
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const script = join(REPO_ROOT, "scripts/release/pack.mjs");

  // A publishable package: the template without "private", at version 0.1.0 in both manifests.
  for (const file of ["package.json", "module.json"]) {
    const path = join(root, TEMPLATE_DIR, file);
    const text = readFileSync(path, "utf8").replace('"version": "0.0.0"', '"version": "0.1.0"');
    writeFileSync(path, text.replace('  "private": true,\n', ""));
  }
  execFileSync(join(REPO_ROOT, "node_modules/.bin/tsc"), ["-p", join(root, TEMPLATE_DIR, "tsconfig.build.json")]);

  function runPack(args: string[], env: Record<string, string> = {}) {
    try {
      const stdout = execFileSync("node", [script, "--root", root, "--out", join(root, "out"), ...args], {
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env, GITHUB_OUTPUT: "", ...env },
      });
      return { status: 0, output: stdout };
    } catch (error) {
      const failed = error as { status: number; stdout: string; stderr: string };
      return { status: failed.status, output: failed.stdout + failed.stderr };
    }
  }

  it("writes the outputs the release workflow reads for a stable tag", () => {
    const outputFile = join(root, "github-output");
    writeFileSync(outputFile, "");
    expect(runPack(["--tag", "template-module@0.1.0"], { GITHUB_OUTPUT: outputFile }).status).toBe(0);
    expect(readFileSync(outputFile, "utf8").split("\n").filter(Boolean)).toEqual([
      "tarball=softure-ai-template-module-0.1.0.tgz",
      "name=@softure-ai/template-module",
      "short-name=template-module",
      "version=0.1.0",
      "npm-tag=",
      "prerelease=false",
    ]);
  });

  it("refuses a tag whose version is not the package version", () => {
    const result = runPack(["--tag", "template-module@0.2.0"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("the tag says 0.2.0");
  });

  it("names the known packages when a dry run asks for a missing one", () => {
    const result = runPack(["--package", "missing", "--dry-run"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("@softure-ai/missing");
    expect(result.output).toContain("@softure-ai/template-module");
  });
});
