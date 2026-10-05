import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findPreviousTag, getCommitDate, isSafeRef, readReleaseCommits, resolveCommit } from "./git.js";
import { toReleaseEntries } from "./release-entries.js";

let repo: string;

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: "2026-10-05T12:00:00Z", GIT_COMMITTER_DATE: "2026-10-05T12:00:00Z" },
  }).trim();
}

function commitFile(name: string, message: string): void {
  writeFileSync(join(repo, name), name);
  git("add", name);
  git("commit", "-q", "-m", message);
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "softure-deploy-notes-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  commitFile("a.txt", "chore: first commit");
  git("tag", "v1.0.0");
  git("checkout", "-q", "-b", "feature");
  commitFile("b.txt", "feat: inner commit of the branch");
  git("checkout", "-q", "main");
  git("merge", "-q", "--no-ff", "feature", "-m", "Merge pull request #5 from acme/feature", "-m", "Add the export");
  commitFile("c.txt", "fix: footer typo");
  git("tag", "v1.1.0");
  git("tag", "other-1.0.0");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("git reads of the release report", () => {
  it("reads first-parent commits of the range, so a merged branch is one pull request", () => {
    const entries = toReleaseEntries(readReleaseCommits({ cwd: repo, from: "v1.0.0", to: "v1.1.0" }));
    expect(entries.map((entry) => (entry.kind === "pull-request" ? `#${entry.number} ${entry.title}` : entry.subject))).toEqual([
      "fix: footer typo",
      "#5 Add the export",
    ]);
  });

  it("finds the previous tag matching the glob, and none before the first one", () => {
    expect(findPreviousTag({ cwd: repo, to: "v1.1.0", match: "v*" })).toBe("v1.0.0");
    expect(findPreviousTag({ cwd: repo, to: "v1.1.0", match: "release-*" })).toBeNull();
    expect(findPreviousTag({ cwd: repo, to: "v1.0.0", match: "*" })).toBeNull();
  });

  it("reads the whole history for a first release", () => {
    expect(readReleaseCommits({ cwd: repo, from: null, to: "v1.0.0" }).map((commit) => commit.subject)).toEqual([
      "chore: first commit",
    ]);
  });

  it("resolves known refs, returns null for unknown ones and reads the commit date", () => {
    expect(resolveCommit(repo, "v1.1.0")).toMatch(/^[0-9a-f]{40}$/);
    expect(resolveCommit(repo, "v9.9.9")).toBeNull();
    expect(getCommitDate(repo, "v1.1.0")).toBe("2026-10-05");
  });

  it("refuses refs that could be read as options or ranges", () => {
    expect(isSafeRef("core@0.1.0")).toBe(true);
    expect(isSafeRef("v1.2.0^")).toBe(true);
    for (const ref of ["--output=/tmp/x", "-v", "a..b", "HEAD@{1}", "a b", ""]) expect(isSafeRef(ref), ref).toBe(false);
    expect(() => readReleaseCommits({ cwd: repo, from: "--all", to: "v1.1.0" })).toThrow(/refusing the ref/);
  });
});
