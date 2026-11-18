// The jobs of every finished workflow run created in a period, read through the Actions API one day at a time.
import { z } from "zod";
import type { GithubClient } from "./github.js";
import type { JobRecord } from "./usage.js";

const RUN = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  path: z.string(),
  // A run in progress has no conclusion key at all in some answers.
  status: z.string().nullable().optional(),
  conclusion: z.string().nullable().optional(),
  run_attempt: z.number().optional(),
  updated_at: z.string(),
});

const RUNS_PAGE = z.object({ total_count: z.number(), workflow_runs: z.array(RUN) });

const JOB = z.object({
  id: z.number(),
  run_id: z.number(),
  run_attempt: z.number().optional(),
  name: z.string(),
  workflow_name: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  labels: z.array(z.string()),
  runner_group_name: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
});

const JOBS_PAGE = z.object({ total_count: z.number(), jobs: z.array(JOB) });

type Run = z.infer<typeof RUN>;

/** Finished runs read earlier, keyed by `<run id>:<attempt>`, so a repeated report reads only new runs. */
export interface RunCache {
  version: 1;
  runs: Record<string, { updatedAt: string; jobs: JobRecord[] }>;
}

const CACHE = z.object({ version: z.literal(1), runs: z.record(z.string(), z.object({ updatedAt: z.string(), jobs: z.array(z.unknown()) })) });

/** Reads a cache file's text; anything unreadable starts an empty cache (it is only an optimisation). */
export function parseRunCache(text: string | null): RunCache {
  if (text === null) return { version: 1, runs: {} };
  try {
    const parsed = CACHE.safeParse(JSON.parse(text));
    return parsed.success ? (parsed.data as RunCache) : { version: 1, runs: {} };
  } catch {
    return { version: 1, runs: {} };
  }
}

/** GitHub returns at most 1,000 runs for a filtered query. */
export const MAX_RUNS_PER_QUERY = 1000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface CollectOptions {
  client: GithubClient;
  /** `owner/name`. */
  repository: string;
  from: Date;
  to: Date;
  cache: RunCache;
}

export interface CollectResult {
  repository: string;
  jobs: JobRecord[];
  /** Why the numbers may be short; empty when the period is complete. Runs still running are counted apart. */
  partial: string[];
  runs: { counted: number; fromCache: number; running: number; skipped: number };
  /** The cache to write back: the runs this collection saw, nothing older. */
  cache: RunCache;
  /** A failure that left the repository unread (no access, unknown repository). */
  error: string | null;
}

/** UTC day slices of [from, to); the first and the last may be shorter. */
export function getSlices(from: Date, to: Date, stepMs: number = DAY_MS): { from: Date; to: Date }[] {
  const slices: { from: Date; to: Date }[] = [];
  let start = from.getTime();
  while (start < to.getTime()) {
    const end = Math.min(to.getTime(), (Math.floor(start / stepMs) + 1) * stepMs);
    slices.push({ from: new Date(start), to: new Date(end) });
    start = end;
  }
  return slices;
}

/** GitHub's `created` range; the end is exclusive here, so one millisecond less, at second precision. */
function getCreatedRange(slice: { from: Date; to: Date }): string {
  const last = new Date(slice.to.getTime() - 1000);
  const format = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `${format(slice.from)}..${format(last)}`;
}

function toJobRecord(job: z.infer<typeof JOB>, run: Run): JobRecord {
  return {
    id: job.id,
    runId: job.run_id,
    runAttempt: job.run_attempt ?? 1,
    name: job.name,
    workflowName: job.workflow_name ?? run.name ?? run.path,
    workflowPath: run.path,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    runUpdatedAt: run.updated_at,
    labels: job.labels,
    runnerGroupName: job.runner_group_name ?? null,
    htmlUrl: job.html_url ?? "",
  };
}

type Step<T> = { ok: true; value: T } | { ok: false; kind: "budget" | "http"; message: string };

