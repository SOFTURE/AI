// The jobs adapter of @softure-ai/auth: its prune functions as `@softure-ai/jobs` handlers and schedules, and the
// password reset mail sent by a job with retry (an optional peer dependency; only apps that import this entry need it).
import { ok } from "@softure-ai/core";
import { defineJobHandler, type JobHandlers, type JobSchedulesInput } from "@softure-ai/jobs";
import { z } from "zod";
import { prunePasswordResets } from "../server/password-reset.js";
import { pruneSessions } from "../server/sessions.js";

/** Handlers for the worker: `handlers: { ...authJobHandlers }`. */
export const authJobHandlers = {
  /** Deletes expired sessions (`pruneSessions`). */
  "auth.prune-sessions": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await pruneSessions(ctx);
      return ok();
    },
  }),
  /** Deletes expired password reset links (`prunePasswordResets`). */
  "auth.prune-password-resets": defineJobHandler({
    payload: z.object({}),
    run: async (_payload, ctx) => {
      await prunePasswordResets(ctx);
      return ok();
    },
  }),
} satisfies JobHandlers;

/** Schedules for `jobs({ schedules: { ...authJobSchedules } })`: sessions hourly, reset links daily. */
export const authJobSchedules = {
  "auth.prune-sessions": { every: "1h" },
  "auth.prune-password-resets": { every: "1d" },
} satisfies JobSchedulesInput;

export { enqueuePasswordReset, PASSWORD_RESET_QUEUE, passwordResetJobHandler, passwordResetJobHandlers } from "./password-reset-job.js";
