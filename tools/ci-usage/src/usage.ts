// Billable minutes per job and their sums per repository, workflow and job name.
import { getMinutePrice, type PriceOptions } from "./prices.js";
import { classifyRunner, type Provider, type RunnerClass } from "./runner.js";

/** One job attempt as the collector hands it over, already narrowed from the API. */
export interface JobRecord {
  id: number;
  runId: number;
  runAttempt: number;
  name: string;
  workflowName: string;
  workflowPath: string;
  startedAt: string | null;
  completedAt: string | null;
  /** The run's last update; the end of a job that started but never recorded its completion. */
  runUpdatedAt: string;
  labels: string[];
  runnerGroupName: string | null;
  htmlUrl: string;
}

const MINUTE_MS = 60_000;

/**
 * Billable minutes of one job: its run time rounded up to a whole minute, as GitHub and Ubicloud bill. A job that
 * never started costs nothing; one that started without a recorded end is billed up to the run's last update.
 */
export function getJobMinutes(job: JobRecord): number {
  if (job.startedAt === null) return 0;
  const start = Date.parse(job.startedAt);
  const end = Date.parse(job.completedAt ?? job.runUpdatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.ceil((end - start) / MINUTE_MS);
}

export interface Cost {
  minutes: number;
  /** Estimated USD; null when some minutes ran on a runner without a known price. */
  usd: number | null;
  /** Minutes on runners without a known price, included in `minutes`. */
  unpricedMinutes: number;
}

export interface JobUsage extends Cost {
  name: string;
  runner: string;
  provider: Provider;
  count: number;
  p50Minutes: number;
  p95Minutes: number;
}

export interface WorkflowUsage extends Cost {
  name: string;
  path: string;
  runs: number;
  jobs: number;
  /** Share of the repository's minutes, 0..1. */
  share: number;
  byJob: JobUsage[];
}

export interface LongJob {
  workflow: string;
  job: string;
  runner: string;
  minutes: number;
  url: string;
}

export interface RepositoryUsage extends Cost {
  repository: string;
  runs: number;
  jobs: number;
  byProvider: Record<Provider, Cost>;
  byWorkflow: WorkflowUsage[];
  longestJobs: LongJob[];
}

const LONGEST_JOBS = 10;

function emptyCost(): Cost {
  return { minutes: 0, usd: 0, unpricedMinutes: 0 };
}

function addCost(total: Cost, minutes: number, price: number | null): void {
  total.minutes += minutes;
  if (price === null) {
    total.unpricedMinutes += minutes;
    if (minutes > 0) total.usd = null;
  } else if (total.usd !== null) {
    total.usd += minutes * price;
  }
}

function roundUsd(cost: Cost): void {
  if (cost.usd !== null) cost.usd = Math.round(cost.usd * 10_000) / 10_000;
}

/** Nearest-rank percentile of sorted minutes; 0 for an empty list. */
export function getPercentile(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((percentile / 100) * sorted.length));
  return sorted[rank - 1] ?? 0;
}

interface JobBucket {
  cost: Cost;
  runner: RunnerClass;
  durations: number[];
}

interface WorkflowBucket {
  cost: Cost;
  name: string;
  runIds: Set<number>;
  jobs: number;
  byJob: Map<string, JobBucket>;
}

/** Sums the jobs of one repository; workflows and their jobs are sorted by minutes, most first. */
/** Names of GitHub's built-in dynamic workflows, which carry no stable name of their own. */
const DYNAMIC_WORKFLOW_NAMES: Record<string, string> = {
  "dynamic/github-code-scanning/codeql": "CodeQL (default setup)",
  "dynamic/dependabot/dependabot-updates": "Dependabot updates",
  "dynamic/copilot-pull-request-reviewer/copilot-pull-request-reviewer": "Copilot code review",
  "dynamic/copilot-swe-agent/copilot": "Copilot coding agent",
  "dynamic/pages/pages-build-deployment": "Pages build and deployment",
};

/**
 * The name a workflow is reported under. A `dynamic/...` workflow (CodeQL default setup, Dependabot and the like)
 * takes its run's title as its name, which changes from run to run, so it is named after its path instead.
 */
export function getWorkflowName(job: Pick<JobRecord, "workflowName" | "workflowPath">): string {
  if (!job.workflowPath.startsWith("dynamic/")) return job.workflowName;
  return DYNAMIC_WORKFLOW_NAMES[job.workflowPath] ?? job.workflowPath;
}

export function summarizeUsage(repository: string, jobs: readonly JobRecord[], options: PriceOptions): RepositoryUsage {
  const total = emptyCost();
  const byProvider: Record<Provider, Cost> = { "github-hosted": emptyCost(), ubicloud: emptyCost(), "self-hosted": emptyCost() };
  const workflows = new Map<string, WorkflowBucket>();
  const runIds = new Set<number>();
  const longest: LongJob[] = [];

  for (const job of jobs) {
    const minutes = getJobMinutes(job);
    const runner = classifyRunner({ labels: job.labels, runnerGroupName: job.runnerGroupName });
    const price = getMinutePrice(runner, options);
    runIds.add(job.runId);
    addCost(total, minutes, price);
    addCost(byProvider[runner.provider], minutes, price);

    const workflow: WorkflowBucket = workflows.get(job.workflowPath) ?? { cost: emptyCost(), name: getWorkflowName(job), runIds: new Set<number>(), jobs: 0, byJob: new Map<string, JobBucket>() };
    workflows.set(job.workflowPath, workflow);
    workflow.runIds.add(job.runId);
    workflow.jobs += 1;
    addCost(workflow.cost, minutes, price);

    const key = `${job.name}\u0000${runner.label}`;
    const bucket: JobBucket = workflow.byJob.get(key) ?? { cost: emptyCost(), runner, durations: [] };
    workflow.byJob.set(key, bucket);
    bucket.durations.push(minutes);
    addCost(bucket.cost, minutes, price);

    if (minutes > 0) longest.push({ workflow: getWorkflowName(job), job: job.name, runner: runner.label, minutes, url: job.htmlUrl });
  }

  const byWorkflow: WorkflowUsage[] = [...workflows.entries()].map(([path, bucket]) => {
    roundUsd(bucket.cost);
    const byJob: JobUsage[] = [...bucket.byJob.entries()].map(([key, jobBucket]) => {
      roundUsd(jobBucket.cost);
      const sorted = [...jobBucket.durations].sort((a, b) => a - b);
      return {
        name: key.split("\u0000")[0] ?? key,
        runner: jobBucket.runner.label,
        provider: jobBucket.runner.provider,
        count: sorted.length,
        p50Minutes: getPercentile(sorted, 50),
        p95Minutes: getPercentile(sorted, 95),
        ...jobBucket.cost,
      };
    });
    byJob.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
    return {
      name: bucket.name,
      path,
      runs: bucket.runIds.size,
      jobs: bucket.jobs,
      share: total.minutes === 0 ? 0 : Math.round((bucket.cost.minutes / total.minutes) * 1000) / 1000,
      byJob,
      ...bucket.cost,
    };
  });
  byWorkflow.sort((a, b) => b.minutes - a.minutes || a.path.localeCompare(b.path));
  roundUsd(total);
  for (const cost of Object.values(byProvider)) roundUsd(cost);
  longest.sort((a, b) => b.minutes - a.minutes || a.url.localeCompare(b.url));

  return {
    repository,
    runs: runIds.size,
    jobs: jobs.length,
    ...total,
    byProvider,
    byWorkflow,
    longestJobs: longest.slice(0, LONGEST_JOBS),
  };
}
