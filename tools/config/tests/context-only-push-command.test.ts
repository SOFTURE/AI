import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isContextOnlyPush, listPushedFiles } from "../src/cli/context-only-push-command.js";

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
