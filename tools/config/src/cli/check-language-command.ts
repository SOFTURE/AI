// `softure-check-language`: the language gate for an app or this repository.
//
//   softure-check-language <file>...              check these files (a pre-commit hook passes staged files)
//   softure-check-language --all                  check every file git tracks
//   softure-check-language --commit-msg <file>    check a commit message (a commit-msg hook)
//
// Exit code 0: clean. 1: at least one hit, each printed as `path:line: reason`. 2: wrong arguments.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkFiles, formatHits, getCommitMessageText, type ReadText } from "../language/index.js";

export interface CheckLanguageEnvironment {
  /** The folder paths are relative to (the repository root in a hook). */
  cwd: string;
  /** Repo-relative paths of every tracked file, for `--all`. */
  listTrackedFiles: (cwd: string) => string[];
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
  }
  return hits.length === 0 ? { exitCode: 0, output: "" } : { exitCode: 1, output: formatHits(hits) };
}
