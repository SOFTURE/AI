import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { getBillingUsage, parseBillingAccount } from "../billing.js";
import { collectRepository, parseRunCache, type CollectResult, type RunCache } from "../collect.js";
import { createGithubClient, DEFAULT_RESERVE, type FetchLike } from "../github.js";
import { parsePriceOverrides } from "../prices.js";
import { publishReport } from "../publish.js";
import { buildReport, JSON_FILE, MARKDOWN_FILE, renderMarkdown, type BuildReportOptions, type CiUsageReport } from "../report.js";

export interface CommandContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  write: (text: string) => void;
  writeError: (text: string) => void;
  /** Replaces the network in tests. */
  fetch?: FetchLike;
  now?: () => Date;
}

export const DEFAULT_DAYS = 7;
const DAY_MS = 86_400_000;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const USAGE = `Usage:
  softure-ci-usage report [--repository <owner/name>[,<owner/name>…]] [--days ${String(DEFAULT_DAYS)} | --from <date> --to <date>]
                          [--out-dir .] [--prices <json>] [--ubicloud-premium] [--billing org:<name>|user:<name>]
                          [--cache <file>] [--reserve ${String(DEFAULT_RESERVE)}] [--max-minutes <n>]
  softure-ci-usage publish [--repository <owner/name>] [--report-dir .] [--run-url <url>] [--close]

report   reads the finished workflow runs of the period through the Actions API and writes ${JSON_FILE} and ${MARKDOWN_FILE}:
         billable minutes and estimated USD per repository, workflow and job, on GitHub-hosted, Ubicloud and other runners.
publish  keeps the issue labelled ci-usage in the repository up to date with the report and comments the run's totals;
         --close keeps that issue closed (it is reused open or closed, and closed after every update).

The token comes from GITHUB_TOKEN (or GH_TOKEN): "Actions: read" on every repository for report (plus organization
"Administration: read" or user "Plan: read" for --billing), "Issues: write" for publish. The repository defaults to
GITHUB_REPOSITORY. --max-minutes stops reading runs after that many minutes (no limit when unset). A report that
could not count every run is marked partial and still exits 0.`;

function getToken(env: NodeJS.ProcessEnv): string | undefined {
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
  return token === undefined || token === "" ? undefined : token;
}

/** An empty value means "not set", so a workflow can always pass its input through. */
function toOptional(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

export function parseRepositories(values: readonly string[] | undefined, env: NodeJS.ProcessEnv): { ok: true; repositories: string[] } | { ok: false; error: string } {
  const listed = (values ?? []).flatMap((value) => value.split(/[\s,]+/)).filter((value) => value !== "");
  const repositories = listed.length > 0 ? [...new Set(listed)] : env.GITHUB_REPOSITORY ? [env.GITHUB_REPOSITORY] : [];
  if (repositories.length === 0) return { ok: false, error: "--repository is required outside GitHub Actions (owner/name)" };
  const wrong = repositories.find((repository) => !REPOSITORY.test(repository));
  return wrong === undefined ? { ok: true, repositories } : { ok: false, error: `--repository must be owner/name, not "${wrong}"` };
}

function parseDate(name: string, value: string): Date | string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? `--${name} must be a date (YYYY-MM-DD) or an ISO time, not "${value}"` : date;
}

export function parsePeriod(values: { days?: string; from?: string; to?: string }, now: Date): { ok: true; from: Date; to: Date } | { ok: false; error: string } {
  const fromValue = toOptional(values.from);
  const toValue = toOptional(values.to);
  if (fromValue !== undefined || toValue !== undefined) {
    if (fromValue === undefined) return { ok: false, error: "--to needs --from" };
    const from = parseDate("from", fromValue);
    if (typeof from === "string") return { ok: false, error: from };
    const to = toValue === undefined ? now : parseDate("to", toValue);
    if (typeof to === "string") return { ok: false, error: to };
    return from < to ? { ok: true, from, to } : { ok: false, error: "--from must be before --to" };
  }
  const daysValue = toOptional(values.days);
  const days = daysValue === undefined ? DEFAULT_DAYS : Number(daysValue);
  if (!Number.isInteger(days) || days < 1 || days > 31) return { ok: false, error: `--days must be a whole number from 1 to 31, not "${String(daysValue)}"` };
  return { ok: true, from: new Date(now.getTime() - days * DAY_MS), to: now };
}

function readCache(path: string | undefined): RunCache {
  if (path === undefined || !existsSync(path)) return parseRunCache(null);
  return parseRunCache(readFileSync(path, "utf8"));
}

function writeFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

