// `softure-context-only-push`: whether the push of the current branch changes only workflow artifacts (issue #641).
// The lefthook preset runs it as the `skip` condition of the heavy pre-push jobs (typecheck, lint, tests), so a push
// of roadmap or change state under `context/` costs seconds; the language gate still runs.
//
// The pushed range is `@{push}..HEAD`, compared as trees (`git diff @{push} HEAD`), so a merge that brings in code
// counts as code. A CI job, which has no upstream, names the base itself with `--since <rev>` (issue #1371).
// Exit code 0: every changed file is under `context/`. 1: anything else, including no upstream to compare with, an
// unknown `--since` commit, nothing to push, or a git error: then the jobs run. 2: a usage error.
import { execFileSync } from "node:child_process";

export const CONTEXT_FOLDER = "context/";

export type RunGit = (args: readonly string[], cwd: string) => string;

/** git's stdout, or a thrown error when git exits non-zero. */
export function runGitCommand(args: readonly string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** The commit `rev` names, or `null` when it names none (unknown, all zeros, not a commit). */
export function resolveCommit(rev: string, cwd: string, runGit: RunGit): string | null {
  try {
    const sha = runGit(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], cwd).trim();
    return sha === "" ? null : sha;
  } catch {
    return null;
  }
}

/**
 * The files the push of the current branch would change (or, with `since`, the files changed from `since` to `HEAD`),
 * relative to the repository root; `null` without upstream or for an unknown `since` commit.
 */
export function listPushedFiles(cwd: string, runGit: RunGit = runGitCommand, since?: string): string[] | null {
  // No push destination yet (a new branch) or an unknown base (a force push): nothing to compare with, so nothing is
  // skipped.
  const target = resolveCommit(since ?? "@{push}", cwd, runGit);
  if (target === null) return null;
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

export type SinceArgs = { since: string | undefined; rest: string[] } | { error: string };

/** Takes `--since <rev>` or `--since=<rev>` out of `args`; the other arguments stay in order. */
export function parseSinceOption(args: readonly string[]): SinceArgs {
  let since: string | undefined;
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--since" || arg.startsWith("--since=")) {
      const value = arg === "--since" ? args[index + 1] : arg.slice("--since=".length);
      if (value === undefined || value === "" || value.startsWith("-")) return { error: "--since needs a commit" };
      if (since !== undefined) return { error: "--since is given twice" };
      since = value;
      if (arg === "--since") index += 1;
    } else {
      rest.push(arg);
    }
  }
  return { since, rest };
}

export interface ContextOnlyPushOptions {
  cwd: string;
  runGit?: RunGit;
  log?: (line: string) => void;
}

const USAGE = "usage: softure-context-only-push [--since <commit>]";

/** The bin: exit code 0 for a context-only push, 1 otherwise, 2 for a usage error. */
export function runContextOnlyPush(argv: readonly string[], options: ContextOnlyPushOptions): number {
  const { cwd, runGit = runGitCommand, log = console.error } = options;
  const parsed = parseSinceOption(argv);
  if ("error" in parsed || parsed.rest.length > 0) {
    log(`softure-context-only-push: ${"error" in parsed ? parsed.error : `unknown argument ${parsed.rest[0] ?? ""}`}`);
    log(USAGE);
    return 2;
  }
  return isContextOnlyPush(cwd, runGit, parsed.since) ? 0 : 1;
}
