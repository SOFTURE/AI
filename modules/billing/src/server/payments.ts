// Payments a provider reports through its webhook: a paid checkout grants its plan and a refund
// takes back what that payment granted (a partial one by the `partialRefunds` policy), each exactly
// once. `billing.payments` holds one row per paid
// checkout with the grant it caused (a period or lifetime), written in the transaction of the grant,
// so a delivery Stripe repeats (or two events for one checkout) finds the row and changes nothing.
// A payment keeps the total refunded so far (`refunded_amount`, the provider's cumulative figure),
// so a repeated or stale refund delivery finds nothing new and changes nothing.
// Locks: the account first (key share), like `changeEntitlement` and the privacy erase; a refund
// then takes the entitlement before its payment row (`lockEntitlementRow`), as a manual revoke does,
// so a refund and a revoke of one account queue on the entitlement instead of deadlocking on the
// rows each moves back.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq } from "drizzle-orm";
import type { Entitlement, PaymentGrant } from "../contract.js";
import { findPlan } from "../plans.js";
import { moveBackByDays, type RefundShare } from "../refund.js";
import { payments } from "../schema.js";
import { readStripeWebhook, type PaidCheckout, type StripeWebhookError } from "../stripe-webhook.js";
import type { BillingContext } from "./entitlements.js";
import { getBillingOptions } from "./options.js";
import { applyPlan, getBillingPlans } from "./plans.js";
import { hasPaidLifetimePayment, lockEntitlementRow, takeBackGrant } from "./take-back.js";
import { isUserId } from "./user-id.js";

/** The name of `stripe()`, under which its webhook stores payments. */
export const STRIPE_PROVIDER = "stripe";

export interface RecordPaymentInput extends PaidCheckout {
  /** The adapter's name, e.g. `stripe`. */
  readonly provider: string;
}

/** What a webhook delivery changed. */
export type PaymentOutcome =
  /** A new paid checkout: its plan was granted. */
  | { readonly status: "granted"; readonly entitlement: Entitlement }
  /** A full refund of a recorded payment (or the partial one that completes it): what it granted was taken back. */
  | { readonly status: "refunded"; readonly entitlement: Entitlement }
  /** A partial refund of a recorded payment: access changed by the `partialRefunds` policy. */
  | { readonly status: "partially_refunded"; readonly entitlement: Entitlement }
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

    const applied = await applyPlan({ ...ctx, db: tx }, input.userId, input.planId);
    // The plan and the locked account were checked above, and a plan grant always ends later.
    if (!applied.ok) throw new Error(`@softure-ai/billing: granting the paid plan "${input.planId}" failed with ${applied.error}`);
    const [payment] = inserted;
    const { grant } = applied.value;
    // A plan grant always adds a period of at least a day, or lifetime access.
    if (payment === undefined || grant === null) throw new Error(`@softure-ai/billing: the paid plan "${input.planId}" was granted but its payment row or grant is missing`);
    await tx.update(payments).set(getGrantColumns(grant)).where(eq(payments.id, payment.id));
    return ok({ status: "granted", entitlement: applied.value.entitlement });
  });
}

export interface RefundPaymentInput {
  readonly provider: string;
  /** The provider's payment id the refund names (a Stripe PaymentIntent). */
  readonly paymentId: string;
  /**
   * For a partial refund, the total refunded so far in the currency's minor unit (Stripe's
   * `amount_refunded`); omitted when the payment is refunded in full. A total that reaches the
   * payment's amount is a full refund.
   */
  readonly amountRefunded?: number;
}

export interface GrantColumns {
  readonly grantKind: "period" | "lifetime" | null;
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
}

/** The payment row's columns for what its grant added. */
export function getGrantColumns(grant: PaymentGrant): GrantColumns {
  if (grant.kind === "lifetime") return { grantKind: "lifetime", grantedFrom: null, grantedUntil: null };
  return { grantKind: "period", grantedFrom: grant.from, grantedUntil: grant.until };
}

