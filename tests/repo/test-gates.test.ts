import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { FULL_SUITE_PATTERNS } from "../../tools/config/src/cli/merge-push-scope-command.js";
import { findFullSuiteFile } from "../../scripts/test-changed.mjs";
import { REPO_ROOT } from "./repo-files.js";

// Where the test suite runs. CI runs all of it on master and the reached packages' tests on a pull request, split into
// parallel shards; the pre-push hook
// runs only the tests a branch can break, and the full suite when a change can break tests that do not import it.

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
