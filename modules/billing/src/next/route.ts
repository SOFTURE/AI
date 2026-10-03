// The Stripe webhook route. Mount it with a rename in app/api/billing/webhook/route.ts:
// `export { stripeWebhookRoute as POST } from "@softure-ai/billing/next"`, and point a Stripe
// webhook endpoint at it for `checkout.session.completed`, `checkout.session.async_payment_succeeded`
// and `charge.refunded`.
//
// Stripe calls it from its own servers: no session, no cookies, so it stays outside any auth
// guard. There is no rate limit on purpose: Stripe sends from a few addresses, and a bucket would
// drop real payments. The body is capped and the signature checked before the database is touched.
import { errorLogLabel } from "@softure-ai/core";
import { readSmallBody } from "@softure-ai/security";
import { receiveStripeWebhook } from "../server/payments.js";
import { STRIPE_SIGNATURE_HEADER } from "../stripe-webhook.js";
import { getBillingContext } from "./context.js";

export const STRIPE_WEBHOOK_SECRET_ENV = "STRIPE_WEBHOOK_SECRET";
/** Stripe's checkout and charge events are a few kilobytes; anything far larger is not Stripe. */
export const STRIPE_WEBHOOK_MAX_BYTES = 256 * 1024;

const NO_STORE = { "cache-control": "no-store" };

function answer(status: number): Response {
  return new Response(null, { status, headers: NO_STORE });
}

/**
 * Handles one delivery: 200 once it is recorded (also again, and for events billing ignores), 400
 * for a delivery that is not signed by Stripe within the tolerance, 413 for an oversized body, 500
 * when the secret is missing or the database fails, so Stripe retries. A payment whose account or
 * plan is gone answers 200 and is logged: a retry cannot fix it, the owner refunds it in Stripe.
 */
export async function stripeWebhookRoute(request: Request): Promise<Response> {
  const secret = (process.env[STRIPE_WEBHOOK_SECRET_ENV] ?? "").trim();
  if (secret === "") {
    console.error(`@softure-ai/billing: the Stripe webhook has no secret; set ${STRIPE_WEBHOOK_SECRET_ENV}`);
    return answer(500);
  }
  const body = await readSmallBody(request, { maxBytes: STRIPE_WEBHOOK_MAX_BYTES });
  if (!body.ok) return answer(body.error === "security.body_too_large" ? 413 : 400);

  let received;
  try {
    received = await receiveStripeWebhook(await getBillingContext(), {
      payload: body.value,
      signature: request.headers.get(STRIPE_SIGNATURE_HEADER),
      secret,
    });
  } catch (error) {
    console.error(`@softure-ai/billing: a Stripe webhook failed: ${errorLogLabel(error)}`);
    return answer(500);
  }
  if (!received.ok) return answer(400);
  const { outcome } = received.value;
  if (outcome.status === "refused") {
    console.error(`@softure-ai/billing: the paid Stripe checkout ${outcome.checkoutId} granted nothing (${outcome.error}); refund it in the Stripe dashboard`);
  }
  return answer(200);
}
