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

/** One network command (fetch, push, ls-remote): git itself has no connect or transfer limit. */
const NETWORK_TIMEOUT_MS = 2 * 60_000;
const MAX_REASON_LENGTH = 200;

function runGit(cwd: string, args: string[], input?: string, timeoutMs?: number): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
}

/** A git that ran and failed: a non-zero exit, or killed at its time limit. Anything else (git missing) is a bug. */
function isGitFailure(error: unknown): error is { status: number | null; signal: string | null; stderr?: unknown } {
  if (typeof error !== "object" || error === null) return false;
  const status = "status" in error ? error.status : undefined;
  const signal = "signal" in error ? error.signal : undefined;
  return typeof status === "number" || typeof signal === "string";
}

/** What a refused fetch or push said: git's reason, and whether it lost a race to another run. */
interface GitFailure {
  readonly reason: string;
  readonly isRace: boolean;
}

/**
 * Reads a failed git's stderr: the reason is the rejection line (` ! [rejected] … (fetch first)`), else the first
 * `fatal:` line, else the last line that is not a hint, with any `//user:secret@` of a remote URL masked; a lost race is a non-fast-forward
 * refusal, so a fresh fetch and another push can succeed.
 */
function readFailure(error: { signal: string | null; stderr?: unknown }): GitFailure {
  if (typeof error.signal === "string") return { reason: `git gave no answer within ${String(NETWORK_TIMEOUT_MS / 1000)} s`, isRace: false };
  const stderr = typeof error.stderr === "string" ? error.stderr : Buffer.isBuffer(error.stderr) ? error.stderr.toString("utf8") : "";
  const lines = stderr.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("hint:"));
  const line =
    lines.find((entry) => entry.startsWith("! [")) ??
    lines.find((entry) => entry.startsWith("fatal:")) ??
    lines.at(-1) ??
    "git exited without a message";
  return {
    reason: line.replace(/\/\/[^/@\s]*@/g, "//***@").slice(0, MAX_REASON_LENGTH),
    isRace: /non-fast-forward|\(fetch first\)|\(stale info\)|cannot lock ref/i.test(stderr),
  };
}

/** What a fetch or push to the remote did: done, or refused with git's reason. */
export type GitRemoteResult = { readonly ok: true } | ({ readonly ok: false } & GitFailure);

/** Runs a network git command and reports its failure as a value, for steps whose failure the caller handles. */
function tryRemoteGit(cwd: string, args: string[]): GitRemoteResult {
  try {
    runGit(cwd, args, undefined, NETWORK_TIMEOUT_MS);
    return { ok: true };
  } catch (error) {
    if (isGitFailure(error)) return { ok: false, ...readFailure(error) };
    throw error;
  }
}

/** Runs a local git command and reports a non-zero exit as false. */
function tryGit(cwd: string, args: string[]): boolean {
  try {
    runGit(cwd, args);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") return false;
    throw error;
  }
}

/** Replaces the local integration notes with the remote's; ok when the remote has none yet, refused when it cannot be reached. */
export function fetchIntegrationNotes(cwd: string, remote: string, notesRef: string): GitRemoteResult {
  assertSafe("remote", remote);
  assertSafe("ref", notesRef);
  const fetched = tryRemoteGit(cwd, ["fetch", "--quiet", "--no-tags", "--", remote, `+${notesRef}:${notesRef}`]);
  // A remote with no notes yet answered: there is nothing to fetch, which is not a failure to reach it.
  if (!fetched.ok && /couldn't find remote ref/i.test(fetched.reason)) return { ok: true };
  return fetched;
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

/** Pushes the local notes ref; refused with git's reason (`isRace` when another run pushed first). */
export function pushIntegrationNotes(cwd: string, remote: string, notesRef: string): GitRemoteResult {
  assertSafe("remote", remote);
  assertSafe("ref", notesRef);
  return tryRemoteGit(cwd, ["push", "--quiet", "--", remote, `${notesRef}:${notesRef}`]);
}

export type RemoteRef = { kind: "absent" } | { kind: "at"; sha: string } | { kind: "unreachable"; reason: string };

/** Where `ref` points on the remote: nowhere, a commit, or unknown because the remote cannot be reached. */
export function readRemoteRef(cwd: string, remote: string, ref: string): RemoteRef {
  assertSafe("remote", remote);
  assertSafe("ref", ref);
  let listed: string;
  try {
    listed = runGit(cwd, ["ls-remote", "--refs", "--", remote, ref], undefined, NETWORK_TIMEOUT_MS);
  } catch (error) {
    if (isGitFailure(error)) return { kind: "unreachable", reason: readFailure(error).reason };
    throw error;
  }
  const sha = listed.split("\n").find((entry) => entry.endsWith(`\t${ref}`))?.split("\t")[0];
  return sha === undefined ? { kind: "absent" } : { kind: "at", sha };
}

/** Creates `ref` on the remote at `sha`; refused with git's reason. Never forces. */
export function pushCommitToRef(cwd: string, remote: string, sha: string, ref: string): GitRemoteResult {
  assertSafe("remote", remote);
  assertSafe("ref", sha);
  assertSafe("ref", ref);
  return tryRemoteGit(cwd, ["push", "--quiet", "--", remote, `${sha}:${ref}`]);
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

/** Fetches the remote's `main` branch into `refs/remotes/<remote>/<main>`, which {@link readMainNoteText} reads. */
export function fetchMainBranch(cwd: string, remote: string, main: string): GitRemoteResult {
  assertSafe("remote", remote);
  assertSafe("ref", main);
  return tryRemoteGit(cwd, ["fetch", "--quiet", "--no-tags", "--", remote, `+refs/heads/${main}:${toTrackingRef(remote, main)}`]);
}

/**
 * The note text of the newest first-parent commit of the last fetched `<remote>/<main>` that has a note, or null
 * (also when the branch was never fetched). Reads local refs only; {@link fetchMainBranch} brings them up to date.
 */
export function readMainNoteText(cwd: string, remote: string, notesRef: string, main: string): string | null {
  assertSafe("remote", remote);
  assertSafe("ref", main);
  assertSafe("ref", notesRef);
  const tracking = toTrackingRef(remote, main);
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

function toTrackingRef(remote: string, main: string): string {
  return `refs/remotes/${remote}/${main}`;
}
