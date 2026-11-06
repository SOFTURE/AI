// Where the e2e's fake Stripe (fake-stripe-server.mjs) and the app that pays through it listen, and the key the app
// sends it. playwright.config.ts starts both; billing-checkout.fake-stripe.spec.ts pays through them.

/** The fake Stripe's port. */
export const FAKE_STRIPE_PORT = 3190;
/** The fake Stripe's origin: the app's STRIPE_API_BASE and the host of its checkout page. */
export const FAKE_STRIPE_ORIGIN = `http://localhost:${String(FAKE_STRIPE_PORT)}`;
/** The port of the second app server, the one with BILLING_PROVIDER=stripe. */
export const STRIPE_APP_PORT = 3101;
/** A test-mode key shape the fake Stripe accepts; no Stripe account has it. */
export const FAKE_STRIPE_SECRET_KEY = "sk_test_fake_e2e_not_a_real_key";
