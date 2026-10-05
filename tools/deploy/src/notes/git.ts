import { execFileSync } from "node:child_process";
import { GIT_LOG_FORMAT, parseGitLog, type GitCommit } from "./git-log.js";

/**
 * The few `git` reads the release report needs. Git runs through `execFile` with an argument list, never a shell,
 * and every ref is checked by {@link isSafeRef} first, so a ref cannot become an option (`--output=…`).
 */

const SAFE_REF = /^[A-Za-z0-9_][A-Za-z0-9_./@+~^-]*$/;
const MAX_LOG_BYTES = 64 * 1024 * 1024;

export function isSafeRef(ref: string): boolean {
  return SAFE_REF.test(ref) && !ref.includes("..") && !ref.includes("@{");
}

function assertSafeRef(ref: string): void {
  // The CLI rejects unsafe refs as a usage error; reaching this is a bug in the caller.
  if (!isSafeRef(ref)) throw new Error(`git: refusing the ref ${JSON.stringify(ref)}.`);
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: MAX_LOG_BYTES, stdio: ["ignore", "pipe", "pipe"] });
}

function hasExitStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === status;
}

/** The full SHA of the commit `ref` names, or null when it names none. */
export function resolveCommit(cwd: string, ref: string): string | null {
  assertSafeRef(ref);
  try {
    return runGit(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).trim();
  } catch (error) {
    if (hasExitStatus(error, 1)) return null;
    throw error;
  }
}

/** The nearest tag matching `match` (a git glob) before `to`, or null when there is none (a first release). */
export function findPreviousTag({ cwd, to, match }: { cwd: string; to: string; match: string }): string | null {
  assertSafeRef(to);
  if (resolveCommit(cwd, `${to}^`) === null) return null;
  try {
    return runGit(cwd, ["describe", "--tags", "--abbrev=0", `--match=${match}`, `${to}^`]).trim();
  } catch (error) {
    // `git describe` exits with 128 when no tag matches.
    if (hasExitStatus(error, 128)) return null;
    throw error;
  }
}

/** Commit date of `ref`, YYYY-MM-DD. */
export function getCommitDate(cwd: string, ref: string): string {
  assertSafeRef(ref);
  return runGit(cwd, ["log", "-1", "--format=%cs", ref, "--"]).trim();
}

/** First-parent commits after `from` up to `to`, newest first: one per merged pull request on a merge-based branch. */
export function readReleaseCommits({ cwd, from, to }: { cwd: string; from: string | null; to: string }): GitCommit[] {
  assertSafeRef(to);
  if (from !== null) assertSafeRef(from);
  const range = from === null ? to : `${from}..${to}`;
  return parseGitLog(runGit(cwd, ["log", "--first-parent", `--format=${GIT_LOG_FORMAT}`, range, "--"]));
}
