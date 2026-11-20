import { formatContractLines } from "./contract.js";
import {
  fetchIntegrationNotes,
  fetchMainBranch,
  pushCommitToRef,
  pushIntegrationNotes,
  readMainNoteText,
  readNoteText,
  readRemoteRef,
  writeNoteText,
} from "./git-notes.js";
import { formatIntegrationNote, INTEGRATION_NOTES_REF, parseIntegrationNote, type IntegrationNote } from "./note.js";
import type { SuiteCounts } from "./suite-counts.js";

/** The branch prefix whose pushes start an integration run (`deploy-integration.yml`'s caller listens to it). */
export const INTEGRATION_BRANCH_PREFIX = "integration/";

interface GitTarget {
  /** A directory inside the repository. */
  cwd: string;
  /** The remote that runs the suite (usually `origin`). */
  remote: string;
  /** The notes ref the results live under; {@link INTEGRATION_NOTES_REF} when not set. */
  notesRef?: string;
}

function getNotesRef(target: GitTarget): string {
  return target.notesRef ?? INTEGRATION_NOTES_REF;
}

/** A stored result, with the contract lines to print. */
export interface IntegrationFound {
  kind: "found";
  note: IntegrationNote;
  lines: string;
}

export type IntegrationLookup = IntegrationFound | { kind: "none" } | { kind: "invalid"; problem: string };

/** A lookup, with git's reason when the remote could not be fetched and only local state was read. */
export type IntegrationLookupResult = IntegrationLookup & { readonly fetchFailure: string | null };

/** Reads the main branch's latest result from the last fetched `<remote>/<main>`; the caller fetches it first. */
function readMainNote(target: GitTarget, main: string): IntegrationNote | null {
  const text = readMainNoteText(target.cwd, target.remote, getNotesRef(target), main);
  if (text === null) return null;
  const parsed = parseIntegrationNote(text);
  return parsed.ok ? parsed.note : null;
}

function toLookup(target: GitTarget, text: string, main: string): IntegrationFound | { kind: "invalid"; problem: string } {
  const parsed = parseIntegrationNote(text);
  if (!parsed.ok) return { kind: "invalid", problem: parsed.problem };
  return { kind: "found", note: parsed.note, lines: formatContractLines(parsed.note, readMainNote(target, main)) };
}

/**
 * The stored result for `sha`: the remote's notes and main branch are fetched first, and the local ones read when the
 * remote cannot be reached (`fetchFailure` then names git's reason). `main` names the branch whose latest result
 * `new-red` compares with.
 */
export function lookupIntegration(target: GitTarget & { sha: string; main: string }): IntegrationLookupResult {
  const notes = fetchIntegrationNotes(target.cwd, target.remote, getNotesRef(target));
  const fetchFailure = notes.ok ? null : notes.reason;
  const text = readNoteText(target.cwd, getNotesRef(target), target.sha);
  if (text === null) return { kind: "none", fetchFailure };
  const branch = fetchFailure === null ? fetchMainBranch(target.cwd, target.remote, target.main) : notes;
  return { ...toLookup(target, text, target.main), fetchFailure: branch.ok ? null : branch.reason };
}

export interface RecordOptions extends GitTarget {
  sha: string;
  name: string;
  /** The ref the run was started by (`refs/heads/integration/<name>`, or the main branch). */
  ref: string;
  result: IntegrationNote["result"];
  /** Counts of the run's report, or null without a readable one. */
  counts: SuiteCounts | null;
  run: string | null;
  finishedAt: Date;
  /** Fetch, write and push rounds before giving up (another run may push its note in between). */
  attempts?: number;
}

/** `push-failed` carries git's reason of the last refusal; a refusal that is not a race stops the retries at once. */
export type RecordResult = { kind: "recorded"; note: IntegrationNote } | { kind: "push-failed"; attempts: number; reason: string };

