// Deliveries through @softure-ai/jobs: the app enqueues a delivery in its own transaction and the jobs worker sends
// it, retrying while the provider is unavailable. The job runs at least once; the delivery ledger and its idempotency
// key make the mail go out once. The job payload holds the ledger scope and the app's ids, never the mail: the
// handler builds the mail from the app's data when it runs.
import { err, ok, type Ok } from "@softure-ai/core";
import { defineJobHandler, failJob, retryJobLater, type JobFailure, type JobHandler, type JobHandlerContext } from "@softure-ai/jobs";
import { enqueueJob, type EnqueuedJob, type JobsContext } from "@softure-ai/jobs/server";
import { z } from "zod";
import type { OutgoingMail } from "../contract.js";
export type { DeliveryJobErrorCode } from "../contract.js";

/** What a delivery job returns: done, or a failure the jobs worker retries or fails. */
export type DeliveryJobResult = Ok<undefined> | JobFailure;
import { deliverOnce, isDeliveryScope, type DeliverOptions, type DeliveryOutcome } from "../server/deliveries.js";
import { getMailingOptions } from "../server/options.js";

export interface EnqueueDeliveryInput<TPayload> {
  /** A queue defined in `jobs({ queues })` whose handler is a `defineDeliveryJobHandler`. */
  readonly queue: string;
  /**
   * The ledger scope of the mail (`deliverOnce`'s `scope`), e.g. `auth.password-reset:<request id>`. Also the job's
   * dedup key: while a job for this scope is pending or running, a second enqueue returns it.
   */
  readonly scope: string;
  /** The app's ids the handler builds the mail from. JSON; no addresses, names or tokens. */
  readonly payload: TPayload;
  /** When the job becomes due; default now. Not together with `delaySeconds`. */
  readonly runAt?: Date;
  readonly delaySeconds?: number;
  /** Overrides the queue's `maxAttempts` for this job. */
  readonly maxAttempts?: number;
}

/**
 * Enqueues a delivery. Pass the caller's transaction as `ctx.db`, so the job exists exactly when the caller's own
 * change commits. Throws for a malformed scope, and like `enqueueJob` (an unknown queue, a database failure).
 */
export async function enqueueDelivery<TPayload>(ctx: JobsContext, input: EnqueueDeliveryInput<TPayload>): Promise<EnqueuedJob> {
  if (!isDeliveryScope(input.scope)) {
    throw new Error(`@softure-ai/mailing: enqueueDelivery scope "${input.scope}" must be lowercase letters, digits and ._:- (at most 128 characters)`);
  }
  return enqueueJob(ctx, {
    queue: input.queue,
    payload: { scope: input.scope, payload: input.payload },
    dedupKey: input.scope,
    ...(input.runAt === undefined ? {} : { runAt: input.runAt }),
    ...(input.delaySeconds === undefined ? {} : { delaySeconds: input.delaySeconds }),
    ...(input.maxAttempts === undefined ? {} : { maxAttempts: input.maxAttempts }),
  });
}

/** What `buildMail` receives besides the app's payload: the job's context and the delivery's scope. */
export interface DeliveryJobContext extends JobHandlerContext {
  readonly scope: string;
}

export interface DeliveryJobHandlerOptions<TSchema extends z.ZodType> {
  /** The schema of the app's payload (the `payload` given to `enqueueDelivery`). */
  readonly payload: TSchema;
  /**
   * Builds the mail from the app's data. Called on every attempt, before the ledger is read, so it must have no side
   * effects and return the same mail each time: a different body under the same idempotency key is refused by the
   * provider. Return `null` when there is nothing to send any more (the account is gone); the job then succeeds.
   */
  readonly buildMail: (payload: z.output<TSchema>, context: DeliveryJobContext) => Promise<OutgoingMail | null>;
  /** The ledger's claim windows; `maxAttempts` is the job's, so the ledger does not count attempts here. */
  readonly deliverOptions?: Omit<DeliverOptions, "maxAttempts">;
}

/**
 * A jobs handler that sends one delivery through the ledger (`deliverOnce`) and turns its outcome into the job's
 * (`getDeliveryJobResult`). Register it for the queue `enqueueDelivery` writes to:
 *
 *   export const handlers: JobHandlers = {
 *     "mail.welcome": defineDeliveryJobHandler({ payload: z.object({ userId: z.string() }), buildMail: buildWelcomeMail }),
 *   };
 */
export function defineDeliveryJobHandler<TSchema extends z.ZodType>(
  options: DeliveryJobHandlerOptions<TSchema>,
): JobHandler<{ scope: string; payload: z.output<TSchema> }> {
  // The cast keeps the payload's own output type, which zod's object inference widens for a generic schema.
  const schema = z.object({
    scope: z.string().refine(isDeliveryScope),
    payload: options.payload,
  }) as unknown as z.ZodType<{ scope: string; payload: z.output<TSchema> }>;
  return defineJobHandler({
    payload: schema,
    run: async ({ scope, payload }, context) => {
      const mail = await options.buildMail(payload, { ...context, scope });
      if (mail === null) return ok();
      const outcome = await deliverOnce(context, { scope, mail }, { ...options.deliverOptions, maxAttempts: null });
      const staleClaimMs = options.deliverOptions?.staleClaimMs ?? getMailingOptions(context.config).staleClaimMs;
      return getDeliveryJobResult(outcome, { staleClaimMs });
    },
  });
}

/**
 * Turns a `deliverOnce` outcome into a job result, for an app that writes its own handler:
 *
 * - `sent`, `done`: done.
 * - `rejected` (invalid, suppressed, refused mail): failed at once with its reason.
 * - `retry-later`, `halted` (the provider is down, the account refused or out of quota): retried after the provider's
 *   `Retry-After`, else after the queue's backoff.
 * - `in-flight`: retried once the other sender's claim could be stale (`staleClaimMs`).
 * - `uncertain`: failed with `mailing.delivery_uncertain`; the operator decides whether to send it again.
 */
export function getDeliveryJobResult(outcome: DeliveryOutcome, options: { readonly staleClaimMs: number }): DeliveryJobResult {
  switch (outcome.status) {
    case "sent":
    case "done":
      return ok();
    case "rejected":
      return failJob(outcome.reason);
    case "retry-later":
      return retryAfter("mailing.unavailable", outcome.retryAfterSeconds);
    case "halted":
      return retryAfter(outcome.reason, outcome.retryAfterSeconds);
    case "in-flight":
      // One second past the window: a claim exactly `staleClaimMs` old is still fresh.
      return retryJobLater("mailing.delivery_in_flight", Math.ceil(options.staleClaimMs / 1000) + 1);
    case "uncertain":
      return failJob("mailing.delivery_uncertain");
  }
}

function retryAfter(code: "mailing.unavailable" | "mailing.provider_refused" | "mailing.quota_exceeded", seconds: number | undefined): DeliveryJobResult {
  return seconds === undefined ? err(code) : retryJobLater(code, seconds);
}
