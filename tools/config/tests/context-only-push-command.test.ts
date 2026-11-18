import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isContextOnlyPush, listPushedFiles, parseSinceOption, runGitCommand } from "../src/cli/context-only-push-command.js";

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

  it("compares with the --since commit instead of @{push}", () => {
    const tested = git("rev-parse", "HEAD").trim();
    commitFile("context/changes/a/plan.md", "# Plan\n");
    git("push", "-q");
    commitFile("context/roadmap.md", "# Roadmap\n");
    git("checkout", "-q", "--detach", "HEAD");

    expect(listPushedFiles(app, runGitCommand, tested)).toEqual(["context/changes/a/plan.md", "context/roadmap.md"]);
    expect(isContextOnlyPush(app, runGitCommand, tested)).toBe(true);
  });

  it("is not with --since when code changed after that commit", () => {
    const tested = git("rev-parse", "HEAD").trim();
    commitFile("src/index.ts", "export const one = 2;\n");
    git("push", "-q");
    commitFile("context/roadmap.md", "# Roadmap\n");

    expect(isContextOnlyPush(app, runGitCommand, tested)).toBe(false);
  });

  it("is not with --since for a commit git does not know", () => {
    commitFile("context/roadmap.md", "# Roadmap\n");

    expect(listPushedFiles(app, runGitCommand, "0000000000000000000000000000000000000000")).toBeNull();
    expect(isContextOnlyPush(app, runGitCommand, "0000000000000000000000000000000000000000")).toBe(false);
  });
});

describe("parseSinceOption", () => {
  it("reads --since in both spellings and refuses anything else", () => {
    expect(parseSinceOption([])).toEqual({});
    expect(parseSinceOption(["--since", "abc"])).toEqual({ since: "abc" });
    expect(parseSinceOption(["--since=abc"])).toEqual({ since: "abc" });
    expect(parseSinceOption(["--since"])).toBeNull();
    expect(parseSinceOption(["--since="])).toBeNull();
    expect(parseSinceOption(["--since", "abc", "extra"])).toBeNull();
    expect(parseSinceOption(["--other"])).toBeNull();
  });
});
