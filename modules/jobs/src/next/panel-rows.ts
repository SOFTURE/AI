// The panel's data from the module's reads: the page uses it, and an app that builds the page inside its own shell
// (`getQueueStats` + `listRecentJobs` + `listJobRuns` + `listSyncItems` + `JobsPanel` + the actions) uses the same
// mapping. Rows are
// built field by field: a job's payload never reaches the browser, and failures appear as codes only.
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import { getScheduleHealth } from "../server/hooks.js";
import type { Job, JobRun } from "../contract.js";
import type { JobsMessages } from "../messages/index.js";
import type { QueueStats } from "../server/maintenance.js";
import { getJobsOptions } from "../server/options.js";
import type { SyncItem } from "../sync.js";
import type { JobsPanelJob, JobsPanelQueue, JobsPanelRun, JobsPanelSyncSource } from "../ui/jobs-panel.js";

/** What the page read: the queue overview, the recent problem jobs, the newest runs and the latest sync ledger items. */
export interface JobsPanelSource {
  readonly stats: readonly QueueStats[];
  readonly jobs: readonly Job[];
  /** The run history (`listJobRuns`); without it the panel leaves its section out. */
  readonly runs?: readonly JobRun[];
  readonly syncItems: readonly SyncItem[];
}

export interface JobsPanelData {
  readonly queues: JobsPanelQueue[];
  readonly jobs: JobsPanelJob[];
  readonly runs?: JobsPanelRun[];
  readonly syncSources: JobsPanelSyncSource[];
}

/** Every line already in the app's copy, dates in its locale and time zone. */
export function toJobsPanelData(source: JobsPanelSource, messages: JobsMessages, config: SoftureConfig): JobsPanelData {
  const format = new Intl.DateTimeFormat(config.locale, { dateStyle: "medium", timeStyle: "short", timeZone: config.timezone });
  const date = (value: Date) => format.format(value);
  return {
    queues: source.stats.map((stats) => toQueue(stats, messages, config, date)),
    jobs: source.jobs.map((job) => toJob(job, messages, date)),
    ...(source.runs === undefined ? {} : { runs: source.runs.map((run) => toRun(run, messages, date)) }),
    syncSources: toSyncSources(source.syncItems, messages, date),
  };
}

function toQueue(stats: QueueStats, messages: JobsMessages, config: SoftureConfig, date: (value: Date) => string): JobsPanelQueue {
  const details = [
    formatMessage(messages.queues.counts, { ...stats.counts }),
    stats.oldestDueAt === null ? messages.queues.noneDue : formatMessage(messages.queues.oldestDue, { due: stats.due, date: date(stats.oldestDueAt) }),
  ];
  const schedule = Object.hasOwn(getJobsOptions(config).schedules, stats.queue) ? getJobsOptions(config).schedules[stats.queue] : undefined;
  if (schedule === undefined || stats.schedule === null) return { queue: stats.queue, details, health: null, healthLabel: null, isScheduled: false };
  const state = stats.schedule;
  details.push("every" in schedule ? formatMessage(messages.queues.every, { every: schedule.every }) : formatMessage(messages.queues.at, { times: schedule.at.join(", "), timeZone: schedule.timeZone }));
  if (state.lastEnqueuedAt === null) details.push(messages.queues.neverEnqueued);
  details.push(state.lastSucceededAt === null ? messages.queues.neverSucceeded : formatMessage(messages.queues.lastSucceeded, { date: date(state.lastSucceededAt) }));
  if (state.lastFailedAt !== null) details.push(formatMessage(messages.queues.lastFailed, { date: date(state.lastFailedAt), code: state.lastFailureCode ?? "" }));
  const health = getScheduleHealth(state);
  return { queue: stats.queue, details, health, healthLabel: messages.queues.health[health], isScheduled: true };
}

function toJob(job: Job, messages: JobsMessages, date: (value: Date) => string): JobsPanelJob {
  const details = [formatMessage(messages.jobs.attempts, { attempts: job.attempts, maxAttempts: job.maxAttempts })];
  if (job.lastError !== null) details.push(formatMessage(messages.jobs.code, { code: job.lastError }));
  details.push(job.status === "pending" ? formatMessage(messages.jobs.nextAttempt, { date: date(job.runAt) }) : formatMessage(messages.jobs.updated, { date: date(job.updatedAt) }));
  return {
    id: job.id,
    queue: job.queue,
    heading: formatMessage(messages.jobs.heading, { queue: job.queue, id: job.id }),
    status: job.status,
    statusLabel: messages.jobs.status[job.status],
    details,
    canRetry: job.status === "failed" || job.status === "cancelled",
    canCancel: job.status === "pending",
  };
}

function toRun(run: JobRun, messages: JobsMessages, date: (value: Date) => string): JobsPanelRun {
  const origins = messages.runs.origins as Readonly<Record<string, string>>;
  const details = [
    formatMessage(messages.runs.origin, { origin: (Object.hasOwn(origins, run.origin) ? origins[run.origin] : undefined) ?? run.origin }),
    formatMessage(messages.runs.attempt, { attempt: run.attempt }),
  ];
  const { summary } = run;
  if (summary?.code !== undefined) details.push(formatMessage(messages.runs.result, { code: summary.code }));
  if (summary?.items !== undefined) {
    details.push(formatMessage(messages.runs.items, { new: summary.items.new ?? 0, skipped: summary.items.skipped ?? 0, failed: summary.items.failed ?? 0 }));
  }
  if (summary?.steps !== undefined && Object.keys(summary.steps).length > 0) {
    const steps = Object.entries(summary.steps).map(([step, outcome]) => formatMessage(messages.runs.step, { step, outcome: messages.runs.stepStatus[outcome] }));
    details.push(formatMessage(messages.runs.steps, { steps: steps.join(", ") }));
  }
  if (run.errorCode !== null) details.push(formatMessage(messages.runs.code, { code: run.errorCode }));
  details.push(formatMessage(messages.runs.finished, { date: date(run.finishedAt) }));
  return {
    id: run.id,
    heading: formatMessage(messages.runs.heading, { queue: run.queue, jobId: run.jobId }),
    outcome: run.outcome,
    outcomeLabel: messages.runs.outcome[run.outcome],
    details,
  };
}

function toSyncSources(items: readonly SyncItem[], messages: JobsMessages, date: (value: Date) => string): JobsPanelSyncSource[] {
  const sources = new Map<string, JobsPanelSyncSource["items"][number][]>();
  for (const item of items) {
    const details = [formatMessage(messages.sync.attempts, { attempts: item.attempts })];
    if (item.errorCode !== null) details.push(formatMessage(messages.sync.code, { code: item.errorCode }));
    details.push(formatMessage(messages.sync.lastSeen, { date: date(item.lastSeenAt) }));
    const rows = sources.get(item.source) ?? [];
    rows.push({
      source: item.source,
      itemId: item.itemId,
      label: formatMessage(messages.sync.item, { itemId: item.itemId }),
      status: item.status,
      statusLabel: messages.sync.status[item.status],
      details,
      canRetry: item.status === "failed",
    });
    sources.set(item.source, rows);
  }
  return [...sources].map(([source, rows]) => ({ source, heading: formatMessage(messages.sync.heading, { source }), items: rows }));
}
