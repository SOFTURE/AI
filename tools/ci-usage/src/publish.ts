// Keeps one rolling issue per repository up to date with the latest report, and adds a comment per run, so people
// and agents (with the GitHub tools they already have) read the usage without the artifact.
import { z } from "zod";
import type { GithubClient } from "./github.js";
import { ciUsageMessages, formatMessage, type CiUsageMessages } from "./messages/index.js";
import { REPORT_MARKER, type CiUsageReport } from "./report.js";

export const ISSUE_LABEL = "ci-usage";
const LABEL_COLOR = "5319e7";
const LABEL_DESCRIPTION = "The CI usage report of @softure-ai/ci-usage";
/** GitHub refuses an issue body above 65,536 characters; a margin keeps the closing lines. */
export const MAX_BODY = 65_000;

const ISSUE = z.object({ number: z.number(), body: z.string().nullable().optional(), html_url: z.string(), pull_request: z.unknown().optional() });

export type PublishResult = { ok: true; issue: number; url: string; created: boolean } | { ok: false; error: string };

/** The issue body: the Markdown report, then the JSON in a collapsed block when the whole still fits. */
export function buildIssueBody(markdown: string, report: CiUsageReport, messages: CiUsageMessages = ciUsageMessages.en): string {
  const head = `${messages.issueIntro}\n\n${markdown.trimEnd()}\n`;
  const json = `\n<details><summary>${messages.jsonSummary}</summary>\n\n\`\`\`json\n${JSON.stringify(report)}\n\`\`\`\n\n</details>\n`;
  if (head.length + json.length <= MAX_BODY) return head + json;
  const note = `\n${messages.jsonTooLong}\n`;
  if (head.length + note.length <= MAX_BODY) return head + note;
  return `${head.slice(0, MAX_BODY - note.length - 2)}\n…${note}`;
}

export function buildComment(report: CiUsageReport, runUrl: string, messages: CiUsageMessages = ciUsageMessages.en): string {
  return formatMessage(messages.comment, {
    from: report.period.from.slice(0, 16).replace("T", " "),
    to: report.period.to.slice(0, 16).replace("T", " "),
    minutes: report.totals.minutes,
    usd: report.totals.usd === null ? messages.unknown : report.totals.usd.toFixed(2),
    runs: report.totals.runs,
    url: runUrl,
  });
}

async function ensureLabel(client: GithubClient, repository: string): Promise<string | null> {
  const found = await client.get(`/repos/${repository}/labels/${ISSUE_LABEL}`);
  if (found.ok) return null;
  if (found.kind === "http" && found.status !== 404) return found.message;
  const created = await client.send("POST", `/repos/${repository}/labels`, { name: ISSUE_LABEL, color: LABEL_COLOR, description: LABEL_DESCRIPTION });
  // 422: another run created it in the meantime.
  if (!created.ok && !(created.kind === "http" && created.status === 422)) return created.message;
  return null;
}

async function findIssue(client: GithubClient, repository: string, state: "open" | "all"): Promise<{ ok: true; number: number | null } | { ok: false; error: string }> {
  const listed = await client.get(`/repos/${repository}/issues`, { labels: ISSUE_LABEL, state, per_page: "100" });
  if (!listed.ok) return { ok: false, error: listed.message };
  const issues = z.array(ISSUE).safeParse(listed.data);
  if (!issues.success) return { ok: false, error: `GET /repos/${repository}/issues answered an unexpected shape` };
  const ours = issues.data.filter((issue) => issue.pull_request === undefined && (issue.body ?? "").includes(REPORT_MARKER)).sort((a, b) => a.number - b.number);
  return { ok: true, number: ours[0]?.number ?? null };
}

export interface PublishOptions {
  client: GithubClient;
  repository: string;
  report: CiUsageReport;
  markdown: string;
  runUrl: string;
  messages?: CiUsageMessages;
  /**
   * Keep the issue closed: reuse the report's issue whether it is open or closed, and close it after every update,
   * so a finished report stays out of the open-issue queue and is still found by its label.
   */
  close?: boolean;
}

/** Closed issues are fields of the same PATCH, so a closed report never shows as open in between. */
const CLOSED_STATE = { state: "closed", state_reason: "completed" } as const;

/** Creates the issue the first time, replaces its body afterwards, and comments the run's totals. */
export async function publishReport(options: PublishOptions): Promise<PublishResult> {
  const { client, repository } = options;
  const messages = options.messages ?? ciUsageMessages.en;
  const labelError = await ensureLabel(client, repository);
  if (labelError !== null) return { ok: false, error: labelError };
  const close = options.close === true;
  const found = await findIssue(client, repository, close ? "all" : "open");
  if (!found.ok) return found;
  const body = buildIssueBody(options.markdown, options.report, messages);
  let number = found.number;
  let url: string;
  const created = number === null;
  if (number === null) {
    const result = await client.send("POST", `/repos/${repository}/issues`, { title: messages.title, body, labels: [ISSUE_LABEL] });
    if (!result.ok) return { ok: false, error: result.message };
    const issue = ISSUE.safeParse(result.data);
    if (!issue.success) return { ok: false, error: `POST /repos/${repository}/issues answered an unexpected shape` };
    number = issue.data.number;
    url = issue.data.html_url;
  } else {
    const result = await client.send("PATCH", `/repos/${repository}/issues/${String(number)}`, close ? { body, ...CLOSED_STATE } : { body });
    if (!result.ok) return { ok: false, error: result.message };
    const issue = ISSUE.safeParse(result.data);
    url = issue.success ? issue.data.html_url : `https://github.com/${repository}/issues/${String(number)}`;
  }
  const comment = await client.send("POST", `/repos/${repository}/issues/${String(number)}/comments`, { body: buildComment(options.report, options.runUrl, messages) });
  if (!comment.ok) return { ok: false, error: comment.message };
  if (close && created) {
    // An issue is always created open; it is closed once its first comment is in.
    const closed = await client.send("PATCH", `/repos/${repository}/issues/${String(number)}`, CLOSED_STATE);
    if (!closed.ok) return { ok: false, error: closed.message };
  }
  return { ok: true, issue: number, url, created };
}
