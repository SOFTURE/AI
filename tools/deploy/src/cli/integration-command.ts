import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isSafeRef } from "../notes/git.js";
import { isSafeRemote, resolveSha } from "../integration/git-notes.js";
import { readJunitCounts } from "../integration/junit.js";
import { INTEGRATION_NOTES_REF } from "../integration/note.js";
import { readPlaywrightJsonCounts } from "../integration/playwright-json.js";
import type { SuiteCounts } from "../integration/suite-counts.js";
import {
  INTEGRATION_BRANCH_PREFIX,
  lookupIntegration,
  recordIntegration,
  runIntegration,
} from "../integration/run-integration.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";
import { readFlags } from "./options.js";

/**
 * `softure-deploy integration run|lookup|record`: the remote integration run of the SOFTURE skills
 * (`integration.remote` and `integration.lookup` in `context/workflow.json`, read by `wt-integration.sh`).
 * Exit codes follow that contract: run 0 green, 1 red or could not start, 75 no result in time; lookup 0 green,
 * 1 red, 3 no result.
 */

export const NO_RESULT_IN_TIME_EXIT_CODE = 75;
export const NO_STORED_RESULT_EXIT_CODE = 3;
const DEFAULT_WAIT_MINUTES = 30;
const DEFAULT_POLL_SECONDS = 15;
const DEFAULT_MAIN_BRANCH = "main";
const NAME = /^[A-Za-z0-9._/-]+$/;
const NOTES_REF = /^refs\/notes\/[A-Za-z0-9._/-]+$/;
const REF_PREFIX = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\/$/;
const RESULT_FORMATS = ["junit", "playwright-json"] as const;
type ResultFormat = (typeof RESULT_FORMATS)[number];

function readSha(command: string, io: CliIo, value: string | undefined): string {
  const ref = value ?? io.env.INTEGRATION_SHA ?? "HEAD";
  if (!isSafeRef(ref)) fail(`${command}: --sha must name a commit, got ${JSON.stringify(ref)}.`, USAGE_EXIT_CODE);
  const sha = resolveSha(io.cwd, ref);
  if (sha === null) fail(`${command}: ${ref} names no commit in this repository.`);
  return sha;
}

function readRemote(command: string, value: string): string {
  if (!isSafeRemote(value)) fail(`${command}: --remote must be a remote name, got ${JSON.stringify(value)}.`, USAGE_EXIT_CODE);
  return value;
}

function readNotesRef(command: string, value: string | undefined): string {
  if (value === undefined) return INTEGRATION_NOTES_REF;
  if (!NOTES_REF.test(value) || !isSafeRef(value)) {
    fail(`${command}: --notes-ref must be a ref under refs/notes/, got ${JSON.stringify(value)}.`, USAGE_EXIT_CODE);
  }
  return value;
}

function readRefPrefix(command: string, value: string | undefined): string {
  if (value === undefined) return INTEGRATION_BRANCH_PREFIX;
  if (!REF_PREFIX.test(value) || !isSafeRef(`${value}x`)) {
    fail(`${command}: --ref-prefix must be a branch prefix ending in / (e.g. integration/), got ${JSON.stringify(value)}.`, USAGE_EXIT_CODE);
  }
  return value;
}

function readName(command: string, value: string | undefined, refPrefix: string = INTEGRATION_BRANCH_PREFIX): string {
  if (value === undefined || value === "") fail(`${command}: --name (or INTEGRATION_NAME) is required.`, USAGE_EXIT_CODE);
  if (!NAME.test(value) || !isSafeRef(`${refPrefix}${value}`)) {
    fail(`${command}: --name may hold letters, digits and . _ - / only, got ${JSON.stringify(value)}.`, USAGE_EXIT_CODE);
  }
  return value;
}

function readWholeNumber(command: string, flag: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) fail(`${command}: --${flag} must be a whole number, got ${JSON.stringify(value)}.`, USAGE_EXIT_CODE);
  return Number(value);
}

