// Stripe webhook deliveries as Stripe sends them: an event envelope around a Checkout Session, a
// charge or a refund, and the `Stripe-Signature` header for it.
import { signStripePayload, STRIPE_METADATA } from "@softure-ai/billing";
import { NOW } from "./support.js";

/** A test signing secret: the webhook is a local fake. */
export const WEBHOOK_SECRET = "whsec_test_billing_fixture_secret";

export interface SessionInput {
  readonly id?: string;
  readonly userId: string;
  readonly planId: string;
  readonly paymentIntent?: string | null;
  readonly paymentStatus?: string;
  readonly amount?: number;
  readonly currency?: string;
}

export function checkoutSession(input: SessionInput): Record<string, unknown> {
  return {
    id: input.id ?? "cs_test_a1",
    object: "checkout.session",
    mode: "payment",
    payment_status: input.paymentStatus ?? "paid",
    payment_intent: input.paymentIntent === undefined ? "pi_test_a1" : input.paymentIntent,
    amount_total: input.amount ?? 2900,
    currency: input.currency ?? "pln",
    client_reference_id: input.userId,
    metadata: { [STRIPE_METADATA.userId]: input.userId, [STRIPE_METADATA.planId]: input.planId },
  };
}

/**
 * A charge of PLN 29.00 (or `amount` in `currency`, Stripe's unit) refunded in full, or in part up to
 * `amountRefunded` (the total so far, 900 by default).
 */
export function charge(
  paymentIntent: string,
  refunded: boolean,
  amountRefunded = refunded ? 2900 : 900,
  { amount = 2900, currency = "pln" }: { amount?: number; currency?: string } = {},
): Record<string, unknown> {
  return { id: "ch_test_a1", object: "charge", payment_intent: paymentIntent, refunded, amount, amount_refunded: amountRefunded, currency };
}

/** Unix seconds of `instant`, as Stripe dates events and objects. */
export function unixSeconds(instant: Date): number {
  return Math.floor(instant.getTime() / 1000);
}

/** An event made at `created` (NOW by default). */
export function stripeEvent(type: string, object: unknown, id = `evt_test_${type.replaceAll(".", "_")}`, created: Date = NOW): string {
  return JSON.stringify({ id, object: "event", type, api_version: "2026-09-30", created: unixSeconds(created), data: { object } });
}

export interface RefundInput {
  readonly id?: string;
  readonly paymentIntent?: string | null;
  /** Stripe's unit. */
  readonly amount?: number;
  readonly currency?: string;
  readonly created?: Date;
  readonly status?: string;
}

/** A Refund of PLN 9.00 of `pi_test_a1`, created at NOW, that failed. */
export function refund(input: RefundInput = {}): Record<string, unknown> {
  return {
    id: input.id ?? "re_test_a1",
    object: "refund",
    payment_intent: input.paymentIntent === undefined ? "pi_test_a1" : input.paymentIntent,
    charge: "ch_test_a1",
    amount: input.amount ?? 900,
    currency: input.currency ?? "pln",
    created: unixSeconds(input.created ?? NOW),
    status: input.status ?? "failed",
  };
}

/** The header for `payload`, signed `secondsAgo` before NOW (or by the clock's `now`). */
export function signature(payload: string, { secondsAgo = 0, secret = WEBHOOK_SECRET, now = NOW }: { secondsAgo?: number; secret?: string; now?: Date } = {}): string {
  return signStripePayload({ payload, secret, timestamp: Math.floor(now.getTime() / 1000) - secondsAgo });
}
