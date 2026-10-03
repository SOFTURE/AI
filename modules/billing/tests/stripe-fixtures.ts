// Stripe webhook deliveries as Stripe sends them: an event envelope around a Checkout Session or a
// charge, and the `Stripe-Signature` header for it.
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

export function charge(paymentIntent: string, refunded: boolean): Record<string, unknown> {
  return { id: "ch_test_a1", object: "charge", payment_intent: paymentIntent, refunded, amount: 2900, amount_refunded: refunded ? 2900 : 900 };
}

export function stripeEvent(type: string, object: unknown, id = `evt_test_${type.replaceAll(".", "_")}`): string {
  return JSON.stringify({ id, object: "event", type, api_version: "2026-09-30", data: { object } });
}

/** The header for `payload`, signed `secondsAgo` before NOW (or by the clock's `now`). */
export function signature(payload: string, { secondsAgo = 0, secret = WEBHOOK_SECRET, now = NOW }: { secondsAgo?: number; secret?: string; now?: Date } = {}): string {
  return signStripePayload({ payload, secret, timestamp: Math.floor(now.getTime() / 1000) - secondsAgo });
}
