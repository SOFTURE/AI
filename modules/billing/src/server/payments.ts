// Payments a provider reports through its webhook: a paid checkout grants its plan and a full refund
// takes the paid access back, each exactly once. `billing.payments` holds one row per paid checkout,
// written in the transaction of the grant it causes, so a delivery Stripe repeats (or two events
// for one checkout) finds the row and changes nothing. Locks follow `changeEntitlement`'s order
// (account, then payment, then entitlement), like the privacy erase, so none of them deadlock.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import type { Entitlement } from "../contract.js";
import { findPlan } from "../plans.js";
import { payments } from "../schema.js";
import { readStripeWebhook, type PaidCheckout, type StripeWebhookError } from "../stripe-webhook.js";
import { changeEntitlement, type BillingContext } from "./entitlements.js";
import { getBillingPlans, grantPlan } from "./plans.js";
import { isUserId } from "./user-id.js";

/** The provider name `stripe()` and its webhook store payments under. */
export const STRIPE_PROVIDER = "stripe";

export interface RecordPaymentInput extends PaidCheckout {
  /** The adapter's name, e.g. `stripe`. */
  readonly provider: string;
}

/** What a webhook delivery changed. */
export type PaymentOutcome =
  /** A new paid checkout: its plan was granted. */
  | { readonly status: "granted"; readonly entitlement: Entitlement }
  /** A full refund of a recorded payment: paid access was revoked. */
  | { readonly status: "revoked"; readonly entitlement: Entitlement }
  /** Recorded (or refunded) already: a repeated delivery, nothing changed. */
  | { readonly status: "duplicate" }
  /** A refund of a payment billing never recorded: nothing to take back. */
  | { readonly status: "unknown_payment" }
  /** An event billing does not act on. */
  | { readonly status: "ignored"; readonly reason: string };

export type RecordPaymentError = "billing.account_unknown" | "billing.plan_unknown";

/**
 * Records a paid checkout and grants one payment of its plan, in one transaction: `duplicate` when
 * the checkout was recorded before. An account or plan that no longer exists stores nothing (the
 * money is refunded in the provider's dashboard). Database errors propagate.
 */
export async function recordPayment(ctx: BillingContext, input: RecordPaymentInput): Promise<Ok<PaymentOutcome> | Err<RecordPaymentError>> {
  if (findPlan(getBillingPlans(ctx.config), input.planId) === undefined) return err("billing.plan_unknown");
  if (!isUserId(input.userId)) return err("billing.account_unknown");
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    // A shared lock: the account cannot be deleted before the grant below.
    const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).for("key share");
    if (account === undefined) return err("billing.account_unknown");

    // A concurrent delivery of the same checkout waits here for this transaction, then conflicts.
    const inserted = await tx
      .insert(payments)
      .values({
        userId: input.userId,
        provider: input.provider,
        checkoutId: input.checkoutId,
        paymentId: input.paymentId,
        planId: input.planId,
        amount: input.amount,
        currency: input.currency,
        status: "paid",
        paidAt: now,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) return ok({ status: "duplicate" });

    const granted = await grantPlan({ ...ctx, db: tx }, input.userId, input.planId);
    // The plan and the locked account were checked above, and a plan grant always ends later.
    if (!granted.ok) throw new Error(`@softure-ai/billing: granting the paid plan "${input.planId}" failed with ${granted.error}`);
    return ok({ status: "granted", entitlement: granted.value });
  });
}

export interface RefundPaymentInput {
  readonly provider: string;
  /** The provider's payment id the refund names (a Stripe PaymentIntent). */
  readonly paymentId: string;
}

/**
 * Marks a recorded payment refunded and revokes the account's paid access, in one transaction:
 * `duplicate` when it was refunded before, `unknown_payment` when billing never recorded it.
 * Database errors propagate.
 */
export async function refundPayment(ctx: BillingContext, input: RefundPaymentInput): Promise<Ok<PaymentOutcome>> {
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const match = and(eq(payments.provider, input.provider), eq(payments.paymentId, input.paymentId));
    const [payment] = await tx.select({ userId: payments.userId }).from(payments).where(match);
    if (payment === undefined) return ok({ status: "unknown_payment" });
    // The account first (the lock order of every change), then the conditional update.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, payment.userId)).for("key share");
    const refunded = await tx
      .update(payments)
      .set({ status: "refunded", refundedAt: now })
      .where(and(match, eq(payments.status, "paid")))
      .returning();
    // Refunded by a concurrent delivery, or erased with the account in the meantime.
    if (refunded.length === 0) return ok({ status: "duplicate" });

    const revoked = await changeEntitlement({ ...ctx, db: tx }, payment.userId, { type: "revoke" });
    // The payment row exists, so its account does (ON DELETE CASCADE), and a revoke is never refused.
    if (!revoked.ok) throw new Error(`@softure-ai/billing: revoking paid access after a refund failed with ${revoked.error}`);
    return ok({ status: "revoked", entitlement: revoked.value });
  });
}

export interface ReceiveStripeWebhookInput {
  /** The raw request body, exactly as Stripe sent it. */
  readonly payload: string;
  /** The `Stripe-Signature` header, or null. */
  readonly signature: string | null;
  /** The endpoint's signing secret (`whsec_...`). */
  readonly secret: string;
}

export interface StripeWebhookReceipt {
  readonly eventId: string;
  readonly outcome:
    | PaymentOutcome
    /** A paid checkout whose account or plan is gone: nothing stored, refund it in Stripe. */
    | { readonly status: "refused"; readonly error: RecordPaymentError; readonly checkoutId: string };
}

/**
 * One Stripe webhook delivery: the signature is checked before anything is parsed or read, then a
 * paid checkout is recorded and granted and a full refund revoked. `billing.webhook_invalid` for a
 * delivery that is not Stripe's (or a replay past the tolerance). Database errors propagate (answer
 * 500, Stripe retries).
 */
export async function receiveStripeWebhook(ctx: BillingContext, input: ReceiveStripeWebhookInput): Promise<Ok<StripeWebhookReceipt> | Err<StripeWebhookError>> {
  const event = readStripeWebhook({ payload: input.payload, header: input.signature, secret: input.secret, now: ctx.clock.now() });
  if (!event.ok) return event;
  const { eventId } = event.value;
  switch (event.value.type) {
    case "ignored":
      return ok({ eventId, outcome: { status: "ignored", reason: event.value.reason } });
    case "checkout_paid": {
      const { checkout } = event.value;
      const recorded = await recordPayment(ctx, { provider: STRIPE_PROVIDER, ...checkout });
      return ok({ eventId, outcome: recorded.ok ? recorded.value : { status: "refused", error: recorded.error, checkoutId: checkout.checkoutId } });
    }
    case "payment_refunded": {
      const refunded = await refundPayment(ctx, { provider: STRIPE_PROVIDER, paymentId: event.value.paymentId });
      return ok({ eventId, outcome: refunded.value });
    }
  }
}
