// The jobs adapter of @softure-ai/analytics: its funnel count cleanup as a `@softure-ai/jobs` handler and schedule
// (an optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { pruneFunnelCounts } from "../server/funnel.js";

const PRUNE_FUNNEL_COUNTS = "analytics.prune-funnel-counts";

/** Handlers for the worker: `handlers: { ...analyticsJobHandlers }`. */
export const analyticsJobHandlers = {
  /** Deletes the funnel counts of days before the last `keepDays` days (`pruneFunnelCounts`). */
  [PRUNE_FUNNEL_COUNTS]: defineJobHandler({
    payload: z.object({ keepDays: z.number().int().min(1) }),
    run: async ({ keepDays }, ctx) => {
      await pruneFunnelCounts(ctx, { keepDays });
      return ok();
    },
  }),
} satisfies JobHandlers;

export interface AnalyticsJobSchedulesInput {
  /** Days of funnel counts to keep, today included; how long is the app's choice (the counts hold no personal data). */
  readonly keepDays: number;
}

/** Schedules for `jobs({ schedules: { ...createAnalyticsJobSchedules({ keepDays: 400 }) } })`: daily. */
export function createAnalyticsJobSchedules(input: AnalyticsJobSchedulesInput): JobSchedulesInput {
  if (!Number.isInteger(input.keepDays) || input.keepDays < 1) {
    throw new RangeError(`createAnalyticsJobSchedules: keepDays must be a whole number of at least 1, got ${String(input.keepDays)}`);
  }
  return { [PRUNE_FUNNEL_COUNTS]: { every: "1d", payload: { keepDays: input.keepDays } } };
}
