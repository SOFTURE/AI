// `softure-check-language`: the language gate for an app or this repository.
//
//   softure-check-language <file>...              check these files (a pre-commit hook passes staged files)
//   softure-check-language --all                  check every file git tracks
//   softure-check-language --commit-msg <file>    check a commit message (a commit-msg hook)
//
// During a merge (`MERGE_HEAD` present), a file hit counts only when its line is in no parent's version of the file:
// lines that came unchanged from the merged branch or the branch itself were checked there (issue #1047).
//
// Exit code 0: clean. 1: at least one hit, each printed as `path:line: reason`. 2: wrong arguments.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkFiles, formatHits, getCommitMessageText, type FileHit, type ReadText } from "../language/index.js";
import { runGitCommand, type RunGit } from "./context-only-push-command.js";

/** Every line of a file in the parents of the merge in progress; `null` when unknown, so the file is checked in full. */
export type ReadParentLines = (path: string) => ReadonlySet<string> | null;

export interface CheckLanguageEnvironment {
  /** The folder paths are relative to (the repository root in a hook). */
  cwd: string;
  /** Repo-relative paths of every tracked file, for `--all`. */
  listTrackedFiles: (cwd: string) => string[];
  /** The parents' lines during a merge; returns `null` when no merge is in progress. Absent: no merge handling. */
  readMergeParentLines?: (cwd: string) => ReadParentLines | null;
}

export interface CheckLanguageResult {
  exitCode: 0 | 1 | 2;
  /** What goes to stderr; empty when the gate passes. */
  output: string;
}

export const USAGE =
  "Usage: softure-check-language <file>... | --all | --commit-msg <file>";

function readTextOrNull(absolutePath: string): string | null {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    // Deleted, renamed or a folder: there is nothing to check.
    return null;
  }
}

/** Every file git tracks under `cwd`, relative to it. */
export function listGitTrackedFiles(cwd: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" })
    .split("\0")
    .filter((path) => path.length > 0);
}

function readGitText(runGit: RunGit, cwd: string, args: readonly string[]): string | null {
  try {
    return runGit(args, cwd);
  } catch {
    return null;
  }
}

/**
 * The parents of the merge in progress under `cwd` (`HEAD` and every head in `MERGE_HEAD`), as a reader of a file's
 * lines in all of them; `null` when no merge is in progress or git fails.
 */
export function readGitMergeParentLines(cwd: string, runGit: RunGit = runGitCommand): ReadParentLines | null {
  const mergeHeadPath = readGitText(runGit, cwd, ["rev-parse", "--git-path", "MERGE_HEAD"])?.trim();
  if (!mergeHeadPath) return null;
  let mergeHeads: string[];
  try {
    mergeHeads = readFileSync(resolve(cwd, mergeHeadPath), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    // No MERGE_HEAD file: no merge is in progress.
    return null;
  }
  if (mergeHeads.length === 0) return null;
  const parents = ["HEAD", ...mergeHeads];
  return (path) => {
    const lines = new Set<string>();
    for (const parent of parents) {
      // A parent without the file (or a path git cannot name) contributes no lines.
      const exists = readGitText(runGit, cwd, ["cat-file", "-e", `${parent}:./${path}`]) !== null;
      if (!exists) continue;
      const text = readGitText(runGit, cwd, ["show", `${parent}:./${path}`]);
      if (text === null) return null;
      for (const line of text.split("\n")) lines.add(line);
    }
    return lines;
  };
}

/** The hits whose line the merge in progress brings in itself: their text is in no parent's version of the file. */
function keepMergeOwnHits(hits: readonly FileHit[], readParentLines: ReadParentLines, readText: ReadText): FileHit[] {
  const fileLines = new Map<string, readonly string[]>();
  const parentLines = new Map<string, ReadonlySet<string> | null>();
  return hits.filter((hit) => {
    if (!parentLines.has(hit.path)) parentLines.set(hit.path, readParentLines(hit.path));
    const parents = parentLines.get(hit.path);
    if (!parents) return true;
    if (!fileLines.has(hit.path)) fileLines.set(hit.path, (readText(hit.path) ?? "").split("\n"));
    const line = fileLines.get(hit.path)?.[hit.line - 1];
    return line === undefined || !parents.has(line);
  });
}

/** Runs the gate for the command line `args` (without `node` and the script). */
export function runCheckLanguage(args: readonly string[], environment: CheckLanguageEnvironment): CheckLanguageResult {
  const [mode, messageFile] = args;
  const readFromCwd: ReadText = (path) => readTextOrNull(resolve(environment.cwd, path));
  let hits;
  if (mode === "--commit-msg") {
    if (!messageFile) return { exitCode: 2, output: `--commit-msg needs the message file. ${USAGE}` };
    hits = checkFiles([messageFile], (path) => {
      const raw = readFromCwd(path);
      return raw === null ? null : getCommitMessageText(raw);
    });
  } else if (mode === "--all") {
    hits = checkFiles(environment.listTrackedFiles(environment.cwd), readFromCwd);
  } else if (mode?.startsWith("--")) {
    return { exitCode: 2, output: `Unknown option ${mode}. ${USAGE}` };
  } else {
    hits = checkFiles(args, readFromCwd);
    const readParentLines = hits.length > 0 ? environment.readMergeParentLines?.(environment.cwd) : null;
    if (readParentLines) hits = keepMergeOwnHits(hits, readParentLines, readFromCwd);
  }
  return hits.length === 0 ? { exitCode: 0, output: "" } : { exitCode: 1, output: formatHits(hits) };
}
