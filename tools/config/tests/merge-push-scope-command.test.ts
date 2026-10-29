import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_RELATED_COMMAND,
  getMergePushScope,
  globToRegExp,
  runMergePushScope,
  type MergePushScope,
} from "../src/cli/merge-push-scope-command.js";

let root: string;
let app: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: app, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function writeFile(path: string, text: string): void {
  mkdirSync(dirname(join(app, path)), { recursive: true });
  writeFileSync(join(app, path), text);
}

function commitFile(path: string, text: string): void {
  writeFile(path, text);
  git("add", "--all");
  git("commit", "-q", "-m", `change ${path}`);
}

/** Lands a commit on the remote main branch, as another merged pull request would, and fetches it. */
function landOnMain(path: string, text: string): void {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
  git("checkout", "-q", "main");
  commitFile(path, text);
  git("push", "-q", "origin", "main");
  git("checkout", "-q", branch);
}

function mergeMain(): void {
  git("merge", "-q", "--no-ff", "-m", "merge main", "origin/main");
}

function scopeOf(result: MergePushScope): string {
  return result.scope;
}

// An app with a remote, a pushed main branch and a pushed change branch `feature` that changes src/feature.ts.
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-merge-push-scope-"));
  app = join(root, "app");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(root, "remote.git")]);
  mkdirSync(app);
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("remote", "add", "origin", join(root, "remote.git"));
  commitFile("src/index.ts", "export const one = 1;\n");
  git("push", "-q", "-u", "origin", "main");
  git("checkout", "-q", "-b", "feature");
  commitFile("src/feature.ts", "export const feature = 1;\n");
  git("push", "-q", "-u", "origin", "feature");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("softure-merge-push-scope", () => {
  it("is a merge push when the push only merges the main branch in, and lists the branch's files", () => {
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();

    expect(getMergePushScope(app)).toEqual({ scope: "merge", mainRef: "origin/main", branchFiles: ["src/feature.ts"] });
  });

  it("stays a merge push with commits under context/ around the merge", () => {
    landOnMain("src/index.ts", "export const one = 2;\n");
    commitFile("context/changes/a/plan.md", "# Plan\n");
    mergeMain();
    commitFile("context/changes/a/plan.md", "# Plan, merged\n");

    expect(getMergePushScope(app)).toMatchObject({ scope: "merge", branchFiles: ["context/changes/a/plan.md", "src/feature.ts"] });
  });

  it("keeps the conflict resolution of the merge in the branch's files", () => {
    landOnMain("src/feature.ts", "export const feature = 2;\n");
    expect(() => git("merge", "-q", "--no-ff", "-m", "merge main", "origin/main")).toThrow();
    writeFile("src/feature.ts", "export const feature = 3;\n");
    git("add", "--all");
    git("commit", "-q", "--no-edit");

    expect(getMergePushScope(app)).toEqual({ scope: "merge", mainRef: "origin/main", branchFiles: ["src/feature.ts"] });
  });

  it("runs the full suite when the branch also pushes new code", () => {
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();
    commitFile("src/feature.ts", "export const feature = 2;\n");

    expect(getMergePushScope(app)).toMatchObject({ scope: "full", reason: expect.stringContaining("src/feature.ts") as string });
  });

  it("runs the full suite when a merge brings in a branch that is not on the main branch", () => {
    git("checkout", "-q", "-b", "other", "main");
    commitFile("src/other.ts", "export const other = 1;\n");
    git("checkout", "-q", "feature");
    git("merge", "-q", "--no-ff", "-m", "merge other", "other");

    expect(scopeOf(getMergePushScope(app))).toBe("full");
  });

  it("runs the full suite when a merge brings in local main-branch commits not yet on the remote", () => {
    git("checkout", "-q", "main");
    commitFile("src/index.ts", "export const one = 2;\n");
    git("checkout", "-q", "feature");
    git("merge", "-q", "--no-ff", "-m", "merge local main", "main");

    expect(scopeOf(getMergePushScope(app))).toBe("full");
  });

  it.each([
    ["a migration", "db/migrations/0002_add.sql"],
    ["a dependency manifest", "package.json"],
    ["a lockfile", "package-lock.json"],
    ["a nested manifest", "packages/a/package.json"],
    ["the test config", "vitest.config.mts"],
    ["a test setup file", "tests/setup-tests.ts"],
    ["the TypeScript config", "tsconfig.json"],
    ["the ESLint config", "eslint.config.mjs"],
    ["an env file", ".env.test"],
  ])("runs the full suite when the merge brings in %s", (_kind, path) => {
    landOnMain(path, "{}\n");
    mergeMain();

    expect(getMergePushScope(app)).toMatchObject({ scope: "full", reason: `the merge brings in ${path}` });
  });

  it("runs the full suite for an incoming file matching the app's own fullSuiteOn globs", () => {
    commitFile("package.json", JSON.stringify({ "@softure-ai/config": { fullSuiteOn: ["db/**/*.ts"] } }));
    git("push", "-q");
    landOnMain("db/seed/users.ts", "export const users = [];\n");
    mergeMain();

    expect(getMergePushScope(app)).toMatchObject({ scope: "full", reason: "the merge brings in db/seed/users.ts" });
  });

  it("runs the full suite when the push merges nothing", () => {
    commitFile("context/roadmap.md", "# Roadmap\n");

    expect(getMergePushScope(app)).toMatchObject({ scope: "full", reason: "the push merges nothing from origin/main" });
  });

  it("runs the full suite when there is nothing to push", () => {
    expect(scopeOf(getMergePushScope(app))).toBe("full");
  });

  it("runs the full suite for a branch without upstream", () => {
    git("checkout", "-q", "-b", "fresh");
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();

    expect(getMergePushScope(app)).toEqual({ scope: "full", reason: "the branch has no upstream" });
  });

  it("takes the main branch from context/workflow.json", () => {
    git("checkout", "-q", "-b", "develop", "main");
    git("push", "-q", "origin", "develop");
    git("checkout", "-q", "feature");
    commitFile("context/workflow.json", JSON.stringify({ mainBranch: "develop" }));
    git("push", "-q");
    git("checkout", "-q", "develop");
    commitFile("src/index.ts", "export const one = 2;\n");
    git("push", "-q", "origin", "develop");
    git("checkout", "-q", "feature");
    git("merge", "-q", "--no-ff", "-m", "merge develop", "origin/develop");

    expect(getMergePushScope(app)).toMatchObject({ scope: "merge", mainRef: "origin/develop" });
  });

  it("runs the full suite when the remote has no main branch it can find", () => {
    commitFile("context/workflow.json", JSON.stringify({ mainBranch: "trunk" }));
    git("push", "-q");

    expect(getMergePushScope(app)).toEqual({ scope: "full", reason: "no main branch found on origin" });
  });

  it("runs the full suite when git fails", () => {
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();
    const runGit = (args: readonly string[], cwd: string): string => {
      if (args[0] === "rev-list") throw new Error("git rev-list exited with 128");
      return execFileSync("git", args, { cwd, encoding: "utf8" });
    };

    expect(getMergePushScope(app, runGit)).toEqual({ scope: "full", reason: "git failed: git rev-list exited with 128" });
  });
});

