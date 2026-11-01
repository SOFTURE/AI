// The smoke check after a deploy: the build info the app answers (`@softure-ai/ops`'s build info route) against the
// release just deployed. A stale container, a failed pull or a rolled-back stack still passes the health route; it
// answers another release, another commit or a start time before the deploy.
import { z } from "zod";

/** The part of the build info the smoke check reads; other fields (a changelog) are allowed and ignored. */
export const buildInfoSchema = z.object({
  release: z.string().nullable(),
  commit: z.string().nullable(),
  builtAt: z.string().nullable().optional(),
  startedAt: z.string(),
});

export type SmokeBuildInfo = z.infer<typeof buildInfoSchema>;

export type SmokeCheckKind = "release" | "commit" | "started" | "field";

/** One row of the smoke check; a `field` check names the app's own build info field it compared. */
export type SmokeCheck =
  | { kind: Exclude<SmokeCheckKind, "field">; passed: boolean; detail: string }
  | { kind: "field"; field: string; passed: boolean; detail: string };

/** A value an app's own build info field must equal: JSON text, a number, a boolean or null. */
export type SmokeFieldValue = string | number | boolean | null;

export interface SmokeExpectation {
  /** The release tag that was deployed. */
  tag: string;
  /** The tag's commit; absent skips the commit check. */
  commit?: string;
  /** When the deploy sent the release; absent skips the start time check. */
  deployedAt?: Date;
  /** Clock difference between the runner and the server that still passes; default 60 s. */
  toleranceSeconds?: number;
  /** The app's own build info fields and the values they must equal (issue #922); absent checks none. */
  fields?: Readonly<Record<string, SmokeFieldValue>>;
}

export const DEFAULT_TOLERANCE_SECONDS = 60;

/** A short build commit (7 hex digits or more) passes when it starts the tag's full commit. */
const MIN_COMMIT_LENGTH = 7;

function checkRelease(info: SmokeBuildInfo, tag: string): SmokeCheck {
  if (info.release === null) {
    return { kind: "release", passed: false, detail: `no release (SOFTURE_RELEASE is unset in the container), expected ${tag}` };
  }
  const passed = info.release === tag;
  return { kind: "release", passed, detail: passed ? `release ${tag}` : `release ${info.release}, expected ${tag}` };
}

function checkCommit(info: SmokeBuildInfo, commit: string): SmokeCheck {
  const expected = commit.toLowerCase();
  if (info.commit === null) {
    return { kind: "commit", passed: false, detail: `no commit (the build did not set SOFTURE_BUILD_COMMIT), expected ${expected}` };
  }
  const actual = info.commit.toLowerCase();
  const passed = actual.length >= MIN_COMMIT_LENGTH && expected.startsWith(actual);
  return { kind: "commit", passed, detail: passed ? `commit ${actual}` : `commit ${actual}, expected ${expected}` };
}

function checkStarted(info: SmokeBuildInfo, deployedAt: Date, toleranceSeconds: number): SmokeCheck {
  const started = Date.parse(info.startedAt);
  if (Number.isNaN(started)) {
    return { kind: "started", passed: false, detail: `startedAt ${JSON.stringify(info.startedAt)} is not a time` };
  }
  const passed = started >= deployedAt.getTime() - toleranceSeconds * 1000;
  const startedText = new Date(started).toISOString();
  return {
    kind: "started",
    passed,
    detail: passed
      ? `started ${startedText}, after the deploy at ${deployedAt.toISOString()}`
      : `started ${startedText}, before the deploy at ${deployedAt.toISOString()} (tolerance ${toleranceSeconds} s): an old container answers`,
  };
}

/** Strict equality: the text "3" is not the number 3, so a type mix-up fails and the detail shows both as JSON. */
function checkField(answer: Readonly<Record<string, unknown>>, field: string, expected: SmokeFieldValue): SmokeCheck {
  const expectedText = JSON.stringify(expected);
  if (!Object.hasOwn(answer, field)) {
    return { kind: "field", field, passed: false, detail: `no ${field} in the build info, expected ${expectedText}` };
  }
  const actual = answer[field];
  const passed = actual === expected;
  const actualText = JSON.stringify(actual) ?? String(actual);
  return { kind: "field", field, passed, detail: passed ? `${field} ${actualText}` : `${field} ${actualText}, expected ${expectedText}` };
}

/**
 * Every check the expectation asks for, in a fixed order: release, commit, start time, then the app's fields in the
 * order given. `answer` is the whole JSON object the route answered, where the app's own fields live.
 */
export function runSmokeChecks(info: SmokeBuildInfo, expectation: SmokeExpectation, answer: Readonly<Record<string, unknown>> = info): SmokeCheck[] {
  const tolerance = expectation.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  return [
    checkRelease(info, expectation.tag),
    ...(expectation.commit === undefined ? [] : [checkCommit(info, expectation.commit)]),
    ...(expectation.deployedAt === undefined ? [] : [checkStarted(info, expectation.deployedAt, tolerance)]),
    ...Object.entries(expectation.fields ?? {}).map(([field, expected]) => checkField(answer, field, expected)),
  ];
}

/** The name a check goes by in the report and the failure line: its kind, or the field it compared. */
export function getSmokeCheckName(check: SmokeCheck): string {
  return check.kind === "field" ? check.field : check.kind;
}

/** The checks as a table, the same shape `verify` prints. */
export function formatSmokeReport(checks: readonly SmokeCheck[], url: string): string {
  const rows = checks.map((check) => [check.passed ? "PASS" : "FAIL", getSmokeCheckName(check), check.detail]);
  const header = ["Result", "Check", "Detail"];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)));
  const format = (row: readonly string[]) =>
    row
      .map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0)))
      .join("  ")
      .trimEnd();
  return [`Build info of ${url}`, format(header), ...rows.map(format), ""].join("\n");
}
