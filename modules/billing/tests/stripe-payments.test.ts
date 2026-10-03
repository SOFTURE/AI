// Payments from Stripe's webhook on PGlite: a paid checkout grants its plan once, however often it is
// delivered, a full refund revokes once, and nothing unsigned reaches the database.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { exportBillingUserData, getEntitlement, receiveStripeWebhook, recordPayment, refundPayment } from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { collectUserData, eraseUserData } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { charge, checkoutSession, signature, stripeEvent, WEBHOOK_SECRET } from "./stripe-fixtures.js";
import { createAccount, createTestBilling, NOW, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
/** The end of a 14-day trial begun at NOW, then one month on top. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

interface PaymentRow {
  user_id: string;
  provider: string;
  checkout_id: string;
  payment_id: string | null;
  plan_id: string;
  amount: string;
  currency: string;
  status: string;
  paid_at: Date;
  refunded_at: Date | null;
}

async function readPayments(test: TestBilling): Promise<PaymentRow[]> {
  const result = await test.database.client.query<PaymentRow>(
    "SELECT user_id, provider, checkout_id, payment_id, plan_id, amount::text, currency, status, paid_at, refunded_at FROM billing.payments ORDER BY paid_at, checkout_id",
  );
  return result.rows;
}

function paid(userId: string, overrides: Partial<Parameters<typeof recordPayment>[1]> = {}): Parameters<typeof recordPayment>[1] {
  return { provider: "stripe", checkoutId: "cs_test_a1", paymentId: "pi_test_a1", userId, planId: "monthly", amount: 2900, currency: "PLN", ...overrides };
}

describe("recordPayment", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("stores the payment and grants its plan from the end of the trial", async () => {
    expect(await recordPayment(test.ctx, paid(adaId))).toEqual(
      ok({ status: "granted", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL, daysLeft: 45, isEnding: false } }),
    );
    expect(await readPayments(test)).toEqual([
      { user_id: adaId, provider: "stripe", checkout_id: "cs_test_a1", payment_id: "pi_test_a1", plan_id: "monthly", amount: "2900", currency: "PLN", status: "paid", paid_at: NOW, refunded_at: null },
    ]);
  });

  it("grants once for a checkout delivered twice", async () => {
    await recordPayment(test.ctx, paid(adaId));
    expect(await recordPayment(test.ctx, paid(adaId))).toEqual(ok({ status: "duplicate" }));
    // The same PaymentIntent under another checkout id is the same payment too.
    expect(await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_other" }))).toEqual(ok({ status: "duplicate" }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: MONTH_AFTER_TRIAL });
    expect(await readPayments(test)).toHaveLength(1);
  });

  it("adds a period for each distinct checkout", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: new Date("2026-12-16T23:00:00Z") });
  });

  it("records free checkouts without a payment id, each once", async () => {
    await recordPayment(test.ctx, paid(adaId, { paymentId: null, amount: 0, planId: "lifetime" }));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: null, amount: 0 }));
    expect(await readPayments(test)).toHaveLength(2);
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "paid", endsAt: null, daysLeft: null, isEnding: false });
  });

  it("stores nothing for a plan the config no longer has or an account that is gone", async () => {
    expect(await recordPayment(test.ctx, paid(adaId, { planId: "weekly" }))).toEqual(err("billing.plan_unknown"));
    expect(await recordPayment(test.ctx, paid(UNKNOWN_ID))).toEqual(err("billing.account_unknown"));
    expect(await recordPayment(test.ctx, paid("not-a-uuid"))).toEqual(err("billing.account_unknown"));
    expect(await readPayments(test)).toEqual([]);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial", endsAt: TRIAL_END });
  });

  it("is refused by the database when it breaks a constraint", async () => {
    await expect(recordPayment(test.ctx, paid(adaId, { currency: "pln" }))).rejects.toThrow();
    await expect(recordPayment(test.ctx, paid(adaId, { amount: -1 }))).rejects.toThrow();
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });
});

describe("refundPayment", () => {
  let test: TestBilling;
  let adaId: string;
  let eveId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    eveId = await createAccount(test, "eve@example.com");
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(eveId, { checkoutId: "cs_test_eve", paymentId: "pi_test_eve" }));
  });
  afterEach(() => test.database.close());

  it("marks the payment refunded and revokes the account's paid access, back to its trial", async () => {
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toEqual(
      ok({ status: "revoked", entitlement: { status: "trial", endsAt: TRIAL_END, daysLeft: 12, isEnding: false } }),
    );
    expect((await readPayments(test)).find((row) => row.user_id === adaId)).toMatchObject({ status: "refunded", refunded_at: new Date("2026-10-05T08:00:00Z") });
    expect(await getEntitlement(test.ctx, eveId)).toMatchObject({ status: "paid", endsAt: MONTH_AFTER_TRIAL });
  });

  it("revokes once for a refund delivered twice", async () => {
    await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" });
    // A later payment is not taken back by a repeated refund of the earlier one.
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toEqual(ok({ status: "duplicate" }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: MONTH_AFTER_TRIAL });
  });

  it("changes nothing for a payment billing never recorded, or another provider's", async () => {
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_unknown" })).toEqual(ok({ status: "unknown_payment" }));
    expect(await refundPayment(test.ctx, { provider: "manual", paymentId: "pi_test_a1" })).toEqual(ok({ status: "unknown_payment" }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid" });
  });

  it("leaves a read-only account read-only once its trial has ended", async () => {
    test.clock.set(new Date("2026-10-20T08:00:00Z"));
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toMatchObject(
      ok({ status: "revoked", entitlement: { status: "read_only", reason: "trial_ended" } }),
    );
  });
});

describe("receiveStripeWebhook", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  const deliver = (payload: string, header: string | null = signature(payload)) => receiveStripeWebhook(test.ctx, { payload, signature: header, secret: WEBHOOK_SECRET });

  it("grants a paid checkout once and revokes it on a full refund", async () => {
    const completed = stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }));
    expect(await deliver(completed)).toMatchObject(ok({ eventId: "evt_test_checkout_session_completed", outcome: { status: "granted" } }));
    expect(await deliver(completed)).toEqual(ok({ eventId: "evt_test_checkout_session_completed", outcome: { status: "duplicate" } }));

    expect(await deliver(stripeEvent("charge.refunded", charge("pi_test_a1", false)))).toMatchObject(ok({ outcome: { status: "ignored", reason: "a partial refund" } }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid" });
    expect(await deliver(stripeEvent("charge.refunded", charge("pi_test_a1", true)))).toMatchObject(ok({ outcome: { status: "revoked" } }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });

  it("grants a delayed payment when it succeeds, not when the checkout completes", async () => {
    const session = checkoutSession({ userId: adaId, planId: "monthly", paymentStatus: "unpaid" });
    expect(await deliver(stripeEvent("checkout.session.completed", session))).toMatchObject(ok({ outcome: { status: "ignored" } }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
    const succeeded = stripeEvent("checkout.session.async_payment_succeeded", { ...session, payment_status: "paid" });
    expect(await deliver(succeeded)).toMatchObject(ok({ outcome: { status: "granted" } }));
  });

  it("reports a paid checkout whose account is gone, storing nothing", async () => {
    const orphan = stripeEvent("checkout.session.completed", checkoutSession({ id: "cs_test_orphan", userId: UNKNOWN_ID, planId: "monthly" }));
    expect(await deliver(orphan)).toMatchObject(ok({ outcome: { status: "refused", error: "billing.account_unknown", checkoutId: "cs_test_orphan" } }));
    expect(await readPayments(test)).toEqual([]);
  });

  it("refuses an unsigned or replayed delivery before touching the database", async () => {
    const completed = stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }));
    expect(await deliver(completed, null)).toEqual(err("billing.webhook_invalid"));
    expect(await deliver(completed, signature(completed, { secret: "whsec_forged" }))).toEqual(err("billing.webhook_invalid"));
    test.clock.set(new Date(NOW.getTime() + 301_000));
    expect(await deliver(completed)).toEqual(err("billing.webhook_invalid"));
    expect(await readPayments(test)).toEqual([]);
  });
});

describe("payments in the privacy export and erase", () => {
  it("exports the account's payments, oldest first, and erases them with the account's data", async () => {
    const test = await createTestBilling({ plans: PLANS });
    try {
      const adaId = await createAccount(test, "ada@example.com");
      const eveId = await createAccount(test, "eve@example.com");
      await recordPayment(test.ctx, paid(adaId));
      test.clock.set(new Date("2026-10-04T08:00:00Z"));
      await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2", planId: "lifetime", amount: 49900 }));
      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_b2" });
      await recordPayment(test.ctx, paid(eveId, { checkoutId: "cs_test_eve", paymentId: "pi_test_eve" }));

      const exported = await exportBillingUserData(test.ctx, adaId);
      expect(exported.ok && exported.value.payments).toEqual([
        { provider: "stripe", checkoutId: "cs_test_a1", paymentId: "pi_test_a1", planId: "monthly", amount: 2900, currency: "PLN", status: "paid", paidAt: NOW, refundedAt: null },
        {
          provider: "stripe",
          checkoutId: "cs_test_b2",
          paymentId: "pi_test_b2",
          planId: "lifetime",
          amount: 49900,
          currency: "PLN",
          status: "refunded",
          paidAt: new Date("2026-10-04T08:00:00Z"),
          refundedAt: new Date("2026-10-04T08:00:00Z"),
        },
      ]);
      const collected = await collectUserData(test.ctx, adaId);
      expect(collected.ok && collected.value.json).toContain('"checkoutId": "cs_test_a1"');

      expect(await eraseUserData(test.ctx, adaId)).toEqual(ok());
      expect((await readPayments(test)).map((row) => row.user_id)).toEqual([eveId]);
    } finally {
      await test.database.close();
    }
  });
});
