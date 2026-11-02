// The jobs adapter of @softure-ai/metering: the ledger's retention as a `@softure-ai/jobs` handler and schedule
// (an optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { assertKeepDays, MIN_KEEP_DAYS, pruneCharges } from "../server/prune.js";

const PRUNE_CHARGES = "metering.prune-charges";

/** Handlers for the worker: `handlers: { ...meteringJobHandlers }`. */
export const meteringJobHandlers = {
  /** Deletes charges older than `keepDays` and expired reservations (`pruneCharges`). */
  [PRUNE_CHARGES]: defineJobHandler({
    payload: z.object({ keepDays: z.number().int().min(MIN_KEEP_DAYS) }),
    run: async ({ keepDays }, ctx) => {
      await pruneCharges(ctx, { keepDays });
      return ok();
    },
  }),
} satisfies JobHandlers;

export interface MeteringJobSchedulesInput {
  /** Days of charges to keep, at least 32; how long is the app's choice (its bookkeeping may need years). */
  readonly keepDays: number;
}

/** Schedules for `jobs({ schedules: { ...createMeteringJobSchedules({ keepDays: 400 }) } })`: daily. */
export function createMeteringJobSchedules(input: MeteringJobSchedulesInput): JobSchedulesInput {
  assertKeepDays("createMeteringJobSchedules", input.keepDays);
  return { [PRUNE_CHARGES]: { every: "1d", payload: { keepDays: input.keepDays } } };
}
