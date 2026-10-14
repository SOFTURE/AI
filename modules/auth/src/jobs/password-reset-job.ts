// The password reset job: the request enqueues the account's id (never the address or a token), and
// the handler issues a fresh link and calls the app's sender. Only the token's hash is stored, so the
// link cannot be rebuilt from the database: every attempt issues a new one, which replaces the last.
// A retry after a send that was not recorded therefore mails a second link, and only the newer works.
import { err, errorLogLabel, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, type JobHandlers } from "@softure-ai/jobs";
import { enqueueJob } from "@softure-ai/jobs/server";
import { z } from "zod";
import type { PasswordResetEnqueuer } from "../password-reset-sender.js";
import { getAuthOptions } from "../server/options.js";
import { sendPasswordReset } from "../server/password-reset.js";

/** The queue of the reset job; define it in `jobs({ queues })`. */
export const PASSWORD_RESET_QUEUE = "auth.password-reset";

/**
 * `auth({ passwordReset: { send, enqueue: enqueuePasswordReset } })`: enqueues `{ userId }` on
 * `auth.password-reset`. While a job of the account is pending, a new request joins it.
 */
export const enqueuePasswordReset: PasswordResetEnqueuer = async (ctx, userId) => {
  await enqueueJob(ctx, { queue: PASSWORD_RESET_QUEUE, payload: { userId }, dedupKey: userId });
};

/**
 * Issues the link and calls `passwordReset.send`. A gone account ends the job without a mail; a
 * failing sender is logged by its label (never the link) and retried with the queue's backoff.
 */
export const passwordResetJobHandler = defineJobHandler({
  payload: z.object({ userId: z.uuid() }),
  run: async ({ userId }, ctx) => {
    if (getAuthOptions(ctx.config).passwordReset.send === undefined) return failJob("auth.password_reset_unavailable");
    try {
      await sendPasswordReset(ctx, userId);
    } catch (error) {
      console.error(`@softure-ai/auth: the password reset job failed: ${errorLogLabel(error)}`);
      return err("auth.password_reset_send_failed");
    }
    return ok();
  },
});

/** The handlers auth contributes to the worker: `runJobWorkerProcess({ config, handlers: { ...authJobHandlers } })`. */
export const authJobHandlers: JobHandlers = { [PASSWORD_RESET_QUEUE]: passwordResetJobHandler };
