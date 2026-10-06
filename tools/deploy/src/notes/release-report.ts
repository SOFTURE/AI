import { z } from "zod";
import { formatMessage, type DeployMessages } from "../messages/index.js";
import { readSection, writeSection } from "./release-body.js";

/**
 * The living report of a deploy run in its GitHub Release (DF-10, after FIRE_TRACKER's `release-notes.ts`): the
 * pipeline status of the latest run, replaced by every run, and the deployment history, one row per run with the
 * newest on top, so a rerun or a rollback adds a row and never replaces an earlier one. The facts come from
 * `deploy-report.json`, which the `summary` job of `deploy-app.yml` writes: each job's result and the server's
 * `step|…` and `result|…` lines (init's `deploy.sh`).
 */

const HTTPS_URL = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?\/[A-Za-z0-9_./-]*$/;

export const deployReportSchema = z.strictObject({
  version: z.literal(1),
  tag: z.string(),
  environment: z.string(),
  image: z.string(),
  digest: z.string(),
  runUrl: z.string().regex(HTTPS_URL, "an https:// URL of the run"),
  finishedAt: z.iso.datetime(),
  jobs: z.array(z.strictObject({ name: z.string().min(1), result: z.string() })).min(1),
  serverLines: z.array(z.string()),
});

export type DeployReport = z.infer<typeof deployReportSchema>;

export type ParsedDeployReport = { ok: true; report: DeployReport } | { ok: false; problem: string };

export function parseDeployReport(json: unknown): ParsedDeployReport {
  const parsed = deployReportSchema.safeParse(json);
  if (parsed.success) return { ok: true, report: parsed.data };
  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".") ?? "";
  const keys = issue !== undefined && "keys" in issue && Array.isArray(issue.keys) ? ` (${issue.keys.join(", ")})` : "";
  return { ok: false, problem: `${path === "" ? "the file" : path}: ${issue?.message ?? "invalid"}${keys}` };
}

type JobResult = "success" | "failure" | "cancelled" | "skipped" | "pending";

const ICONS: Record<JobResult, string> = {
  success: "✅",
  failure: "❌",
  cancelled: "⛔",
  skipped: "⏭️",
  pending: "⏳",
};

/** A GitHub job result; anything else (an unknown or missing result) reads as pending. */
function toJobResult(value: string | undefined): JobResult {
  return (["success", "failure", "cancelled", "skipped"] as const).find((result) => result === value) ?? "pending";
}

/**
 * A value as it may stand in a table cell or a code span: letters, digits and a few punctuation marks; anything that
 * could end the cell, the code span or start HTML (`|`, backtick, `<`, a newline) becomes `?`.
 */
