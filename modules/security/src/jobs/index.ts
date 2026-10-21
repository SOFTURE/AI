// The jobs adapter of @softure-ai/security: its rate limit and webhook delivery cleanups as `@softure-ai/jobs` handlers
// and schedules (an optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { pruneRateLimits } from "../server/rate-limit.js";
import { pruneWebhookDeliveries } from "../server/webhook-deliveries.js";

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
  /** Deletes webhook delivery ids past `webhookDeliveries.retentionDays` (`pruneWebhookDeliveries`). */
  "security.prune-webhook-deliveries": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await pruneWebhookDeliveries(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/** Schedules for `jobs({ schedules: { ...securityJobSchedules } })`: rate limits hourly, webhook deliveries daily. */
export const securityJobSchedules = {
  "security.prune-rate-limits": { every: "1h" },
  "security.prune-webhook-deliveries": { every: "1d" },
} satisfies JobSchedulesInput;
