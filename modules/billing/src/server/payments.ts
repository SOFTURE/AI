// Payments a provider reports through its webhook: a paid checkout grants its plan and a full refund
// takes back what that payment granted, each exactly once. `billing.payments` holds one row per paid
// checkout with the grant it caused (a period or lifetime), written in the transaction of the grant,
// so a delivery Stripe repeats (or two events for one checkout) finds the row and changes nothing.
// Locks follow `changeEntitlement`'s order (account, then payment, then entitlement), like the
// privacy erase, so none of them deadlock.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, eq, gte, ne } from "drizzle-orm";
import type { Entitlement, EntitlementEvent, EntitlementRecord, PaymentGrant } from "../contract.js";
import { findPlan } from "../plans.js";
import { getRefundEvent, getUnusedDays, moveBackByDays } from "../refund.js";
import { entitlements, payments } from "../schema.js";
import { readStripeWebhook, type PaidCheckout, type StripeWebhookError } from "../stripe-webhook.js";
import { resolveEntitlement } from "../entitlement.js";
import { changeEntitlement, findEntitlementRecord, type BillingContext } from "./entitlements.js";
import { getEntitlementPolicy } from "./options.js";
import { applyPlan, getBillingPlans } from "./plans.js";
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
  /** A full refund of a recorded payment: what it granted was taken back. */
  | { readonly status: "refunded"; readonly entitlement: Entitlement }
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
}

interface GrantColumns {
  readonly grantKind: "period" | "lifetime" | null;
  readonly grantedFrom: Date | null;
  readonly grantedUntil: Date | null;
}

/** The payment row's columns for what its grant added. */
function getGrantColumns(grant: PaymentGrant): GrantColumns {
  if (grant.kind === "lifetime") return { grantKind: "lifetime", grantedFrom: null, grantedUntil: null };
  return { grantKind: "period", grantedFrom: grant.from, grantedUntil: grant.until };
}

/** The grant a payment row records, or null for a row stored before grants were. */
function readGrant(row: GrantColumns): PaymentGrant | null {
  if (row.grantKind === "lifetime") return { kind: "lifetime" };
  if (row.grantKind === "period" && row.grantedFrom !== null && row.grantedUntil !== null) return { kind: "period", from: row.grantedFrom, until: row.grantedUntil };
  return null;
}

/** Whether another payment of the account still pays for lifetime access. */
async function hasOtherLifetimePayment(tx: Queryable, userId: string, paymentRowId: string): Promise<boolean> {
  const [other] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.grantKind, "lifetime"), eq(payments.status, "paid"), ne(payments.id, paymentRowId)))
    .limit(1);
  return other !== undefined;
}

interface ShiftLaterPeriodsInput {
  readonly userId: string;
  /** The refunded period. */
  readonly grant: Extract<PaymentGrant, { kind: "period" }>;
  readonly days: number;
  readonly timezone: string;
}

/**
 * Moves the stored periods of the account's paid payments that follow the refunded one back by the
 * days the refund took, so they still say where their access lies and a later refund of one of them
 * takes back the right days.
 */
async function shiftLaterPeriods(tx: Queryable, input: ShiftLaterPeriodsInput): Promise<void> {
  const later = await tx
    .select({ id: payments.id, grantedFrom: payments.grantedFrom, grantedUntil: payments.grantedUntil })
    .from(payments)
    .where(and(eq(payments.userId, input.userId), eq(payments.grantKind, "period"), eq(payments.status, "paid"), gte(payments.grantedFrom, input.grant.until)));
  for (const row of later) {
    if (row.grantedFrom === null || row.grantedUntil === null) continue;
    await tx
      .update(payments)
      .set({ grantedFrom: moveBackByDays(row.grantedFrom, input.days, input.timezone), grantedUntil: moveBackByDays(row.grantedUntil, input.days, input.timezone) })
      .where(eq(payments.id, row.id));
  }
}

interface RefundChangeInput {
  readonly record: EntitlementRecord;
  /** What the payment granted; null for a row stored before grants were recorded. */
  readonly grant: PaymentGrant | null;
  readonly paymentRowId: string;
  readonly userId: string;
  readonly now: Date;
  readonly timezone: string;
}

/** The change a refund makes, decided under the entitlement lock, or null when it takes nothing back. */
async function getRefundChange(tx: Queryable, input: RefundChangeInput): Promise<EntitlementEvent | null> {
  const { record, grant } = input;
  if (grant === null) return { type: "revoke" };
  if (grant.kind === "lifetime" && (await hasOtherLifetimePayment(tx, input.userId, input.paymentRowId))) return null;
  return getRefundEvent(record, grant, input.now, input.timezone);
}

/**
 * Marks a recorded payment refunded and takes back what it granted, in one transaction: a period
 * loses its unused days, a lifetime ends unless another lifetime payment still pays for it, and a
 * payment stored before grants were recorded revokes paid access. `duplicate` when it was refunded
 * before, `unknown_payment` when billing never recorded it. Database errors propagate.
 */
export async function refundPayment(ctx: BillingContext, input: RefundPaymentInput): Promise<Ok<PaymentOutcome>> {
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const match = and(eq(payments.provider, input.provider), eq(payments.paymentId, input.paymentId));
    const [payment] = await tx.select({ userId: payments.userId }).from(payments).where(match);
    if (payment === undefined) return ok({ status: "unknown_payment" });
    // The account first (the lock order of every change), then the conditional update.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, payment.userId)).for("key share");
    const [refunded] = await tx
      .update(payments)
      .set({ status: "refunded", refundedAt: now })
      .where(and(match, eq(payments.status, "paid")))
      .returning();
    // Refunded by a concurrent delivery, or erased with the account in the meantime.
    if (refunded === undefined) return ok({ status: "duplicate" });

    // The entitlement next, locked until the end: a lifetime bought at the same time is either
    // committed and seen below, or waits for this lock and is granted after the refund.
    await tx.select({ userId: entitlements.userId }).from(entitlements).where(eq(entitlements.userId, payment.userId)).for("update");
    const record = await findEntitlementRecord({ ...ctx, db: tx }, payment.userId);
    // The payment row references the account, which the key share lock above keeps.
    if (record === null) throw new Error("@softure-ai/billing: a refunded payment has no account");
    const grant = readGrant(refunded);
    const { timezone } = ctx.config;
    const event = await getRefundChange(tx, { record, grant, paymentRowId: refunded.id, userId: payment.userId, now, timezone });
    if (grant?.kind === "period" && event !== null) {
      await shiftLaterPeriods(tx, { userId: payment.userId, grant, days: getUnusedDays(grant, now, timezone), timezone });
    }
    if (event === null) return ok({ status: "refunded", entitlement: resolveEntitlement(record, now, getEntitlementPolicy(ctx.config)) });
    const changed = await changeEntitlement({ ...ctx, db: tx }, payment.userId, event);
    // The payment row exists, so its account does (ON DELETE CASCADE), and these events are never refused.
    if (!changed.ok) throw new Error(`@softure-ai/billing: taking back a refunded payment failed with ${changed.error}`);
    return ok({ status: "refunded", entitlement: changed.value });
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
 * paid checkout is recorded and granted and a full refund takes back what its payment granted.
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
  }
}
