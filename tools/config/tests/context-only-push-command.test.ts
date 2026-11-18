import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isContextOnlyPush,
  listPushedFiles,
  parseSinceOption,
  runContextOnlyPush,
} from "../src/cli/context-only-push-command.js";

let root: string;
let app: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: app, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function commitFile(path: string, text: string): void {
  mkdirSync(dirname(join(app, path)), { recursive: true });
  writeFileSync(join(app, path), text);
  git("add", "--all");
  git("commit", "-q", "-m", `change ${path}`);
}

// An app with a remote and a pushed main branch; each test commits on top.
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-context-only-push-"));
  app = join(root, "app");
  execFileSync("git", ["init", "-q", "--bare", join(root, "remote.git")]);
  mkdirSync(app);
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("remote", "add", "origin", join(root, "remote.git"));
  commitFile("src/index.ts", "export const one = 1;\n");
  git("push", "-q", "-u", "origin", "main");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("softure-context-only-push", () => {
  it("is a context-only push when every pushed file is under context/", () => {
    commitFile("context/roadmap.md", "# Roadmap\n");
    commitFile("context/changes/a/plan.md", "# Plan\n");

    expect(listPushedFiles(app)).toEqual(["context/changes/a/plan.md", "context/roadmap.md"]);
    expect(isContextOnlyPush(app)).toBe(true);
  });

  it("is not when one pushed file is outside context/", () => {
    commitFile("context/roadmap.md", "# Roadmap\n");
    commitFile("src/index.ts", "export const one = 2;\n");

    expect(isContextOnlyPush(app)).toBe(false);
  });

  it("is not for a file that only starts with the folder's name", () => {
    commitFile("context.ts", "export const context = 1;\n");

    expect(isContextOnlyPush(app)).toBe(false);
  });

  it("is not when there is nothing to push", () => {
    expect(listPushedFiles(app)).toEqual([]);
    expect(isContextOnlyPush(app)).toBe(false);
  });

  it("is not for a branch without upstream", () => {
    git("checkout", "-q", "-b", "feature");
    commitFile("context/roadmap.md", "# Roadmap\n");

    expect(listPushedFiles(app)).toBeNull();
    expect(isContextOnlyPush(app)).toBe(false);
  });

  it("counts code a merge brings in", () => {
    git("checkout", "-q", "-b", "other");
    commitFile("src/other.ts", "export const other = 1;\n");
    git("checkout", "-q", "main");
    commitFile("context/roadmap.md", "# Roadmap\n");
    git("merge", "-q", "--no-ff", "-m", "merge other", "other");

    expect(isContextOnlyPush(app)).toBe(false);
  });

  it("is not when git fails", () => {
    const runGit = (args: readonly string[]): string => {
      if (args[0] === "rev-parse") return "origin/main\n";
      throw new Error("git diff exited with 128");
    };

    expect(isContextOnlyPush(app, runGit)).toBe(false);
  });
});

// A CI checkout: detached at the pull request head, no upstream; the job names the last tested commit.
describe("softure-context-only-push --since", () => {
  const silent = (): void => undefined;
  const ZEROS = "0000000000000000000000000000000000000000";

  function detach(): void {
    git("checkout", "-q", "--detach");
  }

  it("compares the given commit with HEAD on a checkout without upstream", () => {
    const tested = git("rev-parse", "HEAD").trim();
    commitFile("context/roadmap.md", "# Roadmap\n");
    detach();

    expect(listPushedFiles(app, undefined, tested)).toEqual(["context/roadmap.md"]);
    expect(runContextOnlyPush(["--since", tested], { cwd: app, log: silent })).toBe(0);
    expect(runContextOnlyPush([`--since=${tested}`], { cwd: app, log: silent })).toBe(0);
  });

  it("is not context-only when code changed since the given commit", () => {
    const tested = git("rev-parse", "HEAD").trim();
    commitFile("src/index.ts", "export const one = 2;\n");
    commitFile("context/roadmap.md", "# Roadmap\n");
    detach();

    expect(runContextOnlyPush(["--since", tested], { cwd: app, log: silent })).toBe(1);
  });

  it("is not context-only for an unknown or all-zeros commit", () => {
    commitFile("context/roadmap.md", "# Roadmap\n");
    detach();

    expect(listPushedFiles(app, undefined, ZEROS)).toBeNull();
    expect(runContextOnlyPush(["--since", ZEROS], { cwd: app, log: silent })).toBe(1);
    expect(runContextOnlyPush(["--since", "deadbeef"], { cwd: app, log: silent })).toBe(1);
  });

  it("is not context-only when nothing changed since the given commit", () => {
    expect(runContextOnlyPush(["--since", "HEAD"], { cwd: app, log: silent })).toBe(1);
  });

  it("keeps the upstream range without --since", () => {
    commitFile("context/roadmap.md", "# Roadmap\n");

    expect(runContextOnlyPush([], { cwd: app, log: silent })).toBe(0);
  });

  it("rejects a missing value, a repeated option and an unknown argument", () => {
    const lines: string[] = [];
    const log = (line: string): void => {
      lines.push(line);
    };

    expect(runContextOnlyPush(["--since"], { cwd: app, log })).toBe(2);
    expect(runContextOnlyPush(["--since="], { cwd: app, log })).toBe(2);
    expect(runContextOnlyPush(["--since", "HEAD", "--since", "HEAD"], { cwd: app, log })).toBe(2);
    expect(runContextOnlyPush(["HEAD"], { cwd: app, log })).toBe(2);
    expect(lines.slice(0, 2)).toEqual([
      "softure-context-only-push: --since needs a commit",
      "usage: softure-context-only-push [--since <commit>]",
    ]);
  });
});

describe("parseSinceOption", () => {
  it("takes both spellings out and keeps the rest in order", () => {
    expect(parseSinceOption(["a", "--since", "abc", "b"])).toEqual({ since: "abc", rest: ["a", "b"] });
    expect(parseSinceOption(["--since=abc"])).toEqual({ since: "abc", rest: [] });
    expect(parseSinceOption([])).toEqual({ since: undefined, rest: [] });
  });

  it("refuses an option as the value", () => {
    expect(parseSinceOption(["--since", "--run"])).toEqual({ error: "--since needs a commit" });
  });
});