async function listRuns(client: GithubClient, repository: string, slice: { from: Date; to: Date }): Promise<Step<{ total: number; runs: Run[] }>> {
  const runs: Run[] = [];
  let total = 0;
  let next: string | null = `/repos/${repository}/actions/runs`;
  let query: Record<string, string> | undefined = { created: getCreatedRange(slice), per_page: "100", exclude_pull_requests: "true" };
  while (next !== null) {
    const result = await client.get(next, query);
    if (!result.ok) return result;
    const page = RUNS_PAGE.safeParse(result.data);
    if (!page.success) return { ok: false, kind: "http", message: `GET /repos/${repository}/actions/runs answered an unexpected shape` };
    total = page.data.total_count;
    runs.push(...page.data.workflow_runs);
    next = result.next;
    query = undefined;
  }
  return { ok: true, value: { total, runs } };
}

async function listJobs(client: GithubClient, repository: string, run: Run): Promise<Step<JobRecord[]>> {
  const jobs: JobRecord[] = [];
  let next: string | null = `/repos/${repository}/actions/runs/${String(run.id)}/jobs`;
  let query: Record<string, string> | undefined = { filter: "all", per_page: "100" };
  while (next !== null) {
    const result = await client.get(next, query);
    if (!result.ok) return result;
    const page = JOBS_PAGE.safeParse(result.data);
    if (!page.success) return { ok: false, kind: "http", message: `GET /repos/${repository}/actions/runs/${String(run.id)}/jobs answered an unexpected shape` };
    jobs.push(...page.data.jobs.map((job) => toJobRecord(job, run)));
    next = result.next;
    query = undefined;
  }
  return { ok: true, value: jobs };
}

function formatTime(date: Date): string {
  return date.toISOString().replace(/:\d{2}\.\d{3}Z$/, "Z");
}

/** Reads the runs of each slice, splitting a day into hours when it holds more runs than one query returns. */
async function listAllRuns(options: CollectOptions, partial: string[]): Promise<Step<Run[]>> {
  const runs: Run[] = [];
  for (const day of getSlices(options.from, options.to)) {
    const first = await listRuns(options.client, options.repository, day);
    if (!first.ok) return first;
    if (first.value.total <= MAX_RUNS_PER_QUERY) {
      runs.push(...first.value.runs);
      continue;
    }
    for (const hour of getSlices(day.from, day.to, HOUR_MS)) {
      const listed = await listRuns(options.client, options.repository, hour);
      if (!listed.ok) return listed;
      if (listed.value.total > MAX_RUNS_PER_QUERY) {
        partial.push(`${String(listed.value.total)} runs created between ${formatTime(hour.from)} and ${formatTime(hour.to)}: only ${String(MAX_RUNS_PER_QUERY)} counted`);
      }
      runs.push(...listed.value.runs);
    }
  }
  return { ok: true, value: runs };
}

export async function collectRepository(options: CollectOptions): Promise<CollectResult> {
  const { client, repository } = options;
  const partial: string[] = [];
  const cache: RunCache = { version: 1, runs: {} };
  const jobs: JobRecord[] = [];
  const counts = { counted: 0, fromCache: 0, running: 0, skipped: 0 };
  const done = (error: string | null = null): CollectResult => ({ repository, jobs, partial, runs: counts, cache, error });

  const listed = await listAllRuns(options, partial);
  if (!listed.ok) {
    if (listed.kind === "budget") {
      partial.push(`the run list stopped early: ${listed.message}`);
      return done();
    }
    return done(listed.message);
  }

  // Oldest first, so a budget stop leaves a clean "counted up to" boundary.
  const runs = [...listed.value].sort((a, b) => a.id - b.id);
  for (const [index, run] of runs.entries()) {
    if (run.status !== "completed") {
      counts.running += 1;
      continue;
    }
    if (run.conclusion === "skipped") {
      counts.skipped += 1;
      continue;
    }
    const key = `${String(run.id)}:${String(run.run_attempt ?? 1)}`;
    const cached = options.cache.runs[key];
    if (cached?.updatedAt === run.updated_at) {
      jobs.push(...cached.jobs);
      cache.runs[key] = cached;
      counts.counted += 1;
      counts.fromCache += 1;
      continue;
    }
    const read = await listJobs(client, repository, run);
    if (!read.ok) {
      if (read.kind === "budget") {
        partial.push(`stopped at the rate limit: ${String(runs.length - index)} of ${String(runs.length)} runs not counted (${read.message})`);
        return done();
      }
      partial.push(`run ${String(run.id)} not counted: ${read.message}`);
      continue;
    }
    jobs.push(...read.value);
    cache.runs[key] = { updatedAt: run.updated_at, jobs: read.value };
    counts.counted += 1;
  }
  return done();
}
