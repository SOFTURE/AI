// Payments from Stripe's webhook on PGlite: a paid checkout grants its plan once, however often it is
// delivered, a full refund takes back what that one payment granted, once, and nothing unsigned
// reaches the database.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { exportBillingUserData, getEntitlement, grantPlan, receiveStripeWebhook, recordPayment, refundPayment } from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { collectUserData, eraseUserData } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { charge, checkoutSession, signature, stripeEvent, WEBHOOK_SECRET } from "./stripe-fixtures.js";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
/** The end of a 14-day trial begun at NOW, then one month on top. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
/** A second month stacked on the first. */
const TWO_MONTHS_AFTER_TRIAL = new Date("2026-12-16T23:00:00Z");
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

interface GrantRow {
  payment_id: string | null;
  grant_kind: string | null;
  granted_from: Date | null;
  granted_until: Date | null;
}

async function readGrants(test: TestBilling): Promise<GrantRow[]> {
  const result = await test.database.client.query<GrantRow>("SELECT payment_id, grant_kind, granted_from, granted_until FROM billing.payments ORDER BY paid_at, checkout_id");
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

  it("marks the payment refunded and takes its period back, returning the account to its trial", async () => {
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toEqual(
      ok({ status: "refunded", entitlement: { status: "trial", endsAt: TRIAL_END, daysLeft: 12, isEnding: false } }),
    );
    expect((await readPayments(test)).find((row) => row.user_id === adaId)).toMatchObject({ status: "refunded", refunded_at: new Date("2026-10-05T08:00:00Z") });
    expect(await getEntitlement(test.ctx, eveId)).toMatchObject({ status: "paid", endsAt: MONTH_AFTER_TRIAL });
  });

  it("takes back once for a refund delivered twice", async () => {
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

  it("ends running paid access at the start of the refund's day once the trial has ended", async () => {
    test.clock.set(new Date("2026-10-20T08:00:00Z"));
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toEqual(
      ok({ status: "refunded", entitlement: { status: "read_only", since: new Date("2026-10-19T22:00:00Z"), reason: "paid_ended" } }),
    );
  });
});

describe("refunding one payment among several", () => {
  let test: TestBilling;
  let adaId: string;
  const refund = (paymentId: string) => refundPayment(test.ctx, { provider: "stripe", paymentId });

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("stores what each payment granted: a period from where access ended, or lifetime", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_c3", paymentId: "pi_test_c3", planId: "lifetime", amount: 49900 }));
    expect(await readGrants(test)).toEqual([
      { payment_id: "pi_test_a1", grant_kind: "period", granted_from: TRIAL_END, granted_until: MONTH_AFTER_TRIAL },
      { payment_id: "pi_test_b2", grant_kind: "period", granted_from: MONTH_AFTER_TRIAL, granted_until: TWO_MONTHS_AFTER_TRIAL },
      { payment_id: "pi_test_c3", grant_kind: "lifetime", granted_from: null, granted_until: null },
    ]);
  });

  it("refunding the first of two stacked months leaves one month", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    // The first month's 31 days come off; the second month keeps its 30 and ends on 16 November.
    expect(await refund("pi_test_a1")).toEqual(ok({ status: "refunded", entitlement: { status: "paid", endsAt: new Date("2026-11-15T23:00:00Z"), daysLeft: 42, isEnding: false } }));
  });

  it("refunding the second of two stacked months leaves the first", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    expect(await refund("pi_test_b2")).toMatchObject(ok({ status: "refunded", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }));
  });

  it("moves the periods stacked after a refunded month, so a later refund takes back the right days", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_c3", paymentId: "pi_test_c3" }));
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    await refund("pi_test_a1");
    // 31 days off: the second month now covers 17 October to 16 November, the third 16 November to 17 December.
    expect((await readGrants(test)).slice(1)).toEqual([
      { payment_id: "pi_test_b2", grant_kind: "period", granted_from: TRIAL_END, granted_until: new Date("2026-11-15T23:00:00Z") },
      { payment_id: "pi_test_c3", grant_kind: "period", granted_from: new Date("2026-11-15T23:00:00Z"), granted_until: TWO_MONTHS_AFTER_TRIAL },
    ]);
    // The second month is used up by 20 November: refunding it leaves the third month whole.
    test.clock.set(new Date("2026-11-20T08:00:00Z"));
    expect(await refund("pi_test_b2")).toMatchObject(ok({ status: "refunded", entitlement: { status: "paid", endsAt: TWO_MONTHS_AFTER_TRIAL } }));
  });

  it("refunding a month already used up leaves the month after it untouched", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    test.clock.set(new Date("2026-11-20T08:00:00Z"));
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded", entitlement: { status: "paid", endsAt: TWO_MONTHS_AFTER_TRIAL } }));
  });

  it("refunding an old payment after a lapse leaves the new period untouched", async () => {
    await recordPayment(test.ctx, paid(adaId));
    const renewed = new Date("2026-12-01T09:00:00Z");
    test.clock.set(renewed);
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    test.clock.set(new Date("2026-12-02T09:00:00Z"));
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded", entitlement: { status: "paid", endsAt: new Date("2026-12-31T23:00:00Z") } }));
  });

  it("refunding a month keeps a lifetime bought beside it, and refunding the lifetime keeps the month", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_l1", paymentId: "pi_test_l1", planId: "lifetime", amount: 49900 }));
    expect(await refund("pi_test_l1")).toEqual(ok({ status: "refunded", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL, daysLeft: 45, isEnding: false } }));

    const eveId = await createAccount(test, "eve@example.com");
    await recordPayment(test.ctx, paid(eveId, { checkoutId: "cs_test_eve", paymentId: "pi_test_eve" }));
    await recordPayment(test.ctx, paid(eveId, { checkoutId: "cs_test_eve_l", paymentId: "pi_test_eve_l", planId: "lifetime", amount: 49900 }));
    expect(await refund("pi_test_eve")).toEqual(ok({ status: "refunded", entitlement: { status: "paid", endsAt: null, daysLeft: null, isEnding: false } }));
    // The month is gone from the row too: ending the lifetime later leaves the trial.
    expect(await readRow(test, eveId)).toMatchObject({ paid_until: null, is_lifetime: true });
    expect(await refund("pi_test_eve_l")).toMatchObject(ok({ entitlement: { status: "trial", endsAt: TRIAL_END } }));
  });

  it("keeps lifetime access while another lifetime payment still pays for it", async () => {
    await recordPayment(test.ctx, paid(adaId, { planId: "lifetime", amount: 49900 }));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2", planId: "lifetime", amount: 49900 }));
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded", entitlement: { status: "paid", endsAt: null } }));
    expect(await refund("pi_test_b2")).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial" } }));
  });

  it("keeps a period the admin granted by hand", async () => {
    await grantPlan(test.ctx, adaId, "monthly");
    await recordPayment(test.ctx, paid(adaId));
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }));
  });

  it("revokes paid access for a payment stored before grants were recorded", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    await test.database.client.query("UPDATE billing.payments SET grant_kind = NULL, granted_from = NULL, granted_until = NULL WHERE payment_id = 'pi_test_a1'");
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial", endsAt: TRIAL_END } }));
  });

  it("is refused by the database for a grant of the wrong shape", async () => {
    await recordPayment(test.ctx, paid(adaId));
    const update = (sql: string) => test.database.client.query(`UPDATE billing.payments SET ${sql}`);
    await expect(update("granted_from = NULL")).rejects.toThrow(/payments_grant_shape/);
    await expect(update("granted_until = granted_from")).rejects.toThrow(/payments_grant_shape/);
    await expect(update("grant_kind = 'lifetime'")).rejects.toThrow(/payments_grant_shape/);
    await expect(update("grant_kind = NULL")).rejects.toThrow(/payments_grant_shape/);
    await expect(update("grant_kind = 'forever', granted_from = NULL, granted_until = NULL")).rejects.toThrow(/grant_kind_check/);
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

  it("grants a paid checkout once and takes it back on a full refund", async () => {
    const completed = stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }));
    expect(await deliver(completed)).toMatchObject(ok({ eventId: "evt_test_checkout_session_completed", outcome: { status: "granted" } }));
    expect(await deliver(completed)).toEqual(ok({ eventId: "evt_test_checkout_session_completed", outcome: { status: "duplicate" } }));

    expect(await deliver(stripeEvent("charge.refunded", charge("pi_test_a1", false)))).toMatchObject(ok({ outcome: { status: "partially_refunded" } }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid" });
    expect(await deliver(stripeEvent("charge.refunded", charge("pi_test_a1", true)))).toMatchObject(ok({ outcome: { status: "refunded" } }));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });

  it("records an ISK payment and its refunds in billing's unit, not Stripe's", async () => {
    // ISK 1,500: billing's amount 1500 (no minor unit in Intl), Stripe's 150000 (two decimals, always 00).
    test = await createTestBilling({ plans: [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 1500, currency: "ISK" }, period: "month" }] });
    const ada = await createAccount(test, "ada@example.com");
    const iskCharge = { amount: 150000, currency: "isk" };
    await deliver(stripeEvent("checkout.session.completed", checkoutSession({ userId: ada, planId: "monthly", amount: 150000, currency: "isk" })));
    expect(await readPayments(test)).toMatchObject([{ amount: "1500", currency: "ISK", status: "paid" }]);

    expect(await deliver(stripeEvent("charge.refunded", charge("pi_test_a1", false, 50000, iskCharge)))).toMatchObject(ok({ outcome: { status: "partially_refunded" } }));
    const partial = await test.database.client.query<{ refunded_amount: string }>("SELECT refunded_amount::text FROM billing.payments");
    expect(partial.rows).toEqual([{ refunded_amount: "500" }]);

    expect(await deliver(stripeEvent("charge.refunded", charge("pi_test_a1", true, 150000, iskCharge)))).toMatchObject(ok({ outcome: { status: "refunded" } }));
    expect(await readPayments(test)).toMatchObject([{ amount: "1500", status: "refunded" }]);
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
        {
          provider: "stripe",
          checkoutId: "cs_test_a1",
          paymentId: "pi_test_a1",
          planId: "monthly",
          amount: 2900,
          currency: "PLN",
          status: "paid",
          paidAt: NOW,
          refundedAt: null,
          refundedAmount: 0,
          grantKind: "period",
          grantedFrom: TRIAL_END,
          grantedUntil: MONTH_AFTER_TRIAL,
        },
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
          refundedAmount: 49900,
          grantKind: "lifetime",
          grantedFrom: null,
          grantedUntil: null,
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
