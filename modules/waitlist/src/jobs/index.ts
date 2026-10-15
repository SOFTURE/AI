// The jobs adapter of @softure-ai/waitlist: its cleanup of unconfirmed sign-ups as a `@softure-ai/jobs` handler and
// schedule (an optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { pruneUnconfirmedSignups } from "../server/signups.js";

/** Handlers for the worker: `handlers: { ...waitlistJobHandlers }`. */
export const waitlistJobHandlers = {
  /** Deletes sign-ups whose confirmation link expired unused (`pruneUnconfirmedSignups`). */
  "waitlist.prune-unconfirmed-signups": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await pruneUnconfirmedSignups(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/** Schedules for `jobs({ schedules: { ...waitlistJobSchedules } })`: hourly. */
export const waitlistJobSchedules = {
  "waitlist.prune-unconfirmed-signups": { every: "1h" },
} satisfies JobSchedulesInput;