/** Stores the result as the note on `sha` and pushes it, merging with notes other runs pushed meanwhile. */
export function recordIntegration(options: RecordOptions): RecordResult {
  const note: IntegrationNote = {
    version: 1,
    result: options.result,
    sha: options.sha,
    name: options.name,
    ref: options.ref,
    passed: options.counts?.passed ?? null,
    total: options.counts?.total ?? null,
    red: options.counts?.red ?? [],
    flaky: options.counts?.flaky ?? [],
    run: options.run,
    finishedAt: `${options.finishedAt.toISOString().slice(0, 19)}Z`,
  };
  const attempts = options.attempts ?? 5;
  let reason = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // Start from the remote's notes each round, so a note another run pushed meanwhile is kept, not overwritten. A
    // failed fetch leaves the local ones, which the push then creates on the remote.
    fetchIntegrationNotes(options.cwd, options.remote, getNotesRef(options));
    writeNoteText(options.cwd, getNotesRef(options), options.sha, formatIntegrationNote(note));
    const pushed = pushIntegrationNotes(options.cwd, options.remote, getNotesRef(options));
    if (pushed.ok) return { kind: "recorded", note };
    reason = pushed.reason;
    // Only a lost race is worth another round; a refused login or a missing remote fails the same way every time.
    if (!pushed.isRace) return { kind: "push-failed", attempts: attempt, reason };
  }
  return { kind: "push-failed", attempts, reason };
}

export interface RunOptions extends GitTarget {
  sha: string;
  name: string;
  main: string;
  /** The branch prefix the run is pushed under; {@link INTEGRATION_BRANCH_PREFIX} when not set. */
  refPrefix?: string;
  waitMinutes: number;
  pollSeconds: number;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
  /** Progress lines (stderr in the CLI, so stdout holds the contract only). */
  log: (line: string) => void;
}

export type RunResult =
  | IntegrationFound
  | { kind: "invalid"; problem: string }
  | { kind: "timeout"; ref: string }
  | { kind: "busy"; ref: string; otherSha: string }
  | { kind: "push-failed"; ref: string; reason: string }
  | { kind: "unreachable"; reason: string }
  | { kind: "wait-unreachable"; ref: string; reason: string };

/**
 * Starts the remote run for `sha` by pushing `refs/heads/<refPrefix><name>` and waits for its note. A ref that
 * already points at another commit is someone else's run: refused, never replaced. A ref already on `sha` is this
 * run, started earlier: waited for without a push. A wait in which no fetch of the notes reached the remote ends
 * `wait-unreachable` with git's last reason, not `timeout`.
 */
export async function runIntegration(options: RunOptions): Promise<RunResult> {
  const ref = `refs/heads/${options.refPrefix ?? INTEGRATION_BRANCH_PREFIX}${options.name}`;
  const notesRef = getNotesRef(options);
  // Read the stored note before the push: a fast run could otherwise replace it before it is read, and the wait
  // below would never see a change.
  // A failed fetch would leave `before` stale, and an older note fetched later would pass for this run's result.
  const fetchedBefore = fetchIntegrationNotes(options.cwd, options.remote, notesRef);
  if (!fetchedBefore.ok) return { kind: "unreachable", reason: fetchedBefore.reason };
  const before = readNoteText(options.cwd, notesRef, options.sha);
  const current = readRemoteRef(options.cwd, options.remote, ref);
  if (current.kind === "unreachable") return { kind: "unreachable", reason: current.reason };
  if (current.kind === "at" && current.sha !== options.sha) return { kind: "busy", ref, otherSha: current.sha };
  if (current.kind === "at") {
    options.log(`${ref} already points at ${options.sha.slice(0, 8)}: waiting for that run`);
  } else {
    const pushed = pushCommitToRef(options.cwd, options.remote, options.sha, ref);
    if (!pushed.ok) return { kind: "push-failed", ref, reason: pushed.reason };
    options.log(`pushed ${options.sha.slice(0, 8)} to ${ref}: waiting for the result note`);
  }
  const deadline = options.now() + options.waitMinutes * 60_000;
  // A wait in which no fetch reached the remote ends unreachable with the last reason, not as a run that took too long.
  let unreachableReason: string | null = null;
  let hasFetched = false;
  for (;;) {
    const fetched = fetchIntegrationNotes(options.cwd, options.remote, notesRef);
    if (fetched.ok) {
      hasFetched = true;
      unreachableReason = null;
    } else {
      options.log(`could not fetch the result notes (${fetched.reason}); trying again`);
      if (!hasFetched) unreachableReason = fetched.reason;
    }
    const text = readNoteText(options.cwd, notesRef, options.sha);
    if (text !== null && text !== before) {
      const branch = fetchMainBranch(options.cwd, options.remote, options.main);
      if (!branch.ok) options.log(`could not fetch ${options.main} (${branch.reason}); new-red compares with its last fetched state`);
      return toLookup(options, text, options.main);
    }
    const remaining = deadline - options.now();
    if (remaining <= 0) return unreachableReason === null ? { kind: "timeout", ref } : { kind: "wait-unreachable", ref, reason: unreachableReason };
    await options.sleep(Math.min(options.pollSeconds * 1000, remaining));
  }
}
