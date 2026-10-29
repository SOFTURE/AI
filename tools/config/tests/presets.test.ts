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
  skip?: { run: string }[];
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
    expect(hooks["pre-push"]?.jobs.map((job) => job.name)).toEqual(["typecheck", "lint", "language", "test", "test-related"]);
    expect(getRuns("pre-push").test).toBe("npm test");
    expect(getRuns("pre-push")["test-related"]).toBe("npx softure-merge-push-scope related");
  });

  it("skips typecheck, lint and tests, not the language gate, for a push that changes only context/", () => {
    const skips = Object.fromEntries((hooks["pre-push"]?.jobs ?? []).map((job) => [job.name, job.skip]));
    const contextOnly = { run: "npx softure-context-only-push" };
    expect(skips).toEqual({
      typecheck: [contextOnly],
      lint: [contextOnly],
      language: undefined,
      test: [contextOnly, { run: "npx softure-merge-push-scope is-merge" }],
      "test-related": [{ run: "npx softure-merge-push-scope is-full" }],
    });
  });

  describe("run by lefthook for each kind of push", () => {
    // The preset with every command replaced: a job prints its name, a skip condition answers as the case says.
    // This pins lefthook's own semantics: one passing skip entry skips the job, a failing one does not.
    const cacheDir = join(REPO_ROOT, "node_modules/.cache");
    mkdirSync(cacheDir, { recursive: true });
    const appDir = mkdtempSync(join(cacheDir, "softure-config-lefthook-run-"));
    const git = (...args: string[]): string => execFileSync("git", args, { cwd: appDir, encoding: "utf8" });
    git("init", "-q");
    writeFileSync(join(appDir, "index.ts"), "export const one = 1;\n");
    git("add", "index.ts");
    git("-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-q", "-m", "start");
    // What git writes to a pre-push hook's stdin for a new branch; without it lefthook sees no pushed files and skips.
    const pushLine = `refs/heads/feature ${git("rev-parse", "HEAD").trim()} refs/heads/feature ${"0".repeat(40)}\n`;
    afterAll(() => rmSync(appDir, { recursive: true, force: true }));

    const runPrePush = (answers: Record<string, boolean>): string[] => {
      const prePush = structuredClone(hooks["pre-push"]);
      for (const job of prePush?.jobs ?? []) {
        job.run = `echo ran-${job.name}`;
        for (const condition of job.skip ?? []) {
          const answer = answers[condition.run];
          if (answer === undefined) throw new Error(`no answer for the skip condition ${condition.run}`);
          condition.run = answer ? "true" : "false";
        }
      }
      writeFileSync(join(appDir, "lefthook.yml"), JSON.stringify({ "pre-push": prePush }));
      const lefthook = join(REPO_ROOT, "node_modules/.bin/lefthook");
      const output = execFileSync(lefthook, ["run", "pre-push", "--no-auto-install"], { cwd: appDir, encoding: "utf8", input: pushLine });
      return [...output.matchAll(/^ran-([a-z-]+)$/gm)].map((match) => match[1] ?? "");
    };
    const CONTEXT_ONLY = "npx softure-context-only-push";
    const IS_MERGE = "npx softure-merge-push-scope is-merge";
    const IS_FULL = "npx softure-merge-push-scope is-full";

    it("runs every gate and the whole suite for a push of new code", () => {
      expect(runPrePush({ [CONTEXT_ONLY]: false, [IS_MERGE]: false, [IS_FULL]: true })).toEqual(["typecheck", "lint", "language", "test"]);
    });

    it("runs every gate and only the related tests for a push that only merges the main branch in", () => {
      expect(runPrePush({ [CONTEXT_ONLY]: false, [IS_MERGE]: true, [IS_FULL]: false })).toEqual([
        "typecheck",
        "lint",
        "language",
        "test-related",
      ]);
    });

    it("runs the language gate alone for a push that changes only context/", () => {
      expect(runPrePush({ [CONTEXT_ONLY]: true, [IS_MERGE]: false, [IS_FULL]: true })).toEqual(["language"]);
    });

    it("runs the whole suite when the scope bin fails on both questions", () => {
      expect(runPrePush({ [CONTEXT_ONLY]: false, [IS_MERGE]: false, [IS_FULL]: false })).toEqual([
        "typecheck",
        "lint",
        "language",
        "test",
        "test-related",
      ]);
    });
  });

  describe("with one job changed by an app", () => {
    // A scratch app inside the repository's node_modules, with the preset where an installed package puts it.
    const cacheDir = join(REPO_ROOT, "node_modules/.cache");
    mkdirSync(cacheDir, { recursive: true });
    const appDir = mkdtempSync(join(cacheDir, "softure-config-lefthook-"));
    const presetDir = join(appDir, "node_modules/@softure-ai/config/presets");
    mkdirSync(presetDir, { recursive: true });
    writeFileSync(join(presetDir, "lefthook.yml"), readFileSync(join(PACKAGE_DIR, "presets/lefthook.yml")));
    execFileSync("git", ["init", "-q"], { cwd: appDir });
    afterAll(() => rmSync(appDir, { recursive: true, force: true }));

    const NEXT_TYPECHECK = "npx next typegen && npx tsc --noEmit";
    const PRESET = "node_modules/@softure-ai/config/presets/lefthook.yml";
    const CHANGED_JOBS = `pre-commit:\n  jobs:\n    - name: typecheck\n      run: ${NEXT_TYPECHECK}\npre-push:\n  jobs:\n    - name: typecheck\n      run: ${NEXT_TYPECHECK}\n`;

    const dumpMerged = (): Lefthook => {
      const lefthook = join(REPO_ROOT, "node_modules/.bin/lefthook");
      return JSON.parse(execFileSync(lefthook, ["dump", "--format", "json"], { cwd: appDir, encoding: "utf8" })) as Lefthook;
    };
    const getMergedRuns = (merged: Lefthook, hook: string): Record<string, string> =>
      Object.fromEntries((merged[hook]?.jobs ?? []).map((job) => [job.name, job.run]));

    it("takes the app's job from a file listed after the preset in extends, keeping the other jobs and their order", () => {
      writeFileSync(join(appDir, "lefthook.yml"), `extends:\n  - ${PRESET}\n  - lefthook.app.yml\n`);
      writeFileSync(join(appDir, "lefthook.app.yml"), CHANGED_JOBS);
      const merged = dumpMerged();
      expect(getMergedRuns(merged, "pre-commit")).toEqual({ ...getRuns("pre-commit"), typecheck: NEXT_TYPECHECK });
      expect(getMergedRuns(merged, "pre-push")).toEqual({ ...getRuns("pre-push"), typecheck: NEXT_TYPECHECK });
      expect(merged["pre-push"]?.jobs.map((job) => job.name)).toEqual(["typecheck", "lint", "language", "test", "test-related"]);
      expect(merged["pre-push"]?.piped).toBe(true);
    });

    it("keeps the preset's run for a job the app redefines in its own lefthook.yml, as the README warns", () => {
      writeFileSync(join(appDir, "lefthook.yml"), `extends:\n  - ${PRESET}\n${CHANGED_JOBS}`);
      rmSync(join(appDir, "lefthook.app.yml"), { force: true });
      expect(getMergedRuns(dumpMerged(), "pre-push").typecheck).toBe("npx tsc --noEmit");
    });
  });

  it("calls the bin the package ships", () => {
    const manifest = readJson<{ bin: Record<string, string> }>(join(PACKAGE_DIR, "package.json"));
    expect(Object.keys(manifest.bin)).toEqual(["softure-check-language", "softure-context-only-push", "softure-merge-push-scope"]);
  });
});
