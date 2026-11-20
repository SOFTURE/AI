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
  /** Past this time no further runs are read and the repository is marked partial; no budget when unset. */
  deadline?: Date;
  /** Replaces the clock in tests. */
  now?: () => Date;
}

/** Runs whose jobs are read at the same time: far below GitHub's limit of 100 concurrent requests. */
export const JOB_CONCURRENCY = 8;

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

  // Oldest first, so a stop leaves a clean "counted up to" boundary: every run before it is counted, none after.
  const runs = [...listed.value].sort((a, b) => a.id - b.id);
  const now = options.now ?? ((): Date => new Date());
  const read = new Map<number, JobRecord[]>();
  const pending: { index: number; run: Run; key: string }[] = [];
  let stop: { index: number; note: string } | null = null;
  for (const [index, run] of runs.entries()) {
    if (run.status !== "completed" || run.conclusion === "skipped") continue;
    const key = `${String(run.id)}:${String(run.run_attempt ?? 1)}`;
    if (options.cache.runs[key]?.updatedAt !== run.updated_at) pending.push({ index, run, key });
  }
  for (let start = 0; start < pending.length && stop === null; start += JOB_CONCURRENCY) {
    const batch = pending.slice(start, start + JOB_CONCURRENCY);
    const first = batch[0];
    if (first !== undefined && options.deadline !== undefined && now() >= options.deadline) {
      stop = { index: first.index, note: `stopped at the time budget: ${String(runs.length - first.index)} of ${String(runs.length)} runs not counted` };
      break;
    }
    const results = await Promise.all(batch.map((item) => listJobs(client, repository, item.run)));
    for (const [offset, result] of results.entries()) {
      const item = batch[offset];
      if (item === undefined) continue;
      if (result.ok) {
        read.set(item.index, result.value);
        continue;
      }
      if (result.kind === "budget") {
        stop = { index: item.index, note: `stopped at the rate limit: ${String(runs.length - item.index)} of ${String(runs.length)} runs not counted (${result.message})` };
        break;
      }
      partial.push(`run ${String(item.run.id)} not counted: ${result.message}`);
    }
  }

  for (const [index, run] of runs.entries()) {
    if (stop !== null && index >= stop.index) break;
    if (run.status !== "completed") {
      counts.running += 1;
      continue;
    }
    if (run.conclusion === "skipped") {
      counts.skipped += 1;
      continue;
    }
    const key = `${String(run.id)}:${String(run.run_attempt ?? 1)}`;
    const fresh = read.get(index);
    if (fresh !== undefined) {
      jobs.push(...fresh);
      cache.runs[key] = { updatedAt: run.updated_at, jobs: fresh };
      counts.counted += 1;
      continue;
    }
    const cached = options.cache.runs[key];
    if (cached?.updatedAt === run.updated_at) {
      jobs.push(...cached.jobs);
      cache.runs[key] = cached;
      counts.counted += 1;
      counts.fromCache += 1;
    }
    // Otherwise the read failed with an HTTP error, already noted in `partial`.
  }
  if (stop !== null) partial.push(stop.note);
  return done();
}
