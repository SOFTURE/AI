import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

const PACKAGE_DIR = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = join(PACKAGE_DIR, "../..");

interface TsConfig {
  compilerOptions: Record<string, unknown>;
}

interface LefthookJob {
  name: string;
  run: string;
  glob?: string;
}

type Lefthook = Record<string, { parallel?: boolean; piped?: boolean; jobs: LefthookJob[] }>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("the tsconfig preset", () => {
  const preset = readJson<TsConfig>(join(PACKAGE_DIR, "presets/tsconfig.json"));

  it("targets what the packages are built and tested for", () => {
    const base = readJson<TsConfig>(join(REPO_ROOT, "tsconfig.base.json"));
    expect(preset.compilerOptions.target).toBe(base.compilerOptions.target);
    expect(preset.compilerOptions.lib).toEqual(base.compilerOptions.lib);
  });

  it("matches every compiler option of the example app, so the two cannot drift", () => {
    const exampleApp = readJson<TsConfig>(join(REPO_ROOT, "examples/next-app/tsconfig.json"));
    for (const [option, value] of Object.entries(preset.compilerOptions)) {
      expect(exampleApp.compilerOptions[option], option).toEqual(value);
    }
  });

  describe("extended by an app through the package export", () => {
    // Inside the repository's node_modules, so `@softure-ai/config` resolves like in an installed app.
    const cacheDir = join(REPO_ROOT, "node_modules/.cache");
    mkdirSync(cacheDir, { recursive: true });
    const appDir = mkdtempSync(join(cacheDir, "softure-config-tsconfig-"));
    afterAll(() => rmSync(appDir, { recursive: true, force: true }));

    it("resolves @softure-ai/config/tsconfig.json and keeps its options", () => {
      writeFileSync(join(appDir, "tsconfig.json"), JSON.stringify({ extends: "@softure-ai/config/tsconfig.json", include: ["*.ts"] }));
      writeFileSync(join(appDir, "index.ts"), "export const ok = 1;\n");
      const tsc = join(REPO_ROOT, "node_modules/.bin/tsc");
      const shown = JSON.parse(execFileSync(tsc, ["--showConfig", "-p", appDir], { encoding: "utf8" })) as TsConfig;
      expect(shown.compilerOptions.target).toBe("es2023");
      expect(shown.compilerOptions.moduleResolution).toBe("bundler");
      expect(shown.compilerOptions.strict).toBe(true);
    });
  });
});

describe("the lefthook preset", () => {
  const hooks = parse(readFileSync(join(PACKAGE_DIR, "presets/lefthook.yml"), "utf8")) as Lefthook;
  const getRuns = (hook: string): Record<string, string> =>
    Object.fromEntries((hooks[hook]?.jobs ?? []).map((job) => [job.name, job.run]));

  it("checks types, the staged files with ESLint and the language gate before a commit", () => {
    expect(hooks["pre-commit"]?.parallel).toBe(true);
    expect(getRuns("pre-commit")).toEqual({
      typecheck: "npx tsc --noEmit",
      lint: "npx eslint {staged_files} --max-warnings 0 --no-warn-ignored",
      language: "npx softure-check-language {staged_files}",
    });
  });

  it("checks the commit message with the language gate", () => {
    expect(getRuns("commit-msg")).toEqual({ language: "npx softure-check-language --commit-msg {1}" });
  });

  it("runs typecheck, lint, the language gate and the tests before a push, stopping at the first failure", () => {
    expect(hooks["pre-push"]?.piped).toBe(true);
    expect(hooks["pre-push"]?.jobs.map((job) => job.name)).toEqual(["typecheck", "lint", "language", "test"]);
    expect(getRuns("pre-push").test).toBe("npm test");
  });

  it("calls the bin the package ships", () => {
    const manifest = readJson<{ bin: Record<string, string> }>(join(PACKAGE_DIR, "package.json"));
    expect(Object.keys(manifest.bin)).toEqual(["softure-check-language"]);
  });
});
