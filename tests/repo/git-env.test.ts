import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REPOSITORY_GIT_VARIABLES, removeRepositoryGitVariables } from "../git-env.js";

const IDENTITY = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

function runGit(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env });
}

function readGit(cwd: string, ...args: string[]): string {
  const result = runGit(cwd, removeRepositoryGitVariables({ ...process.env, ...IDENTITY }), ...args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
}

describe("repository git variables (issue #1292)", () => {
  it("covers every variable the installed git treats as repository-local", () => {
    const local = readGit(tmpdir(), "rev-parse", "--local-env-vars").split("\n").filter(Boolean);
    expect(local.length).toBeGreaterThan(0);
    expect(REPOSITORY_GIT_VARIABLES).toEqual(expect.arrayContaining(local));
  });

  it("removes the repository variables and keeps the identity variables", () => {
    const env = removeRepositoryGitVariables({ GIT_DIR: "/x/.git", GIT_WORK_TREE: "/x", GIT_INDEX_FILE: "/x/i", PATH: "/bin", ...IDENTITY });
    expect(env).toEqual({ PATH: "/bin", ...IDENTITY });
  });

  describe("with GIT_DIR pointing at another repository, as a worktree's pre-push hook sets it", () => {
    let real: string;
    let temp: string;
    let realHead: string;

    beforeEach(() => {
      real = mkdtempSync(join(tmpdir(), "git-env-real-"));
      temp = mkdtempSync(join(tmpdir(), "git-env-temp-"));
      readGit(real, "init", "-q");
      readGit(real, "commit", "-q", "--allow-empty", "-m", "real");
      realHead = readGit(real, "rev-parse", "HEAD");
    });

    afterEach(() => {
      rmSync(real, { recursive: true, force: true });
      rmSync(temp, { recursive: true, force: true });
    });

    const hookEnv = (): NodeJS.ProcessEnv => ({ ...process.env, ...IDENTITY, GIT_DIR: join(real, ".git") });

    it("leaves that repository untouched once the variables are removed", () => {
      const env = removeRepositoryGitVariables(hookEnv());
      for (const args of [["init", "-q"], ["commit", "-q", "--allow-empty", "-m", "temp"], ["tag", "v2026.10.12"]]) {
        expect(runGit(temp, env, ...args).status).toBe(0);
      }

      expect(readGit(real, "rev-parse", "HEAD")).toBe(realHead);
      expect(readGit(real, "tag", "-l")).toBe("");
      expect(readGit(real, "config", "--bool", "core.bare")).toBe("false");
      expect(readGit(temp, "log", "--format=%s")).toBe("temp");
      expect(readGit(temp, "tag", "-l")).toBe("v2026.10.12");
    });

    it("writes into that repository when the variables are inherited (the hazard)", () => {
      const env = hookEnv();
      expect(runGit(temp, env, "commit", "-q", "--allow-empty", "-m", "leaked").status).toBe(0);

      expect(readGit(real, "log", "-1", "--format=%s")).toBe("leaked");
    });
  });
});
