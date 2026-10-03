// The Stripe webhook route with Next's request scope replaced: the config and the database come
// from the test. It answers what Stripe needs to stop or keep retrying.
import type { BillingOptionsInput } from "@softure-ai/billing";
import { stripeWebhookRoute } from "@softure-ai/billing/next";
import { getEntitlement, type BillingContext } from "@softure-ai/billing/server";
import type { SoftureConfig } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { charge, checkoutSession, signature, stripeEvent, WEBHOOK_SECRET } from "./stripe-fixtures.js";
import { createAccount, createTestBilling, type TestBilling } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: BillingContext | undefined;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("../src/next/context.ts", () => ({
  getBillingContext: () => (scope.context === undefined ? Promise.reject(new Error("test: the database is down")) : Promise.resolve(scope.context)),
}));

const PLANS: BillingOptionsInput["plans"] = [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }];
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("stripeWebhookRoute", () => {
  let test: TestBilling;
  let adaId: string;
  let log: MockInstance<typeof console.error>;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    scope.config = test.config;
    scope.context = test.ctx;
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await test.database.close();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");
  const post = (payload: string, header: string | null = signature(payload)) =>
    stripeWebhookRoute(
      new Request("https://app.example.com/api/billing/webhook", {
        method: "POST",
        body: payload,
        headers: header === null ? {} : { "stripe-signature": header },
      }),
    );

  it("grants a paid checkout and answers 200, also for the repeated delivery", async () => {
    const completed = stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }));
    const first = await post(completed);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect((await post(completed)).status).toBe(200);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: new Date("2026-11-16T23:00:00Z") });
  });

  it("takes the refunded period back on a full refund and answers 200 for events it ignores", async () => {
    await post(stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" })));
    expect((await post(stripeEvent("customer.created", { id: "cus_1" }))).status).toBe(200);
    expect((await post(stripeEvent("charge.refunded", charge("pi_test_a1", true)))).status).toBe(200);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });

  it.each([
    ["no signature", (payload: string) => post(payload, null)],
    ["a forged signature", (payload: string) => post(payload, signature(payload, { secret: "whsec_forged" }))],
    ["a signed body that is not an event", () => post("[]")],
  ])("answers 400 for %s and grants nothing", async (_case, send) => {
    const response = await send(stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" })));
    expect(response.status).toBe(400);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });

  it("answers 413 for a body over 256 KiB without reading it all", async () => {
    expect((await post("x".repeat(256 * 1024 + 1))).status).toBe(413);
  });

  it("answers 200 for a paid checkout whose account is gone, and logs the checkout to refund", async () => {
    const orphan = stripeEvent("checkout.session.completed", checkoutSession({ id: "cs_test_orphan", userId: UNKNOWN_ID, planId: "monthly" }));
    expect((await post(orphan)).status).toBe(200);
    expect(logged()).toContain("cs_test_orphan granted nothing (billing.account_unknown)");
  });

  it("answers 500 without a secret, so Stripe retries once it is set", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", " ");
    const completed = stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }));
    expect((await post(completed)).status).toBe(500);
    expect(logged()).toContain("set STRIPE_WEBHOOK_SECRET");
  });

  it("answers 500 when the database fails, logging no payload", async () => {
    scope.context = undefined;
    const completed = stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }));
    expect((await post(completed)).status).toBe(500);
    expect(logged()).toContain("a Stripe webhook failed");
    expect(logged()).not.toContain(adaId);
  });
});
