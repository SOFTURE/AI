// The report: one JSON document (schemaVersion 1) for agents and the same numbers as Markdown for people.
import type { BilledSku } from "./billing.js";
import type { CollectResult } from "./collect.js";
import { ciUsageMessages, formatMessage, type CiUsageMessages } from "./messages/index.js";
import type { PriceOptions } from "./prices.js";
import type { Provider } from "./runner.js";
import { summarizeUsage, type Cost, type RepositoryUsage } from "./usage.js";

export const SCHEMA_VERSION = 1;
export const REPORT_MARKER = "<!-- softure-ci-usage -->";
export const JSON_FILE = "ci-usage.json";
export const MARKDOWN_FILE = "ci-usage.md";
const TOP_JOBS = 15;

export interface RepositoryReport extends RepositoryUsage {
  partial: string[];
  error: string | null;
  runsRunning: number;
  runsFromCache: number;
  /** What GitHub billed, when the billing lookup ran and succeeded; null otherwise. */
  billing: BilledSku[] | null;
}

export interface CiUsageReport {
  schemaVersion: typeof SCHEMA_VERSION;
  generatedAt: string;
  period: { from: string; to: string; days: number };
  partial: boolean;
  totals: Cost & { runs: number; jobs: number; byProvider: Record<Provider, Cost> };
  prices: { source: string; checkedOn: string; ubicloudPremium: boolean; labels: Record<string, number> };
  /** Report-wide notes, such as a refused billing lookup. */
  notes: string[];
  repositories: RepositoryReport[];
}

export interface BuildReportOptions {
  collected: readonly CollectResult[];
  from: Date;
  to: Date;
  generatedAt: Date;
  priceOptions: PriceOptions;
  billing?: { byRepository: Record<string, BilledSku[]> } | { error: string } | null;
}

function emptyCost(): Cost {
  return { minutes: 0, usd: 0, unpricedMinutes: 0 };
}

function addTo(total: Cost, cost: Cost): void {
  total.minutes += cost.minutes;
  total.unpricedMinutes += cost.unpricedMinutes;
  if (cost.usd === null) {
    if (cost.minutes > 0) total.usd = null;
  } else if (total.usd !== null) {
    total.usd = Math.round((total.usd + cost.usd) * 10_000) / 10_000;
  }
}

export function buildReport(options: BuildReportOptions): CiUsageReport {
  const billing = options.billing ?? null;
  const byRepository = billing !== null && "byRepository" in billing ? billing.byRepository : null;
  const repositories: RepositoryReport[] = options.collected.map((result) => ({
    ...summarizeUsage(result.repository, result.jobs, options.priceOptions),
    partial: result.partial,
    error: result.error,
    runsRunning: result.runs.running,
    runsFromCache: result.runs.fromCache,
    billing: byRepository?.[result.repository] ?? null,
  }));
  const byProvider: Record<Provider, Cost> = { "github-hosted": emptyCost(), ubicloud: emptyCost(), "self-hosted": emptyCost() };
  const totals = { ...emptyCost(), runs: 0, jobs: 0, byProvider };
  for (const repository of repositories) {
    addTo(totals, repository);
    totals.runs += repository.runs;
    totals.jobs += repository.jobs;
    for (const provider of Object.keys(byProvider) as Provider[]) addTo(byProvider[provider], repository.byProvider[provider]);
  }
  const notes = billing !== null && "error" in billing ? [billing.error] : [];
  const days = Math.round(((options.to.getTime() - options.from.getTime()) / 86_400_000) * 100) / 100;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt.toISOString(),
    period: { from: options.from.toISOString(), to: options.to.toISOString(), days },
    partial: notes.length > 0 || repositories.some((repository) => repository.partial.length > 0 || repository.error !== null),
    totals,
    prices: {
      source: options.priceOptions.prices.source,
      checkedOn: options.priceOptions.prices.checkedOn,
      ubicloudPremium: options.priceOptions.ubicloudPremium,
      labels: options.priceOptions.prices.labels,
    },
    notes,
    repositories,
  };
}

function formatTime(iso: string): string {
  return iso.replace(/:\d{2}\.\d{3}Z$/, "").replace("T", " ");
}

function formatUsd(usd: number | null, messages: CiUsageMessages): string {
  return usd === null ? messages.unknown : usd.toFixed(2);
}

