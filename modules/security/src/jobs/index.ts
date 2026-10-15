// The jobs adapter of @softure-ai/security: its rate limit cleanup as a `@softure-ai/jobs` handler and schedule (an
// optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { pruneRateLimits } from "../server/rate-limit.js";

/** Handlers for the worker: `handlers: { ...securityJobHandlers }`. */
export const securityJobHandlers = {
  /** Deletes rate limit rows two windows after they started (`pruneRateLimits`). */
  "security.prune-rate-limits": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await pruneRateLimits(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/** Schedules for `jobs({ schedules: { ...securityJobSchedules } })`: hourly. */
export const securityJobSchedules = {
  "security.prune-rate-limits": { every: "1h" },
} satisfies JobSchedulesInput;
