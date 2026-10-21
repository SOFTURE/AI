// `softure-context-only-push`: whether the push of the current branch changes only workflow artifacts (issue #641).
// The lefthook preset runs it as the `skip` condition of the heavy pre-push jobs (typecheck, lint, tests), so a push
// of roadmap or change state under `context/` costs seconds; the language gate still runs.
//
// The pushed range is `@{push}..HEAD`, compared as trees (`git diff @{push} HEAD`), so a merge that brings in code
// counts as code. Exit code 0: every changed file is under `context/`. 1: anything else, including no upstream to
// compare with, nothing to push, or a git error: then the jobs run.
import { execFileSync } from "node:child_process";

export const CONTEXT_FOLDER = "context/";

export type RunGit = (args: readonly string[], cwd: string) => string;

/** git's stdout, or a thrown error when git exits non-zero. */
export function runGitCommand(args: readonly string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** The files the push of the current branch would change, relative to the repository root; `null` without upstream. */
export function listPushedFiles(cwd: string, runGit: RunGit = runGitCommand): string[] | null {
  let target: string;
  try {
    target = runGit(["rev-parse", "--verify", "--quiet", "@{push}"], cwd).trim();
  } catch {
    // No push destination yet (a new branch): nothing to compare with, so nothing is skipped.
    return null;
  }
  return runGit(["diff", "--name-only", "-z", target, "HEAD"], cwd).split("\0").filter((file) => file !== "");
}

export function isContextOnlyPush(cwd: string, runGit: RunGit = runGitCommand): boolean {
  let files: string[] | null;
  try {
    files = listPushedFiles(cwd, runGit);
  } catch {
    // A git failure must never skip a gate.
    return false;
  }
  return files !== null && files.length > 0 && files.every((file) => file.startsWith(CONTEXT_FOLDER));
}
