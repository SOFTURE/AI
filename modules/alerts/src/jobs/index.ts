// The jobs side of @softure-ai/alerts: the delivery and flush handlers for the worker, the queues and the schedule
// for `jobs({ ... })`, and `alertsFromJobs()`, which turns jobs' hooks into alerts.
import { errorLogLabel, formatMessage, ok } from "@softure-ai/core";
import {
  defineJobHandler,
  failJob,
  retryJobLater,
  type JobFailedEvent,
  type JobHandlers,
  type JobSchedulesInput,
  type JobsOptionsInput,
  type ScheduleStateChangedEvent,
} from "@softure-ai/jobs";
import type { JobsContext } from "@softure-ai/jobs/server";
import { z } from "zod";
import type { AlertSeverity } from "../contract.js";
import { ALERTS_DELIVER_QUEUE, ALERTS_FLUSH_QUEUE, isAlertsQueue } from "../queues.js";
import { alert, deliveryPayloadSchema, flushAlertRepeats, resolveAlert } from "../server/alert.js";
import { deliverToChannel } from "../server/deliver.js";
import { getAlertsMessages } from "../server/options.js";

/** Handlers for the worker: `handlers: { ...appHandlers, ...alertsJobHandlers }`. */
export const alertsJobHandlers = {
  /**
   * One message to one channel. Unknown, unconfigured or refused is final (`failJob`); a rate limit waits its
   * `Retry-After`; anything else retries with the queue's backoff. Only codes are logged, never the text or a URL.
   */
  [ALERTS_DELIVER_QUEUE]: defineJobHandler({
    payload: deliveryPayloadSchema,
    run: async ({ channel, message }, ctx) => {
      const result = await deliverToChannel(ctx.config, channel, message);
      if (result.ok) return ok();
      switch (result.error) {
        case "alerts.unknown_channel":
        case "alerts.channel_unconfigured":
        case "alerts.channel_refused":
        case "alerts.invalid_input":
          return failJob(result.error);
        case "alerts.channel_rate_limited":
        case "alerts.channel_unavailable":
          return result.retryAfterSeconds === undefined ? result : retryJobLater(result.error, Math.max(1, result.retryAfterSeconds));
      }
    },
  }),
  /** Summaries of unreported repeats, and pruning of old resolved alerts. */
  [ALERTS_FLUSH_QUEUE]: defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await flushAlertRepeats(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/**
 * The queues for `jobs({ queues: { ...alertsJobQueues } })`: deliveries retry for about a day before they fail, two
 * at a time per worker.
 */
export const alertsJobQueues = {
  [ALERTS_DELIVER_QUEUE]: { maxAttempts: 12, backoff: { baseSeconds: 30, maxSeconds: 3 * 60 * 60 }, concurrency: 2 },
  [ALERTS_FLUSH_QUEUE]: { maxAttempts: 3 },
} satisfies NonNullable<JobsOptionsInput["queues"]>;

/** The schedule for `jobs({ schedules: { ...alertsJobSchedules } })`: the flush every five minutes. */
export const alertsJobSchedules = {
  [ALERTS_FLUSH_QUEUE]: { every: "5m" },
} satisfies JobSchedulesInput;

/** What jobs' `onQueuePaused` hook (#955) passes; typed here so the adapter is ready before jobs emits it. */
export interface QueuePausedEvent {
  readonly queue: string;
  readonly code: string;
  /** When the queue resumes by itself; null for a pause an operator lifts. */
  readonly until: Date | null;
}

export interface AlertsFromJobsOptions {
  /** Severity of a failed job; default `warning`. */
  readonly jobFailedSeverity?: AlertSeverity;
  /** Severity of a failing or late schedule; default `critical`. */
  readonly scheduleSeverity?: AlertSeverity;
  /** Severity of a paused queue; default `warning`. */
  readonly queuePausedSeverity?: AlertSeverity;
  /** Queues whose events raise no alert (beyond the module's own, which never do). */
  readonly ignoreQueues?: readonly string[];
  /** The link in every jobs alert, e.g. the absolute URL of the jobs admin page. */
  readonly link?: string;
}

export interface JobsAlertHooks {
  readonly onJobFailed: (event: JobFailedEvent, ctx: JobsContext) => Promise<void>;
  readonly onScheduleStateChanged: (event: ScheduleStateChangedEvent, ctx: JobsContext) => Promise<void>;
  readonly onQueuePaused: (event: QueuePausedEvent, ctx: JobsContext) => Promise<void>;
}

/**
 * Jobs hooks that raise alerts: `jobs({ ...alertsFromJobs() })` (pass `onQueuePaused` once jobs has it). A failed
 * job fires `jobs.failed:<queue>` (one alert per queue, repeats counted); a schedule that turns failing or late fires
 * `jobs.schedule:<queue>` and resolves it once healthy; a paused queue fires `jobs.paused:<queue>`. The alerts
 * queues never alert, so a failing channel cannot loop. A failure to record the alert is logged by kind and never
 * reaches the job.
 */
export function alertsFromJobs(options: AlertsFromJobsOptions = {}): JobsAlertHooks {
  const ignored = new Set(options.ignoreQueues ?? []);
  const isIgnored = (queue: string) => isAlertsQueue(queue) || ignored.has(queue);
  const link = options.link === undefined ? {} : { link: options.link };
  return {
    onJobFailed: async (event, ctx) => {
      if (isIgnored(event.queue)) return;
      const messages = getAlertsMessages(ctx.config).jobs;
      await record("onJobFailed", () =>
        alert(ctx, {
          key: `jobs.failed:${event.queue}`,
          severity: options.jobFailedSeverity ?? "warning",
          title: formatMessage(messages.failedTitle, { queue: event.queue }),
          details: formatMessage(messages.failedDetails, { jobId: event.jobId, attempts: event.attempts, code: event.code }),
          ...link,
        }),
      );
    },
    onScheduleStateChanged: async (event, ctx) => {
      if (isIgnored(event.queue)) return;
      const key = `jobs.schedule:${event.queue}`;
      const state = event.state;
      if (state === "healthy") {
        await record("onScheduleStateChanged", async () => {
          await resolveAlert(ctx, key);
          return { ok: true };
        });
        return;
      }
      const messages = getAlertsMessages(ctx.config).jobs;
      await record("onScheduleStateChanged", () =>
        alert(ctx, {
          key,
          severity: options.scheduleSeverity ?? "critical",
          title: formatMessage(messages.scheduleTitle[state], { queue: event.queue }),
          ...(event.lastFailureCode === null ? {} : { details: formatMessage(messages.scheduleDetails, { code: event.lastFailureCode }) }),
          ...link,
        }),
      );
    },
    onQueuePaused: async (event, ctx) => {
      if (isIgnored(event.queue)) return;
      const messages = getAlertsMessages(ctx.config).jobs;
      const details =
        event.until === null
          ? formatMessage(messages.pausedDetailsOpenEnded, { code: event.code })
          : formatMessage(messages.pausedDetails, { code: event.code, until: event.until.toISOString() });
      await record("onQueuePaused", () =>
        alert(ctx, {
          key: `jobs.paused:${event.queue}`,
          severity: options.queuePausedSeverity ?? "warning",
          title: formatMessage(messages.pausedTitle, { queue: event.queue }),
          details,
          ...link,
        }),
      );
    },
  };
}

async function record(hook: string, call: () => Promise<{ readonly ok: boolean; readonly error?: unknown }>): Promise<void> {
  try {
    const result = await call();
    if (!result.ok) console.error(`@softure-ai/alerts: the ${hook} alert was refused: ${String(result.error)}`);
  } catch (error) {
    console.error(`@softure-ai/alerts: the ${hook} alert could not be recorded: ${errorLogLabel(error)}`);
  }
}

export { ALERTS_DELIVER_QUEUE, ALERTS_FLUSH_QUEUE, isAlertsQueue } from "../queues.js";
