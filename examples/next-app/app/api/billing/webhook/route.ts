// The billing package's Stripe webhook: a Stripe webhook endpoint points here for
// checkout.session.completed, checkout.session.async_payment_succeeded and charge.refunded.
// Public on purpose (proxy.ts protects only /account): Stripe posts without a session; the
// signature (STRIPE_WEBHOOK_SECRET) is the proof.
export { stripeWebhookRoute as POST } from "@softure-ai/billing/next";