/** `--main`, else `mainBranch` of `context/workflow.json` (the skills' config), else `main`. */
function readMainBranch(command: string, io: CliIo, value: string | undefined): string {
  let main = value;
  const configPath = resolve(io.cwd, "context/workflow.json");
  if (main === undefined && existsSync(configPath)) {
    try {
      const config: unknown = JSON.parse(readFileSync(configPath, "utf8"));
      if (typeof config === "object" && config !== null && "mainBranch" in config && typeof config.mainBranch === "string") {
        main = config.mainBranch;
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      fail(`${command}: context/workflow.json is not JSON.`);
    }
  }
  main ??= DEFAULT_MAIN_BRANCH;
  if (!isSafeRef(main)) fail(`${command}: --main must be a branch name, got ${JSON.stringify(main)}.`, USAGE_EXIT_CODE);
  return main;
}

/** `softure-deploy integration lookup [--sha=HEAD] [--remote=origin] [--main=<branch>] [--notes-ref=refs/notes/integration]` */
export function runIntegrationLookup(args: string[], io: CliIo): void {
  const command = "integration lookup";
  const flags = readFlags(command, args, {
    sha: { type: "string" },
    remote: { type: "string", default: "origin" },
    main: { type: "string" },
    "notes-ref": { type: "string" },
  });
  const remote = readRemote(command, flags.remote);
  const notesRef = readNotesRef(command, flags["notes-ref"]);
  const main = readMainBranch(command, io, flags.main);
  const sha = readSha(command, io, flags.sha);
  const found = lookupIntegration({ cwd: io.cwd, remote, notesRef, sha, main });
  if (found.kind === "none") fail(`${command}: no stored result for ${sha.slice(0, 8)}.`, NO_STORED_RESULT_EXIT_CODE);
  if (found.kind === "invalid") {
    fail(`${command}: the note on ${sha.slice(0, 8)} is not a result (${found.problem}).`, NO_STORED_RESULT_EXIT_CODE);
  }
  io.stdout(found.lines);
  if (found.note.result === "red") fail(`${command}: the stored result for ${sha.slice(0, 8)} is red.`);
}

/**
 * `softure-deploy integration run [--name=<n>] [--sha=HEAD] [--wait-minutes=30] [--remote=origin] [--main=<branch>]
 * [--poll-seconds=15] [--ref-prefix=integration/] [--notes-ref=refs/notes/integration]`; `INTEGRATION_NAME`, `INTEGRATION_SHA` and `INTEGRATION_WAIT_MINUTES` stand in for the flags.
 */
export async function runIntegrationRun(args: string[], io: CliIo): Promise<void> {
  const command = "integration run";
  const flags = readFlags(command, args, {
    name: { type: "string" },
    sha: { type: "string" },
    "wait-minutes": { type: "string" },
    remote: { type: "string", default: "origin" },
    main: { type: "string" },
    "poll-seconds": { type: "string" },
    "ref-prefix": { type: "string" },
    "notes-ref": { type: "string" },
  });
  const refPrefix = readRefPrefix(command, flags["ref-prefix"]);
  const notesRef = readNotesRef(command, flags["notes-ref"]);
  const name = readName(command, flags.name ?? io.env.INTEGRATION_NAME, refPrefix);
  const waitMinutes = readWholeNumber(command, "wait-minutes", flags["wait-minutes"] ?? io.env.INTEGRATION_WAIT_MINUTES, DEFAULT_WAIT_MINUTES);
  const pollSeconds = Math.max(1, readWholeNumber(command, "poll-seconds", flags["poll-seconds"], DEFAULT_POLL_SECONDS));
  const remote = readRemote(command, flags.remote);
  const main = readMainBranch(command, io, flags.main);
  const sha = readSha(command, io, flags.sha);
  const result = await runIntegration({
    cwd: io.cwd,
    remote,
    notesRef,
    refPrefix,
    sha,
    name,
    main,
    waitMinutes,
    pollSeconds,
    sleep: (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
    now: () => Date.now(),
    log: (line) => io.stderr(`${command}: ${line}\n`),
  });
  switch (result.kind) {
    case "busy":
      return fail(`${command}: ${result.ref} is in use by ${result.otherSha.slice(0, 8)} (a run in progress, or a stale ref to delete).`);
    case "unreachable":
      return fail(`${command}: cannot reach ${remote}; the run did not start.`);
    case "push-failed":
      return fail(`${command}: ${remote} refused ${result.ref}; the run did not start.`);
    case "timeout":
      return fail(`${command}: no result for ${sha.slice(0, 8)} within ${String(waitMinutes)} minutes (${result.ref}).`, NO_RESULT_IN_TIME_EXIT_CODE);
    case "invalid":
      return fail(`${command}: the note on ${sha.slice(0, 8)} is not a result (${result.problem}).`);
    case "found":
      io.stdout(result.lines);
      if (result.note.result === "red") fail(`${command}: ${sha.slice(0, 8)} is red.`);
  }
}

interface ResultsReport {
  path: string;
  format: ResultFormat;
}

/** `--results` with `--format` (by extension when not given: `.json` is Playwright), or the older `--junit`. */
function readResultsReport(command: string, flags: { results?: string; junit?: string; format?: string }): ResultsReport | null {
  if (flags.junit !== undefined && flags.results !== undefined) fail(`${command}: give --junit and --results, not both.`, USAGE_EXIT_CODE);
  const path = flags.results ?? flags.junit;
  if (flags.format !== undefined && flags.results === undefined) fail(`${command}: --format needs --results.`, USAGE_EXIT_CODE);
  if (path === undefined || path === "") return null;
  if (flags.junit !== undefined) return { path, format: "junit" };
  const format = flags.format ?? (path.endsWith(".json") ? "playwright-json" : "junit");
  if (!RESULT_FORMATS.includes(format as ResultFormat)) {
    fail(`${command}: --format must be junit or playwright-json, got ${JSON.stringify(format)}.`, USAGE_EXIT_CODE);
  }
  return { path, format: format as ResultFormat };
}

function readCounts(command: string, io: CliIo, report: ResultsReport | null): SuiteCounts | null {
  if (report === null) return null;
  const fullPath = resolve(io.cwd, report.path);
  // A suite that died before writing its report has no counts; the result still says red.
  if (!existsSync(fullPath)) {
    io.stderr(`${command}: ${report.path} does not exist; the note has no counts.\n`);
    return null;
  }
  const text = readFileSync(fullPath, "utf8");
  if (report.format === "junit") return readJunitCounts(text);
  const read = readPlaywrightJsonCounts(text);
  if (read.ok) return read.counts;
  io.stderr(`${command}: ${report.path} is not a Playwright JSON report (${read.problem}); the note has no counts.\n`);
  return null;
}

/** The run's name: the part after the prefix of an integration branch, else the branch (or tag) name. */
function toRunName(ref: string, refPrefix: string): string {
  const branch = ref.replace(/^refs\/(heads|tags)\//, "");
  return branch.startsWith(refPrefix) ? branch.slice(refPrefix.length) : branch;
}

/**
 * `softure-deploy integration record --sha=<sha> --ref=<ref> --result=green|red [--results=<file>
 * [--format=junit|playwright-json]] [--fail-on-flaky] [--run=<url>] [--name=<n>] [--remote=origin]
 * [--ref-prefix=integration/] [--notes-ref=refs/notes/integration]`: the workflow's last step, which stores the result
 * as a note on the tested commit. `--junit=<file>` is `--results=<file> --format=junit`. With `--fail-on-flaky`, a
 * report naming a flaky test stores red and exits 1.
 */
export function runIntegrationRecord(args: string[], io: CliIo): void {
  const command = "integration record";
  const flags = readFlags(command, args, {
    sha: { type: "string" },
    ref: { type: "string" },
    result: { type: "string" },
    junit: { type: "string" },
    results: { type: "string" },
    format: { type: "string" },
    "fail-on-flaky": { type: "boolean", default: false },
    run: { type: "string" },
    name: { type: "string" },
    remote: { type: "string", default: "origin" },
    "ref-prefix": { type: "string" },
    "notes-ref": { type: "string" },
  });
  if (flags.sha === undefined) fail(`${command}: --sha is required (the tested commit).`, USAGE_EXIT_CODE);
  if (flags.ref === undefined || !isSafeRef(flags.ref)) fail(`${command}: --ref must name the ref the run was started by.`, USAGE_EXIT_CODE);
  if (flags.result !== "green" && flags.result !== "red") fail(`${command}: --result must be green or red.`, USAGE_EXIT_CODE);
  const run = flags.run === undefined || flags.run === "" ? null : flags.run;
  if (run !== null && !/^https:\/\/\S+$/.test(run)) fail(`${command}: --run must be an https:// URL.`, USAGE_EXIT_CODE);
  const report = readResultsReport(command, flags);
  const remote = readRemote(command, flags.remote);
  const refPrefix = readRefPrefix(command, flags["ref-prefix"]);
  const notesRef = readNotesRef(command, flags["notes-ref"]);
  const name = readName(command, flags.name ?? toRunName(flags.ref, refPrefix), refPrefix);
  const sha = readSha(command, io, flags.sha);
  const counts = readCounts(command, io, report);
  const flakyCount = counts?.flaky.length ?? 0;
  const isFailedOnFlaky = flags["fail-on-flaky"] && flakyCount > 0;
  const recorded = recordIntegration({
    cwd: io.cwd,
    remote,
    notesRef,
    sha,
    name,
    ref: flags.ref,
    result: isFailedOnFlaky ? "red" : flags.result,
    counts,
    run,
    finishedAt: new Date(),
  });
  if (recorded.kind === "push-failed") fail(`${command}: ${remote} refused the notes after ${String(recorded.attempts)} attempts.`);
  const { note } = recorded;
  const countsText = note.total === null ? "" : ` (${String(note.passed)}/${String(note.total)})`;
  io.stdout(`${command}: ${note.result}${countsText} stored on ${sha.slice(0, 8)}\n`);
  if (isFailedOnFlaky) {
    fail(`${command}: ${String(flakyCount)} flaky test${flakyCount === 1 ? "" : "s"} and --fail-on-flaky: stored as red.`);
  }
}
