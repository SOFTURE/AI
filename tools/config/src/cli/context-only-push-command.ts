// `softure-context-only-push`: whether the push of the current branch changes only workflow artifacts (issue #641).
// The lefthook preset runs it as the `skip` condition of the heavy pre-push jobs (typecheck, lint, tests), so a push
// of roadmap or change state under `context/` costs seconds; the language gate still runs.
//
// The pushed range is `@{push}..HEAD`, compared as trees (`git diff @{push} HEAD`), so a merge that brings in code
// counts as code. Exit code 0: every changed file is under `context/`. 1: anything else, including no upstream to
// compare with, nothing to push, or a git error: then the jobs run.
//
// `--since <rev>` compares with that commit instead of `@{push}` (issue: CI on a pull request push). A CI job passes
// the last commit of the pull request whose heavy jobs passed; an unknown commit (a force push) runs the jobs.
import { execFileSync } from "node:child_process";

export const CONTEXT_FOLDER = "context/";

export type RunGit = (args: readonly string[], cwd: string) => string;

/** git's stdout, or a thrown error when git exits non-zero. */
export function runGitCommand(args: readonly string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/**
 * The files the push of the current branch would change, relative to the repository root; `null` without upstream.
 * With `since`, the files changed between that commit and `HEAD`; `null` when the commit is unknown.
 */
export function listPushedFiles(cwd: string, runGit: RunGit = runGitCommand, since?: string): string[] | null {
  let target: string;
  try {
    target = runGit(["rev-parse", "--verify", "--quiet", since === undefined ? "@{push}" : `${since}^{commit}`], cwd).trim();
  } catch {
    // No push destination yet (a new branch) or an unknown commit: nothing to compare with, so nothing is skipped.
    return null;
  }
  return runGit(["diff", "--name-only", "-z", target, "HEAD"], cwd).split("\0").filter((file) => file !== "");
}

export function isContextOnlyPush(cwd: string, runGit: RunGit = runGitCommand, since?: string): boolean {
  let files: string[] | null;
  try {
    files = listPushedFiles(cwd, runGit, since);
  } catch {
    // A git failure must never skip a gate.
    return false;
  }
  return files !== null && files.length > 0 && files.every((file) => file.startsWith(CONTEXT_FOLDER));
}

/** The value of `--since <rev>` (or `--since=<rev>`) in the bin's arguments; `null` when an argument is not known. */
export function parseSinceOption(argv: readonly string[]): { since?: string } | null {
  const [first, second, ...rest] = argv;
  if (first === undefined) return {};
  if (first.startsWith("--since=") && second === undefined) {
    const since = first.slice("--since=".length);
    return since === "" ? null : { since };
  }
  if (first === "--since" && second !== undefined && second !== "" && rest.length === 0) return { since: second };
  return null;
}
