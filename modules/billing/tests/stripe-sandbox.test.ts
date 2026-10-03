// The Stripe adapter against Stripe's sandbox: only with a test-mode key in STRIPE_SECRET_KEY (a
// repository secret in CI), skipped otherwise. It creates a real Checkout session, reads it back to
// check what Stripe stored, and expires it. Webhook deliveries cannot reach a test run, so they are
// covered by signed fixtures (stripe-payments.test.ts, e2e/billing-stripe.spec.ts).
import { stripe, STRIPE_API_BASE, type BillingOptionsInput, type PaymentRequest } from "@softure-ai/billing";
import { afterAll, describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

const SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
/** Never a live key: this test creates objects in the account it is given. */
const HAS_SANDBOX_KEY = SECRET_KEY.startsWith("sk_test_") || SECRET_KEY.startsWith("rk_test_");

if (!HAS_SANDBOX_KEY) {
  console.info("billing: Stripe sandbox tests skipped; set STRIPE_SECRET_KEY to a test-mode key (sk_test_...) to run them");
}

const PLANS: BillingOptionsInput["plans"] = [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }];
const ACCOUNT = { id: "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f", email: "sandbox@example.com" };

async function callStripe(path: string, method: "GET" | "POST" = "GET"): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(path, STRIPE_API_BASE), { method, headers: { Authorization: `Bearer ${SECRET_KEY}` } });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Stripe ${method} ${path} answered ${String(response.status)}`);
  return body;
}

describe.skipIf(!HAS_SANDBOX_KEY)("stripe() in Stripe's sandbox", () => {
  const created: string[] = [];

  afterAll(async () => {
    // An open session would stay payable for a day; nobody should find it.
    for (const id of created) await callStripe(`/v1/checkout/sessions/${id}/expire`, "POST");
  });

  it("creates a Checkout session Stripe hosts, with the plan's price and the account in its metadata", async () => {
    const config = createConfig({ plans: PLANS });
    const plan = (config.modules.find((module) => module.manifest.id === "billing")?.options as { plans: PaymentRequest["plan"][] }).plans[0];
    if (plan === undefined) throw new Error("test: no plan");
    const started = await stripe().startPayment({ config } as Parameters<ReturnType<typeof stripe>["startPayment"]>[0], {
      plan,
      account: ACCOUNT,
      invoice: null,
      returnUrl: "https://app.example.com/payment",
    });
    expect(started.ok).toBe(true);
    if (!started.ok || started.value.type !== "redirect") return;
    expect(new URL(started.value.url).hostname).toBe("checkout.stripe.com");

    // The hosted page's path names the session: /c/pay/cs_test_...
    const sessionId = /\/(cs_test_[A-Za-z0-9]+)/.exec(new URL(started.value.url).pathname)?.[1];
    expect(sessionId).toBeDefined();
    if (sessionId === undefined) return;
    created.push(sessionId);
    expect(await callStripe(`/v1/checkout/sessions/${sessionId}`)).toMatchObject({
      mode: "payment",
      status: "open",
      payment_status: "unpaid",
      amount_total: 2900,
      currency: "pln",
      client_reference_id: ACCOUNT.id,
      metadata: { softure_user_id: ACCOUNT.id, softure_plan_id: "monthly" },
      success_url: "https://app.example.com/payment?checkout=success",
    });
  });
});