async function runReport(args: string[], context: CommandContext): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      repository: { type: "string", multiple: true },
      days: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      "out-dir": { type: "string", default: "." },
      prices: { type: "string" },
      "ubicloud-premium": { type: "boolean", default: false },
      billing: { type: "string" },
      cache: { type: "string" },
      reserve: { type: "string" },
      "max-minutes": { type: "string" },
    },
  });
  const now = context.now?.() ?? new Date();
  const repositories = parseRepositories(values.repository, context.env);
  const period = parsePeriod(values, now);
  const prices = parsePriceOverrides(values.prices);
  const billing = parseBillingAccount(values.billing);
  const reserve = toOptional(values.reserve) === undefined ? DEFAULT_RESERVE : Number(values.reserve);
  const maxMinutes = toOptional(values["max-minutes"]) === undefined ? undefined : Number(values["max-minutes"]);
  const errors = [
    repositories.ok ? null : repositories.error,
    period.ok ? null : period.error,
    prices.ok ? null : prices.error,
    billing === null || billing.ok ? null : billing.error,
    Number.isInteger(reserve) && reserve >= 0 ? null : `--reserve must be a whole number of requests, not "${String(values.reserve)}"`,
    maxMinutes === undefined || (Number.isInteger(maxMinutes) && maxMinutes >= 1) ? null : `--max-minutes must be a whole number of minutes, 1 or more, not "${String(values["max-minutes"])}"`,
  ].filter((error): error is string => error !== null);
  const token = getToken(context.env);
  if (token === undefined) errors.push("GITHUB_TOKEN (or GH_TOKEN) is not set");
  if (errors.length > 0 || !repositories.ok || !period.ok || !prices.ok || token === undefined) {
    context.writeError(`${errors.join("\n")}\n\n${USAGE}\n`);
    return 1;
  }

  const client = createGithubClient({ token, reserve, ...(context.fetch ? { fetch: context.fetch } : {}) });
  const cachePath = toOptional(values.cache) === undefined ? undefined : resolve(context.cwd, String(values.cache));
  const cache = readCache(cachePath);
  const deadline = maxMinutes === undefined ? undefined : new Date(now.getTime() + maxMinutes * 60_000);
  const clock = context.now ?? ((): Date => new Date());
  const collected: CollectResult[] = [];
  for (const repository of repositories.repositories) {
    collected.push(await collectRepository({ client, repository, from: period.from, to: period.to, cache, now: clock, ...(deadline === undefined ? {} : { deadline }) }));
  }
  let billingResult: BuildReportOptions["billing"] = null;
  if (billing?.ok) {
    const result = await getBillingUsage({ client, account: billing.account, repositories: repositories.repositories, from: period.from, to: period.to });
    billingResult = result.ok ? { byRepository: result.byRepository } : { error: result.error };
  }
  const report = buildReport({
    collected,
    from: period.from,
    to: period.to,
    generatedAt: now,
    priceOptions: { prices: prices.prices, ubicloudPremium: values["ubicloud-premium"] },
    billing: billingResult,
  });
  const outDir = resolve(context.cwd, values["out-dir"]);
  writeFile(join(outDir, JSON_FILE), `${JSON.stringify(report, null, 2)}\n`);
  writeFile(join(outDir, MARKDOWN_FILE), renderMarkdown(report));
  if (cachePath !== undefined) {
    const merged: RunCache = { version: 1, runs: Object.assign({}, ...collected.map((result) => result.cache.runs)) as RunCache["runs"] };
    writeFile(cachePath, JSON.stringify(merged));
  }

  for (const repository of report.repositories) {
    const usd = repository.usd === null ? "unknown" : repository.usd.toFixed(2);
    context.write(repository.error === null ? `${repository.repository}: ${String(repository.minutes)} minutes, ${usd} USD, ${String(repository.runs)} runs${repository.partial.length > 0 ? " (partial)" : ""}\n` : `${repository.repository}: not read (${repository.error})\n`);
  }
  context.write(`requests: ${String(client.getRequestCount())}, rate limit left: ${String(client.getRemaining() ?? "unknown")}\n`);
  return report.repositories.every((repository) => repository.error !== null) ? 1 : 0;
}

async function runPublish(args: string[], context: CommandContext): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      repository: { type: "string" },
      "report-dir": { type: "string", default: "." },
      "run-url": { type: "string" },
      close: { type: "boolean", default: false },
    },
  });
  const repositories = parseRepositories(values.repository === undefined ? undefined : [values.repository], context.env);
  const token = getToken(context.env);
  const dir = resolve(context.cwd, values["report-dir"]);
  const errors: string[] = [];
  if (!repositories.ok) errors.push(repositories.error);
  else if (repositories.repositories.length !== 1) errors.push("publish takes one --repository");
  if (token === undefined) errors.push("GITHUB_TOKEN (or GH_TOKEN) is not set");
  if (!existsSync(join(dir, JSON_FILE)) || !existsSync(join(dir, MARKDOWN_FILE))) errors.push(`${JSON_FILE} and ${MARKDOWN_FILE} are not in ${dir}: run report first`);
  const repository = repositories.ok ? repositories.repositories[0] : undefined;
  if (errors.length > 0 || token === undefined || repository === undefined) {
    context.writeError(`${errors.join("\n")}\n\n${USAGE}\n`);
    return 1;
  }
  const report = JSON.parse(readFileSync(join(dir, JSON_FILE), "utf8")) as CiUsageReport;
  const markdown = readFileSync(join(dir, MARKDOWN_FILE), "utf8");
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: current, GITHUB_RUN_ID: runId } = context.env;
  const runUrl = toOptional(values["run-url"]) ?? (server && current && runId ? `${server}/${current}/actions/runs/${runId}` : `https://github.com/${repository}/actions`);
  const client = createGithubClient({ token, ...(context.fetch ? { fetch: context.fetch } : {}) });
  const result = await publishReport({ client, repository, report, markdown, runUrl, close: values.close });
  if (!result.ok) {
    context.writeError(`publishing the report to ${repository} failed: ${result.error}\n`);
    return 1;
  }
  context.write(`${result.created ? "created" : "updated"} ${result.url}\n`);
  return 0;
}

export async function runCommand(argv: string[], context: CommandContext): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (command === "report") return await runReport(args, context);
    if (command === "publish") return await runPublish(args, context);
  } catch (error) {
    // parseArgs throws on an unknown or malformed option: a usage error, not a bug.
    if (error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")) {
      context.writeError(`${error.message}\n\n${USAGE}\n`);
      return 1;
    }
    throw error;
  }
  context.writeError(`${command === undefined ? "No command given." : `Unknown command "${command}".`}\n\n${USAGE}\n`);
  return 1;
}
