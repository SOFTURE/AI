import { execFileSync } from "node:child_process";
import { isSafeRef } from "../notes/git.js";

/**
 * The git reads and writes of the integration run. Git runs through `execFile` with an argument list, never a shell;
 * refs are checked by `isSafeRef` and remotes by {@link isSafeRemote}, and `--` ends the options before a remote, so
 * neither can become an option (`--upload-pack=…`). `notesRef` is the notes ref the results live under
 * (`refs/notes/integration` unless the app keeps another).
 */

const SAFE_REMOTE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
/** Commits of the main branch searched for its latest result. */
const MAIN_HISTORY_DEPTH = 500;
/** The identity a note is written with when git has none (a CI runner). */
const FALLBACK_IDENTITY = ["-c", "user.name=softure-deploy", "-c", "user.email=softure-deploy@users.noreply.github.com"];

export function isSafeRemote(remote: string): boolean {
  return SAFE_REMOTE.test(remote);
}

function assertSafe(kind: "ref" | "remote", value: string): void {
  // The CLI rejects these as usage errors; reaching this is a bug in the caller.
  const isSafe = kind === "ref" ? isSafeRef(value) : isSafeRemote(value);
  if (!isSafe) throw new Error(`git: refusing the ${kind} ${JSON.stringify(value)}.`);
}

function runGit(cwd: string, args: string[], input?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
}

/** Runs git and reports a non-zero exit as false, for steps whose failure the caller handles. */
function tryGit(cwd: string, args: string[]): boolean {
  try {
    runGit(cwd, args);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") return false;
    throw error;
  }
}

/** Replaces the local integration notes with the remote's; false when they cannot be fetched (none yet, offline). */
export function fetchIntegrationNotes(cwd: string, remote: string, notesRef: string): boolean {
  assertSafe("remote", remote);
  assertSafe("ref", notesRef);
  return tryGit(cwd, ["fetch", "--quiet", "--no-tags", "--", remote, `+${notesRef}:${notesRef}`]);
}

/** The note text on `sha`, or null when it has none. */
export function readNoteText(cwd: string, notesRef: string, sha: string): string | null {
  assertSafe("ref", sha);
  assertSafe("ref", notesRef);
  try {
    return runGit(cwd, ["notes", `--ref=${notesRef}`, "show", sha]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 1) return null;
    throw error;
  }
}

function hasIdentity(cwd: string): boolean {
  return tryGit(cwd, ["config", "user.email"]);
}

/** Writes (or replaces) the note on `sha` in the local notes ref. */
export function writeNoteText(cwd: string, notesRef: string, sha: string, text: string): void {
  assertSafe("ref", sha);
  assertSafe("ref", notesRef);
  const identity = hasIdentity(cwd) ? [] : FALLBACK_IDENTITY;
  runGit(cwd, [...identity, "notes", `--ref=${notesRef}`, "add", "--force", "--file=-", sha], text);
}

/** Pushes the local notes ref; false when the remote refuses it (another run pushed first). */
export function pushIntegrationNotes(cwd: string, remote: string, notesRef: string): boolean {
  assertSafe("remote", remote);
  assertSafe("ref", notesRef);
  return tryGit(cwd, ["push", "--quiet", "--", remote, `${notesRef}:${notesRef}`]);
}

export type RemoteRef = { kind: "absent" } | { kind: "at"; sha: string } | { kind: "unreachable" };

/** Where `ref` points on the remote: nowhere, a commit, or unknown because the remote cannot be reached. */
export function readRemoteRef(cwd: string, remote: string, ref: string): RemoteRef {
  assertSafe("remote", remote);
  assertSafe("ref", ref);
  let listed: string;
  try {
    listed = runGit(cwd, ["ls-remote", "--refs", "--", remote, ref]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") return { kind: "unreachable" };
    throw error;
  }
  const sha = listed.split("\n").find((entry) => entry.endsWith(`\t${ref}`))?.split("\t")[0];
  return sha === undefined ? { kind: "absent" } : { kind: "at", sha };
}

/** Creates `ref` on the remote at `sha`; false when the remote refuses it. Never forces. */
export function pushCommitToRef(cwd: string, remote: string, sha: string, ref: string): boolean {
  assertSafe("remote", remote);
  assertSafe("ref", sha);
  assertSafe("ref", ref);
  return tryGit(cwd, ["push", "--quiet", "--", remote, `${sha}:${ref}`]);
}

/** The full SHA of the commit `ref` names, or null. */
export function resolveSha(cwd: string, ref: string): string | null {
  assertSafe("ref", ref);
  try {
    return runGit(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).trim();
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 1) return null;
    throw error;
  }
}

/**
 * The note text of the newest first-parent commit of the remote's `main` branch that has a note, or null. The branch
 * is fetched first; when that fails the last fetched state of `<remote>/<main>` is used, if any.
 */
export function findMainNoteText(cwd: string, remote: string, notesRef: string, main: string): string | null {
  assertSafe("remote", remote);
  assertSafe("ref", main);
  assertSafe("ref", notesRef);
  const tracking = `refs/remotes/${remote}/${main}`;
  tryGit(cwd, ["fetch", "--quiet", "--no-tags", "--", remote, `+refs/heads/${main}:${tracking}`]);
  if (resolveSha(cwd, tracking) === null) return null;
  let listed: string;
  try {
    listed = runGit(cwd, ["notes", `--ref=${notesRef}`, "list"]);
  } catch (error) {
    // No notes ref at all: git exits non-zero.
    if (typeof error === "object" && error !== null && "status" in error) return null;
    throw error;
  }
  const noted = new Set(listed.split("\n").map((line) => line.split(" ")[1]).filter((sha) => sha !== undefined));
  const history = runGit(cwd, ["rev-list", "--first-parent", `--max-count=${String(MAIN_HISTORY_DEPTH)}`, tracking, "--"]);
  const newest = history.split("\n").find((sha) => noted.has(sha));
  return newest === undefined ? null : readNoteText(cwd, notesRef, newest);
}