function toCell(value: string): string {
  return value.replace(/[^A-Za-z0-9 _.:@/+=,~%#-]/g, "?").slice(0, 200);
}

type RowCounts = Record<string, number>;

export interface ServerFacts {
  /** The step named by `result|failed|<step>|…`, or null when the server reported no failure. */
  failedStep: string | null;
  /** The backup file of `step|backup|ok|<file>`, or null. */
  backup: string | null;
  /** The row counts of the deploy: null when no line speaks of them, `counted: false` when the server skipped them. */
  counts: { counted: false } | { counted: true; before: RowCounts; after: RowCounts | null } | null;
}

/** `users=3,billing.plans=2` as counts; a pair that is not `<table>=<number>` is left out. */
function parseCounts(detail: string): RowCounts {
  const counts: RowCounts = {};
  for (const pair of detail.split(",")) {
    const match = /^([^=]+)=(\d+)$/.exec(pair.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) counts[match[1]] = Number(match[2]);
  }
  return counts;
}

/** The facts of the server's `step|<name>|ok[|<detail>]` and `result|…` lines. */
export function parseServerLines(lines: readonly string[]): ServerFacts {
  const detailOf = (step: string): string | null => {
    const line = lines.find((candidate) => candidate.startsWith(`step|${step}|ok`));
    if (line === undefined) return null;
    return line.split("|").slice(3).join("|");
  };
  const failure = lines.find((line) => line.startsWith("result|failed|"));
  const backup = detailOf("backup");
  const before = detailOf("row-counts-before");
  const after = detailOf("row-counts-after");
  let counts: ServerFacts["counts"] = null;
  if (before === "skipped") counts = { counted: false };
  else if (before !== null) counts = { counted: true, before: parseCounts(before), after: after === null ? null : parseCounts(after) };
  return {
    failedStep: failure === undefined ? null : (failure.split("|")[2] ?? null) || null,
    backup: backup === null || backup === "" ? null : backup,
    counts,
  };
}

/** `2026-10-06T14:05:09Z` as `2026-10-06 14:05` (UTC). */
function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function formatResult(result: JobResult, messages: DeployMessages): string {
  return `${ICONS[result]} ${messages.releaseReport.results[result]}`;
}

function renderStatus(report: DeployReport, messages: DeployMessages): string {
  const copy = messages.releaseReport;
  const lines = [`## ${copy.statusHeading}`, "", `| ${copy.job} | ${copy.result} |`, "| --- | --- |"];
  for (const job of report.jobs) lines.push(`| ${toCell(job.name)} | ${formatResult(toJobResult(job.result), messages)} |`);
  lines.push("", formatMessage(copy.lastRun, { time: formatTime(report.finishedAt), url: report.runUrl }));
  return lines.join("\n");
}

function findJobResult(report: DeployReport, name: string): JobResult {
  return toJobResult(report.jobs.find((job) => job.name === name)?.result);
}

function renderDeployResult(deploy: JobResult, facts: ServerFacts, messages: DeployMessages): string {
  const copy = messages.releaseReport;
  if (deploy === "success") return `${ICONS.success} ${copy.deployed}`;
  if (deploy === "failure" && facts.failedStep !== null) {
    return `${ICONS.failure} ${formatMessage(copy.failedAt, { step: toCell(facts.failedStep) })}`;
  }
  return formatResult(deploy, messages);
}

function renderDatabase(facts: ServerFacts, messages: DeployMessages): string {
  const copy = messages.releaseReport;
  const parts: string[] = [];
  if (facts.backup !== null) parts.push(`${copy.backup}: \`${toCell(facts.backup)}\``);
  if (facts.counts?.counted === false) parts.push(`${copy.rows}: ${copy.notCounted}`);
  if (facts.counts?.counted === true) {
    const { before, after } = facts.counts;
    const tables = Object.entries(before).map(([table, count]) => `${toCell(table)} ${count} → ${after?.[table] ?? "?"}`);
    parts.push(`${copy.rows}: ${tables.join(", ")}`);
  }
  return parts.length === 0 ? "—" : parts.join("<br>");
}

function renderImage(report: DeployReport): string {
  const parts: string[] = [];
  if (report.image !== "") parts.push(`\`${toCell(report.image)}\``);
  if (report.digest !== "") {
    const short = report.digest.length > 19 ? `${toCell(report.digest.slice(0, 19))}…` : toCell(report.digest);
    parts.push(`\`${short}\``);
  }
  return parts.length === 0 ? "—" : parts.join("<br>");
}

function renderDeploymentRow(report: DeployReport, messages: DeployMessages): string {
  const facts = parseServerLines(report.serverLines);
  const cells = [
    formatTime(report.finishedAt),
    renderDeployResult(findJobResult(report, "deploy"), facts, messages),
    report.environment === "" ? "—" : toCell(report.environment),
    renderImage(report),
    renderDatabase(facts, messages),
    formatResult(findJobResult(report, "verify"), messages),
    `[${messages.releaseReport.runLink}](${report.runUrl})`,
  ];
  return `| ${cells.join(" | ")} |`;
}

/** The table rows of an earlier deployments section: the lines after its separator row. */
function readEarlierRows(section: string | null): string[] {
  if (section === null) return [];
  const lines = section.split("\n");
  const separator = lines.findIndex((line) => /^\|\s*-{3}/.test(line));
  if (separator === -1) return [];
  return lines.slice(separator + 1).filter((line) => line.startsWith("|"));
}

function renderDeployments(previous: string | null, row: string, messages: DeployMessages): string {
  const copy = messages.releaseReport;
  const columns = [copy.when, copy.outcome, copy.environment, copy.image, copy.database, copy.verify, copy.run];
  return [
    `## ${copy.deploymentsHeading}`,
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    row,
    ...readEarlierRows(previous),
  ].join("\n");
}

/**
 * `body` with the run's pipeline status (replaced) and, unless the deploy job was skipped, a new deployment row on
 * top of the earlier ones. The owner's text and the other sections stay as they are.
 */
export function writeReleaseReport(body: string, report: DeployReport, messages: DeployMessages): string {
  const withStatus = writeSection(body, "status", renderStatus(report, messages));
  if (findJobResult(report, "deploy") === "skipped") return withStatus;
  const row = renderDeploymentRow(report, messages);
  return writeSection(withStatus, "deployments", renderDeployments(readSection(withStatus, "deployments"), row, messages));
}