function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** A Markdown table cell: backslashes, pipes and line breaks would break the row. */
function cell(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function table(header: string[], rows: string[][]): string[] {
  return [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`), ""];
}

function renderRepository(repository: RepositoryReport, messages: CiUsageMessages): string[] {
  const lines = [`## ${repository.repository}`, ""];
  if (repository.error !== null) return [...lines, formatMessage(messages.error, { error: repository.error }), ""];
  if (repository.runs === 0) lines.push(messages.noRuns, "");
  if (repository.byWorkflow.length > 0) {
    lines.push(`### ${messages.workflowsHeading}`, "");
    lines.push(
      ...table(
        [messages.workflow, messages.runs, messages.jobs, messages.minutes, messages.share, messages.usd],
        repository.byWorkflow.map((workflow) => [
          `${workflow.name} (\`${workflow.path}\`)`,
          String(workflow.runs),
          String(workflow.jobs),
          String(workflow.minutes),
          formatShare(workflow.share),
          formatUsd(workflow.usd, messages),
        ]),
      ),
    );
    const jobs = repository.byWorkflow
      .flatMap((workflow) => workflow.byJob.map((job) => ({ workflow: workflow.name, ...job })))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, TOP_JOBS)
      .filter((job) => job.minutes > 0);
    if (jobs.length > 0) {
      lines.push(`### ${messages.topJobsHeading}`, "");
      lines.push(
        ...table(
          [messages.workflow, messages.job, messages.runner, messages.count, messages.minutes, messages.p50, messages.p95, messages.usd],
          jobs.map((job) => [job.workflow, job.name, `\`${job.runner}\``, String(job.count), String(job.minutes), String(job.p50Minutes), String(job.p95Minutes), formatUsd(job.usd, messages)]),
        ),
      );
    }
  }
  if (repository.longestJobs.length > 0) {
    lines.push(`### ${messages.longestHeading}`, "");
    for (const job of repository.longestJobs) {
      lines.push(`- ${formatMessage(messages.longestItem, { minutes: job.minutes, url: job.url, workflow: job.workflow, job: job.job, runner: job.runner })}`);
    }
    lines.push("");
  }
  if (repository.billing !== null && repository.billing.length > 0) {
    lines.push(`### ${messages.billingHeading}`, "");
    lines.push(...table([messages.sku, messages.minutes, messages.gross, messages.net], repository.billing.map((sku) => [sku.sku, String(sku.minutes), sku.grossUsd.toFixed(2), sku.netUsd.toFixed(2)])));
  }
  const notes = [...repository.partial];
  if (repository.runsRunning > 0) notes.push(formatMessage(messages.running, { count: repository.runsRunning }));
  if (repository.runsFromCache > 0) notes.push(formatMessage(messages.fromCache, { count: repository.runsFromCache, total: repository.runs }));
  if (repository.unpricedMinutes > 0) notes.push(formatMessage(messages.unknownPrice, { minutes: repository.unpricedMinutes }));
  if (notes.length > 0) lines.push(`### ${messages.notesHeading}`, "", ...notes.map((note) => `- ${note}`), "");
  return lines;
}

export function renderMarkdown(report: CiUsageReport, messages: CiUsageMessages = ciUsageMessages.en): string {
  const lines = [
    REPORT_MARKER,
    `# ${messages.title}`,
    "",
    formatMessage(messages.period, { from: formatTime(report.period.from), to: formatTime(report.period.to), days: report.period.days, generated: formatTime(report.generatedAt) }),
    report.partial ? messages.partial : messages.complete,
    "",
    messages.howToRead,
    "",
    `## ${messages.totalsHeading}`,
    "",
    ...table(
      [messages.repository, messages.minutes, messages.usd, messages.githubHosted, messages.ubicloud, messages.selfHosted, messages.runs],
      [
        ...report.repositories.map((repository) => [
          repository.repository,
          repository.error === null ? String(repository.minutes) : "—",
          repository.error === null ? formatUsd(repository.usd, messages) : "—",
          String(repository.byProvider["github-hosted"].minutes),
          String(repository.byProvider.ubicloud.minutes),
          String(repository.byProvider["self-hosted"].minutes),
          String(repository.runs),
        ]),
        ...(report.repositories.length > 1
          ? [
              [
                `**${messages.totalsHeading}**`,
                String(report.totals.minutes),
                formatUsd(report.totals.usd, messages),
                String(report.totals.byProvider["github-hosted"].minutes),
                String(report.totals.byProvider.ubicloud.minutes),
                String(report.totals.byProvider["self-hosted"].minutes),
                String(report.totals.runs),
              ],
            ]
          : []),
      ],
    ),
  ];
  if (report.notes.length > 0) lines.push(...report.notes.map((note) => `- ${note}`), "");
  for (const repository of report.repositories) lines.push(...renderRepository(repository, messages));
  lines.push(formatMessage(messages.prices, { source: report.prices.source, checkedOn: report.prices.checkedOn, premium: report.prices.ubicloudPremium ? messages.premium : "" }), "");
  return lines.join("\n");
}
