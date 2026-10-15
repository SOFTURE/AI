// The jobs adapter of @softure-ai/billing: the access reminder mail and the expiry of stale invoice requests as
// `@softure-ai/jobs` handlers and schedules (an optional peer dependency; only apps that import this entry need it).
// The reminder handler loads the mailing adapter on its first run, so this entry also loads in an app without
// `@softure-ai/mailing` that schedules only the expiry.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import type { AccessReminderSummary, SendAccessRemindersOptions } from "../mailing/index.js";
import { expireStaleRequests } from "../server/requests.js";

export interface BillingJobHandlersOptions {
  /**
   * `sendAccessReminders`' options for every scheduled run: the app's `buildMail`, `getScope`, `limit`,
   * `catchUpDays`, `pauseMs` and the rest. `dryRun` is left out: a dry run job would never send.
   */
  readonly reminders?: Omit<SendAccessRemindersOptions, "dryRun">;
}

/**
 * What a reminder run's summary means for its job: an outage is retried with the queue's backoff (the ledger keeps
 * the mails already sent from going out twice), a refused account or a spent quota fails the job at once (a retry
 * minutes later rarely helps; the next period resumes), anything else succeeds.
 */
function getReminderRunResult(summary: AccessReminderSummary) {
  const reason = summary.halted?.reason;
  if (reason === "mailing.provider_refused" || reason === "mailing.quota_exceeded") return failJob(reason);
  if (reason === "mailing.unavailable" || summary.retryLater > 0) return err("mailing.unavailable");
  return ok(summary);
}

/** Handlers for the worker with the app's reminder options: `handlers: { ...createBillingJobHandlers({ reminders }) }`. */
export function createBillingJobHandlers(options: BillingJobHandlersOptions = {}) {
  return {
    /** Mails every account due an access reminder (`sendAccessReminders`); needs `mailing({ ... })` in the config. */
    "billing.access-reminders": defineJobHandler({
      payload: z.object({}),
      run: async (_payload, ctx) => {
        const { sendAccessReminders } = await import("../mailing/index.js");
        return getReminderRunResult(await sendAccessReminders(ctx, options.reminders));
      },
    }),
    /** Closes open invoice requests older than `requests.expireAfterDays` (`expireStaleRequests`). */
    "billing.expire-requests": defineJobHandler({
      payload: z.object({}),
      run: async (_payload, ctx) => ok(await expireStaleRequests(ctx)),
    }),
  } satisfies JobHandlers;
}

/** Handlers for the worker with the package's own reminder mail: `handlers: { ...billingJobHandlers }`. */
export const billingJobHandlers = createBillingJobHandlers();

/** Schedules for `jobs({ schedules: { ...billingJobSchedules } })`: both daily, at 00:00 UTC. */
export const billingJobSchedules = {
  "billing.access-reminders": { every: "1d" },
  "billing.expire-requests": { every: "1d" },
} satisfies JobSchedulesInput;