/** The grant a payment row records, or null for a row stored before grants were. */
export function readGrant(row: GrantColumns): PaymentGrant | null {
  if (row.grantKind === "lifetime") return { kind: "lifetime" };
  if (row.grantKind === "period" && row.grantedFrom !== null && row.grantedUntil !== null) return { kind: "period", from: row.grantedFrom, until: row.grantedUntil };
  return null;
}

/**
 * Records a refund of a payment and takes back what it granted, in one transaction. A full refund
 * marks it refunded: a period loses its unused days, a lifetime ends unless another lifetime payment
 * still pays for it, and a payment stored before grants were recorded revokes paid access. A partial
 * refund keeps it paid and follows `billing({ partialRefunds })`: `pro_rata` takes back the share of
 * the unused days that the newly refunded money is of the money not refunded before (rounded down)
 * and shortens the payment's stored period by them; `keep_access` takes nothing back. Partial
 * refunds never end a lifetime nor revoke a payment without a recorded grant; the refund that
 * completes the amount does what a full refund does. `duplicate` when the refund adds nothing to
 * what was recorded (a repeated or stale delivery), `unknown_payment` when billing never recorded
 * the payment. Database errors propagate.
 */
export async function refundPayment(ctx: BillingContext, input: RefundPaymentInput): Promise<Ok<PaymentOutcome>> {
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const match = and(eq(payments.provider, input.provider), eq(payments.paymentId, input.paymentId));
    const [found] = await tx.select({ userId: payments.userId }).from(payments).where(match);
    if (found === undefined) return ok({ status: "unknown_payment" });
    const { userId } = found;
    // The account first (the lock order of every change), the entitlement, then the payment row.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    await lockEntitlementRow(tx, userId);
    const [payment] = await tx.select().from(payments).where(match).for("update");
    // Refunded by a concurrent delivery, or erased with the account in the meantime.
    if (payment?.status !== "paid") return ok({ status: "duplicate" });

    const total = input.amountRefunded === undefined ? payment.amount : Math.min(input.amountRefunded, payment.amount);
    const isFull = total >= payment.amount;
    if (!isFull && total <= payment.refundedAmount) return ok({ status: "duplicate" });
    await tx
      .update(payments)
      .set(isFull ? { status: "refunded", refundedAt: now, refundedAmount: payment.amount } : { refundedAmount: total })
      .where(eq(payments.id, payment.id));

    const share = isFull ? undefined : getPartialShare(ctx, { refunded: total - payment.refundedAmount, outstanding: payment.amount - payment.refundedAmount });
    const grant = readGrant(payment);
    const { entitlement, days } = await takeBackGrant(
      { ...ctx, db: tx },
      { userId, grant, now, share, hasOtherLifetime: () => hasPaidLifetimePayment(tx, userId, payment.id) },
    );
    // The payment stays paid: its stored period ends where the access it still pays for does.
    if (!isFull && days > 0 && grant?.kind === "period") {
      await tx
        .update(payments)
        .set({ grantedUntil: moveBackByDays(grant.until, days, ctx.config.timezone) })
        .where(eq(payments.id, payment.id));
    }
    return ok({ status: isFull ? "refunded" : "partially_refunded", entitlement });
  });
}

/** The share a partial refund takes back under the app's policy: none under `keep_access`. */
function getPartialShare(ctx: BillingContext, share: RefundShare): RefundShare {
  return getBillingOptions(ctx.config).partialRefunds === "keep_access" ? { ...share, refunded: 0 } : share;
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
 * paid checkout is recorded and granted and a refund takes back what its payment granted (a partial
 * one by the `partialRefunds` policy).
 * `billing.webhook_invalid` for a delivery that is not Stripe's (or a replay past the tolerance).
 * Database errors propagate (answer 500, Stripe retries).
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
    case "payment_partially_refunded": {
      const { paymentId, amountRefunded } = event.value;
      const refunded = await refundPayment(ctx, { provider: STRIPE_PROVIDER, paymentId, amountRefunded });
      return ok({ eventId, outcome: refunded.value });
    }
  }
}