describe("the softure-merge-push-scope bin", () => {
  const silent = (): void => undefined;

  it("answers is-merge and is-full through the exit code", () => {
    expect(runMergePushScope(["is-merge"], { cwd: app, log: silent })).toBe(1);
    expect(runMergePushScope(["is-full"], { cwd: app, log: silent })).toBe(0);
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();
    expect(runMergePushScope(["is-merge"], { cwd: app, log: silent })).toBe(0);
    expect(runMergePushScope(["is-full"], { cwd: app, log: silent })).toBe(1);
  });

  it("runs vitest related on the branch's files and returns its exit code", () => {
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();
    const calls: string[][] = [];
    const runCommand = (command: string, args: readonly string[]): number => {
      calls.push([command, ...args]);
      return 3;
    };

    expect(runMergePushScope(["related"], { cwd: app, runCommand, log: silent })).toBe(3);
    expect(calls).toEqual([[...DEFAULT_RELATED_COMMAND, "src/feature.ts"]]);
  });

  it("runs the app's own test command after --, with the files appended", () => {
    landOnMain("src/index.ts", "export const one = 2;\n");
    mergeMain();
    const calls: string[][] = [];
    const runCommand = (command: string, args: readonly string[]): number => {
      calls.push([command, ...args]);
      return 0;
    };

    runMergePushScope(["related", "--", "npx", "vitest", "related", "--run", "--project", "unit"], { cwd: app, runCommand, log: silent });
    expect(calls).toEqual([["npx", "vitest", "related", "--run", "--project", "unit", "src/feature.ts"]]);
  });

  it("runs nothing for related when the scope is full", () => {
    const runCommand = (): number => {
      throw new Error("must not run");
    };
    const lines: string[] = [];

    expect(runMergePushScope(["related"], { cwd: app, runCommand, log: (line) => lines.push(line) })).toBe(0);
    expect(lines).toEqual(["softure-merge-push-scope: full suite (the push brings no commit of the branch); the test job runs it."]);
  });

  it("rejects an unknown mode", () => {
    expect(runMergePushScope([], { cwd: app, log: silent })).toBe(2);
    expect(runMergePushScope(["merge"], { cwd: app, log: silent })).toBe(2);
  });
});

describe("globToRegExp", () => {
  it.each([
    ["db/**", "db/seed/users.ts", true],
    ["db/**/*.ts", "db/users.ts", true],
    ["db/**/*.ts", "db/seed/users.ts", true],
    ["db/**/*.ts", "dbx/users.ts", false],
    ["*.sql", "schema.sql", true],
    ["*.sql", "db/schema.sql", false],
    ["**/*.sql", "db/schema.sql", true],
    ["scripts/seed?.ts", "scripts/seed1.ts", true],
    ["config.json", "configXjson", false],
  ])("%s matches %s: %s", (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });
});
