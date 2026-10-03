// The Stripe adapter with Stripe's API replaced by a recording `fetch`: the Checkout session it asks
// for, the redirect it answers, and every way Stripe can fail turned into `billing.payment_failed`.
import { getCheckoutSessionParams, stripe, type BillingOptionsInput, type PaymentRequest } from "@softure-ai/billing";
import { startPayment } from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createAccount, createConfig, createTestBilling, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly", pl: "Monthly (pl)" }, description: { en: "Billed once" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "EUR" }, period: "lifetime" },
];
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_a1";
const ACCOUNT = { id: "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f", email: "ada@example.com" };

interface Call {
  readonly url: string;
  readonly init: RequestInit;
  /** The form body the adapter sent. */
  readonly body: string;
}

function createFetch(respond: () => Promise<Response> = () => Promise.resolve(Response.json({ id: "cs_test_a1", url: CHECKOUT_URL }))) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn((input: URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), init: init ?? {}, body: init?.body instanceof URLSearchParams ? init.body.toString() : "" });
    return respond();
  });
  return { calls, fetch: fetchImpl as unknown as typeof fetch };
}

function request(planIndex = 0): PaymentRequest {
  const config = createConfig({ plans: PLANS });
  const plans = (config.modules.find((module) => module.manifest.id === "billing")?.options as { plans: PaymentRequest["plan"][] }).plans;
  const plan = plans[planIndex];
  if (plan === undefined) throw new Error("test: no such plan");
  return { plan, account: ACCOUNT, invoice: null, returnUrl: "https://app.example.com/payment" };
}

describe("getCheckoutSessionParams", () => {
  it("asks for a one-time payment of the plan's price, back to the payment page", () => {
    const config = createConfig({ plans: PLANS });
    expect(Object.fromEntries(getCheckoutSessionParams({ config }, request()))).toEqual({
      mode: "payment",
      locale: "en",
      client_reference_id: ACCOUNT.id,
      customer_email: ACCOUNT.email,
      success_url: "https://app.example.com/payment?checkout=success",
      cancel_url: "https://app.example.com/payment?plan=monthly&checkout=cancelled",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "pln",
      "line_items[0][price_data][unit_amount]": "2900",
      "line_items[0][price_data][product_data][name]": "Monthly",
      "line_items[0][price_data][product_data][description]": "Billed once",
      "metadata[softure_user_id]": ACCOUNT.id,
      "metadata[softure_plan_id]": "monthly",
      "payment_intent_data[metadata][softure_user_id]": ACCOUNT.id,
      "payment_intent_data[metadata][softure_plan_id]": "monthly",
    });
  });

  it("names the plan in the app's locale and leaves out a missing description", () => {
    const config = { ...createConfig({ plans: PLANS }), locale: "pl" as const };
    expect(getCheckoutSessionParams({ config }, request()).get("line_items[0][price_data][product_data][name]")).toBe("Monthly (pl)");
    const params = getCheckoutSessionParams({ config }, request(1));
    expect(params.get("locale")).toBe("pl");
    expect(params.get("line_items[0][price_data][product_data][name]")).toBe("Lifetime");
    expect(params.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(params.has("line_items[0][price_data][product_data][description]")).toBe(false);
  });
});

describe("stripe()", () => {
  let log: MockInstance<typeof console.error>;
  const config = createConfig({ plans: PLANS });
  // The adapter never touches the database or the clock.
  const ctx = { config } as Parameters<ReturnType<typeof stripe>["startPayment"]>[0];

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    log.mockRestore();
  });
  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");

  it("is a provider that collects no invoice details", () => {
    expect(stripe()).toMatchObject({ name: "stripe", collectsInvoiceDetails: false });
  });

  it("creates a Checkout session with the secret key and redirects to it", async () => {
    const { calls, fetch } = createFetch();
    expect(await stripe({ secretKey: "sk_test_123", fetch }).startPayment(ctx, request())).toEqual(ok({ type: "redirect", url: CHECKOUT_URL }));
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(call?.init.method).toBe("POST");
    expect(call?.init.headers).toEqual({ Authorization: "Bearer sk_test_123", "Content-Type": "application/x-www-form-urlencoded" });
    expect(call?.body).toBe(getCheckoutSessionParams(ctx, request()).toString());
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("reads STRIPE_SECRET_KEY on every payment and takes another API base", async () => {
    const { calls, fetch } = createFetch();
    const provider = stripe({ apiBase: "http://127.0.0.1:12111", fetch });
    vi.stubEnv("STRIPE_SECRET_KEY", " sk_test_env ");
    await provider.startPayment(ctx, request());
    expect(calls[0]?.url).toBe("http://127.0.0.1:12111/v1/checkout/sessions");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: "Bearer sk_test_env" });
  });

  it("fails without a secret key, calling nothing", async () => {
    const { calls, fetch } = createFetch();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(await stripe({ fetch }).startPayment(ctx, request())).toEqual(err("billing.payment_failed"));
    expect(calls).toHaveLength(0);
    expect(logged()).toContain("set STRIPE_SECRET_KEY");
  });

  it("fails when Stripe refuses, logging the error type and code but not its message", async () => {
    const { fetch } = createFetch(() =>
      Promise.resolve(Response.json({ error: { type: "invalid_request_error", code: "amount_too_small", message: "ada@example.com is echoed" } }, { status: 400 })),
    );
    expect(await stripe({ secretKey: "sk_test_123", fetch }).startPayment(ctx, request())).toEqual(err("billing.payment_failed"));
    expect(logged()).toContain('plan "monthly" (HTTP 400, invalid_request_error/amount_too_small)');
    expect(logged()).not.toContain("ada@example.com");
    expect(logged()).not.toContain("sk_test_123");
  });

  it.each([
    ["an answer without a url", () => Promise.resolve(Response.json({ id: "cs_1" }))],
    ["a url that is not https", () => Promise.resolve(Response.json({ url: "javascript:alert(1)" }))],
    ["a body that is not JSON", () => Promise.resolve(new Response("<html>", { status: 502 }))],
    ["a network failure", () => Promise.reject(new TypeError("fetch failed"))],
    ["a timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
  ])("fails on %s", async (_case, respond) => {
    const { fetch } = createFetch(respond);
    expect(await stripe({ secretKey: "sk_test_123", fetch }).startPayment(ctx, request())).toEqual(err("billing.payment_failed"));
    expect(logged()).toContain('plan "monthly"');
  });
});

describe("startPayment with stripe()", () => {
  let test: TestBilling;

  afterEach(() => test.database.close());

  it("hands the provider no invoice details and the payment page as the return URL", async () => {
    const { calls, fetch } = createFetch();
    test = await createTestBilling({ plans: PLANS, payment: stripe({ secretKey: "sk_test_123", fetch }) });
    const adaId = await createAccount(test, "ada@example.com");
    const result = await startPayment(test.ctx, { account: { id: adaId, email: "ada@example.com" }, planId: "monthly", invoice: { name: "", taxId: "", address: "" } });
    expect(result).toEqual(ok({ type: "redirect", url: CHECKOUT_URL }));
    const body = new URLSearchParams(calls[0]?.body);
    expect(body.get("success_url")).toBe("https://app.example.com/payment?checkout=success");
    expect(body.get("metadata[softure_user_id]")).toBe(adaId);
  });
});
