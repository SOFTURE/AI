// The confirmation mail job: the join enqueues the sign-up's id in its own transaction (never the
// address or a token), and the handler mails a fresh link. Every attempt issues a new token that
// replaces the last, so a retry after a send that was not recorded mails a second link, and only the
// newer one works.
import { err, errorLogLabel, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, type JobHandlers } from "@softure-ai/jobs";
import { enqueueJob } from "@softure-ai/jobs/server";
import type { MailingErrorCode } from "@softure-ai/mailing";
import { z } from "zod";
import type { ConfirmationMailEnqueuer } from "../options.js";
import { sendConfirmationMail, type ConfirmationMailOutcome } from "../server/confirmation-mail.js";

/** The queue of the confirmation mail job; define it in `jobs({ queues })`. */
export const CONFIRMATION_MAIL_QUEUE = "waitlist.confirmation-mail";

/** Failures a later attempt can fix: the provider or the sending account, not the mail. */
const RETRIED_CODES: ReadonlySet<MailingErrorCode> = new Set(["mailing.unavailable", "mailing.quota_exceeded", "mailing.provider_refused"]);

/**
 * `waitlist({ doubleOptIn: true, confirmationMail: { enqueue: enqueueConfirmationMail } })`: enqueues
 * `{ signupId }` on `waitlist.confirmation-mail`. While a job of the sign-up is pending, a new request joins it.
 */
export const enqueueConfirmationMail: ConfirmationMailEnqueuer = async (ctx, signupId) => {
  await enqueueJob(ctx, { queue: CONFIRMATION_MAIL_QUEUE, payload: { signupId }, dedupKey: signupId });
};

/**
 * Mails the link. A sign-up no longer waiting for one ends the job without a mail; a provider
 * outage, a spent quota or a refused account is retried with the queue's backoff; a mail the
 * provider or mailing refuses fails the job. A throw (the database, the app's `mailTemplate`) is logged
 * by its label, never the link, and retried.
 */
export const confirmationMailJobHandler = defineJobHandler({
  payload: z.object({ signupId: z.uuid() }),
  run: async ({ signupId }, ctx) => {
    let outcome: ConfirmationMailOutcome;
    try {
      outcome = await sendConfirmationMail(ctx, signupId);
    } catch (error) {
      console.error(`@softure-ai/waitlist: the confirmation mail job failed: ${errorLogLabel(error)}`);
      return err("waitlist.confirmation_mail_failed");
    }
    if (outcome.status === "nothing_pending" || outcome.result.ok) return ok();
    const { error } = outcome.result;
    return RETRIED_CODES.has(error) ? { ok: false, error } : failJob(error);
  },
});

/** The mail job for the worker, next to the prune handler: `handlers: { ...waitlistJobHandlers, ...confirmationMailJobHandlers }`. */
export const confirmationMailJobHandlers: JobHandlers = { [CONFIRMATION_MAIL_QUEUE]: confirmationMailJobHandler };
