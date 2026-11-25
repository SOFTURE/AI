import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { FULL_SUITE_PATTERNS } from "../../tools/config/src/cli/merge-push-scope-command.js";
import { findFullSuiteFile, getPushTestScope, toVitestFilters } from "../../scripts/test-changed.mjs";
import { REPO_ROOT } from "./repo-files.js";

// Where the test suite runs. CI runs all of it on master and the reached packages' tests on a pull request, split into
// parallel shards; the pre-push hook
// runs only the tests a branch can break, and the CI scope of a change that can break tests that do not import it.

interface Job {
  name?: string;
  strategy?: { "fail-fast"?: boolean; matrix?: { shard?: number[] } };
  steps?: { name?: string; run?: string; env?: Record<string, string> }[];
}

describe("ci.yml → test", () => {
  const job = (parse(readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8")) as { jobs: Record<string, Job> })
    .jobs.test;
  const shards = job?.strategy?.matrix?.shard ?? [];

  it("runs its suite in shards numbered 1 to N, each one named: the whole suite, or a pull request's packages", () => {
    expect(shards.length).toBeGreaterThan(1);
    expect(shards).toEqual(shards.map((_, index) => index + 1));
    const step = job?.steps?.find((candidate) => candidate.name === "Test");
    expect(step?.env?.SHARD).toBe(`\${{ matrix.shard }}/${String(shards.length)}`);
    expect(step?.run).toContain('npm test -- --shard="$SHARD"\n');
    expect(step?.run).toContain('npm test -- --shard="$SHARD" --passWithNoTests $files');
    expect(job?.name).toContain(`\${{ matrix.shard }}/${String(shards.length)}`);
  });

  it("lets every shard finish, so one run names every red file", () => {
    expect(job?.strategy?.["fail-fast"]).toBe(false);
  });
});

describe("the pre-push hook", () => {
  const hooks = parse(readFileSync(join(REPO_ROOT, "lefthook.yml"), "utf8")) as {
    "pre-push": { jobs: { name: string; run: string }[] };
  };
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };

  it("runs the related tests through scripts/test-changed.mjs", () => {
    expect(hooks["pre-push"].jobs.map((job) => job.run)).toEqual(["npm run test:changed"]);
    expect(manifest.scripts["test:changed"]).toBe("tsx scripts/test-changed.mjs");
  });
});

describe("findFullSuiteFile", () => {
  it.each([
    "package.json",
    "modules/billing/package.json",
    "package-lock.json",
    "foundation/db/migrations/0003_limits.sql",
    "vitest.config.mts",
    "tsconfig.base.json",
    "lefthook.yml",
  ])("runs the full suite when %s changed", (file) => {
    expect(findFullSuiteFile(["modules/auth/src/index.ts", file], FULL_SUITE_PATTERNS)).toBe(file);
  });

  it("runs the related tests for source, test and document changes", () => {
    const files = ["modules/auth/src/index.ts", "modules/auth/tests/session.test.ts", "docs/02-module-standard.md"];
    expect(findFullSuiteFile(files, FULL_SUITE_PATTERNS)).toBeUndefined();
    expect(findFullSuiteFile([], FULL_SUITE_PATTERNS)).toBeUndefined();
  });
});

describe("getPushTestScope", () => {
  const packages = [
    { name: "@x/a", dir: "modules/a", dependencyNames: [] },
    { name: "@x/b", dir: "modules/b", dependencyNames: ["@x/a"] },
    { name: "@x/c", dir: "modules/c", dependencyNames: [] },
  ];
  const lockfile = (version: string, tool = "1.0.0"): unknown => ({
    packages: {
      "": { name: "root", devDependencies: { vitest: "^1.0.0" } },
      "node_modules/vitest": { version: tool },
      "modules/a": { name: "@x/a", version },
      "modules/b": { name: "@x/b", version: "1.0.0" },
      "modules/c": { name: "@x/c", version: "1.0.0" },
    },
  });
  const scopeOf = (files: string[], before: () => unknown, after: unknown = lockfile("1.0.1")) =>
    getPushTestScope({ files, packages, readBaseLockfile: before, readLockfile: () => after });

  it("runs the related tests when no manifest, lockfile, migration, setup or config changed", () => {
    expect(scopeOf(["modules/a/src/index.ts", "docs/README.md"], () => lockfile("1.0.0"))).toEqual({ kind: "related" });
  });

  it("runs the reached packages and their dependents, plus tests/, for a release version bump", () => {
    const scope = scopeOf(["modules/a/package.json", "modules/a/CHANGELOG.md", "package-lock.json"], () => lockfile("1.0.0"));
    expect(scope).toEqual({ kind: "paths", paths: ["tests/", "modules/a/", "modules/b/"], file: "modules/a/package.json" });
  });

  it("runs the reached package for a migration inside it", () => {
    const scope = scopeOf(["modules/c/migrations/0002_add.sql"], () => lockfile("1.0.0"));
    expect(scope).toEqual({ kind: "paths", paths: ["tests/", "modules/c/"], file: "modules/c/migrations/0002_add.sql" });
  });

  it.each([
    ["package.json"],
    ["vitest.config.mts"],
    ["tsconfig.json"],
  ])("runs the full suite when the shared root file %s changed", (file) => {
    expect(scopeOf([file], () => lockfile("1.0.0"))).toMatchObject({ kind: "all" });
  });

  it("runs the full suite when the lockfile changes a repository tool", () => {
    expect(scopeOf(["package-lock.json"], () => lockfile("1.0.1", "1.0.0"), lockfile("1.0.1", "2.0.0"))).toMatchObject({
      kind: "all",
    });
  });

  it("runs the full suite when the base lockfile cannot be read", () => {
    const scope = scopeOf(["modules/a/package.json", "package-lock.json"], () => {
      throw new Error("fatal: path not in the commit");
    });
    expect(scope).toMatchObject({ kind: "all" });
  });
});

describe("toVitestFilters", () => {
  it("names the root test files one by one, since a filter `tests/` matches every package's tests folder too", () => {
    expect(toVitestFilters(["tests/", "tools/host/"], ["tests/repo/links.test.ts", "tests/repo/test-gates.test.ts"])).toEqual([
      "tests/repo/links.test.ts",
      "tests/repo/test-gates.test.ts",
      "tools/host/",
    ]);
  });
});
