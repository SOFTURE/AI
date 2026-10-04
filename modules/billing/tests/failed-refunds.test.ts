// Failed refunds on PGlite: a refund that fails after billing acted on it gives back what it took
// (the refunded total, the paid status, a lifetime, the failed money's share of the taken days),
// once per refund, and a failure of a refund billing never counted, or a charge snapshot taken
// before a failure, changes nothing.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { exportBillingUserData, failRefund, receiveStripeWebhook, recordPayment, refundPayment, type FailRefundInput } from "@softure-ai/billing/server";
import { eraseUserData } from "@softure-ai/privacy/server";
import { ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { charge, checkoutSession, refund as refundObject, signature, stripeEvent, WEBHOOK_SECRET } from "./stripe-fixtures.js";
import { createAccount, createTestBilling, NOW, readRow, type BillingInput, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
const DAY = 86_400_000;
/** 4 October, a day after the refunds: when the bank refuses one. */
const FAILED_AT = new Date(NOW.getTime() + DAY);
/** Midnight starting 17 October in Warsaw: the end of the 14-day trial begun at NOW. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Midnight starting 17 November in Warsaw (CET): one month after the trial. */
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
/** Midnight starting 2 November in Warsaw: 15 of the month's 31 days taken back. */
const HALF_MONTH_LEFT = new Date("2026-11-01T23:00:00Z");
/** Midnight starting 17 December in Warsaw: a second month stacked on the first. */
const TWO_MONTHS_AFTER_TRIAL = new Date("2026-12-16T23:00:00Z");

interface PaymentState {
  status: string;
  refunded_amount: string;
  refunded_at: Date | null;
  granted_from: Date | null;
  granted_until: Date | null;
  taken_back_days: number;
}

async function readPayment(test: TestBilling, paymentId: string): Promise<PaymentState | undefined> {
  const result = await test.database.client.query<PaymentState>(
    "SELECT status, refunded_amount::text, refunded_at, granted_from, granted_until, taken_back_days FROM billing.payments WHERE payment_id = $1",
    [paymentId],
  );
  return result.rows[0];
}

function paid(userId: string, overrides: Partial<Parameters<typeof recordPayment>[1]> = {}): Parameters<typeof recordPayment>[1] {
  return { provider: "stripe", checkoutId: "cs_test_a1", paymentId: "pi_test_a1", userId, planId: "monthly", amount: 2900, currency: "PLN", ...overrides };
}

/** A failure of `re_test_a1` (900 of `pi_test_a1`, created at NOW) reported at FAILED_AT. */
function failure(overrides: Partial<FailRefundInput> = {}): FailRefundInput {
  return { provider: "stripe", paymentId: "pi_test_a1", refundId: "re_test_a1", amount: 900, refundCreatedAt: NOW, failedAt: FAILED_AT, ...overrides };
}

describe("a failed refund of a month", () => {
  let test: TestBilling;
  let adaId: string;
  const refund = (amountRefunded?: number, observedAt?: Date) => refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1", amountRefunded, observedAt });
  const fail = async (overrides: Partial<FailRefundInput> = {}) => {
    test.clock.set(overrides.failedAt ?? FAILED_AT);
    return failRefund(test.ctx, failure(overrides));
  };

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    await recordPayment(test.ctx, paid(adaId));
  });
  afterEach(() => test.database.close());

  it("gives back what a full refund took, and the payment is paid again", async () => {
    await refund();
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "refunded", taken_back_days: 31 });

    expect(await fail({ amount: 2900 })).toMatchObject(ok({ status: "refund_failed", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
    expect(await readPayment(test, "pi_test_a1")).toEqual({
      status: "paid",
      refunded_amount: "0",
      refunded_at: null,
      granted_from: TRIAL_END,
      granted_until: MONTH_AFTER_TRIAL,
      taken_back_days: 0,
    });
  });

  it("puts a partial refund's days back right after the payment's period", async () => {
    await refund(1450);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ granted_until: HALF_MONTH_LEFT, taken_back_days: 15 });

    expect(await fail({ amount: 1450 })).toMatchObject(ok({ status: "refund_failed", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }));
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "0", granted_until: MONTH_AFTER_TRIAL, taken_back_days: 0 });
  });

  it("gives back the failed refund's share of the days when another refund stands", async () => {
    // 1000 of 2900 takes 10 of 31 days; 900 of the 1900 left takes 9 of the 21 left.
    await refund(1000);
    await refund(1900);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ refunded_amount: "1900", taken_back_days: 19 });

    // The 900 fails: 900 of the 1900 refunded is 9 of the 19 days.
    await fail({ refundId: "re_test_b2", amount: 900 });
    const tenDaysEarly = new Date("2026-11-06T23:00:00Z");
    expect((await readRow(test, adaId))?.paid_until).toEqual(tenDaysEarly);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "1000", granted_until: tenDaysEarly, taken_back_days: 10 });
  });

  it("gives back nothing twice for the same refund", async () => {
    await refund();
    await fail({ amount: 2900 });
    expect(await fail({ amount: 2900, failedAt: new Date(FAILED_AT.getTime() + 60_000) })).toEqual(ok({ status: "duplicate" }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "0" });
  });

  it("gives back nothing for a refund billing never counted, and corrects the snapshot that counts it", async () => {
    const before = await readPayment(test, "pi_test_a1");
    expect(await fail({ refundCreatedAt: new Date(NOW.getTime() - 60_000) })).toMatchObject(
      ok({ status: "refund_failed", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }),
    );
    expect(await readPayment(test, "pi_test_a1")).toEqual(before);

    // The charge's state from before the failure, delivered late, still counts the refund.
    expect(await refund(900, NOW)).toEqual(ok({ status: "duplicate" }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
  });

  it("gives back nothing for a refund created after the newest snapshot billing recorded", async () => {
    await refund(1450);
    await fail({ refundId: "re_test_b2", refundCreatedAt: new Date(NOW.getTime() + 3_600_000) });
    expect((await readRow(test, adaId))?.paid_until).toEqual(HALF_MONTH_LEFT);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ refunded_amount: "1450", taken_back_days: 15 });
  });

  it("ignores a snapshot from before the failure, and acts on a new refund after it", async () => {
    await refund(1450);
    await fail({ amount: 1450 });
    expect(await refund(1450, NOW)).toEqual(ok({ status: "duplicate" }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);

    // Two days on, Stripe reports a new refund of 900: the failed one no longer counts.
    const later = new Date(NOW.getTime() + 2 * DAY);
    test.clock.set(later);
    expect(await refund(900, later)).toMatchObject(ok({ status: "partially_refunded" }));
    // 900 of 2900 is 9 of 31 unused days.
    expect((await readRow(test, adaId))?.paid_until).toEqual(new Date("2026-11-07T23:00:00Z"));
  });

  it("gives the days back at the end when another payment stacked after the refund", async () => {
    await refund();
    test.clock.set(FAILED_AT);
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);

    await fail({ amount: 2900, failedAt: new Date(FAILED_AT.getTime() + DAY) });
    const monthAfterThat = new Date("2026-12-17T23:00:00Z");
    expect((await readRow(test, adaId))?.paid_until).toEqual(monthAfterThat);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", granted_from: MONTH_AFTER_TRIAL, granted_until: monthAfterThat });
    expect(await readPayment(test, "pi_test_b2")).toMatchObject({ granted_from: TRIAL_END, granted_until: MONTH_AFTER_TRIAL });
  });

  it("moves the payment stacked after a partially refunded one forward again", async () => {
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    await refund(1450);
    expect(await readPayment(test, "pi_test_b2")).toMatchObject({ granted_from: HALF_MONTH_LEFT });

    await fail({ amount: 1450 });
    expect((await readRow(test, adaId))?.paid_until).toEqual(TWO_MONTHS_AFTER_TRIAL);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ granted_from: TRIAL_END, granted_until: MONTH_AFTER_TRIAL });
    expect(await readPayment(test, "pi_test_b2")).toMatchObject({ granted_from: MONTH_AFTER_TRIAL, granted_until: TWO_MONTHS_AFTER_TRIAL });
  });

  it("gives back the status and the total but no access for a payment stored before grants were", async () => {
    await test.database.client.query("UPDATE billing.payments SET grant_kind = NULL, granted_from = NULL, granted_until = NULL WHERE payment_id = 'pi_test_a1'");
    await refund();
    expect(await fail({ amount: 2900 })).toMatchObject(ok({ status: "refund_failed", entitlement: { status: "trial" } }));
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "0", refunded_at: null });
  });

  it("knows no failure of a payment billing never recorded", async () => {
    expect(await fail({ paymentId: "pi_test_unknown" })).toEqual(ok({ status: "unknown_payment" }));
  });

  it("exports the account's failed refunds, and erases them with the account", async () => {
    await refund();
    await fail({ amount: 2900 });
    const exported = await exportBillingUserData(test.ctx, adaId);
    expect(exported.ok && exported.value.refundFailures).toEqual([
      { paymentId: "pi_test_a1", refundId: "re_test_a1", amount: 2900, refundCreatedAt: NOW, failedAt: FAILED_AT },
    ]);
    expect(await eraseUserData(test.ctx, adaId)).toEqual(ok(undefined));
    expect((await test.database.client.query("SELECT 1 FROM billing.refund_failures")).rows).toEqual([]);
  });

  it("stores one failure per refund, removed with its payment", async () => {
    await refund();
    await fail({ amount: 2900 });
    const insert = () =>
      test.database.client.query(
        "INSERT INTO billing.refund_failures (payment_id, refund_id, amount, refund_created_at, failed_at, recorded_at) SELECT id, 're_test_a1', 1, now(), now(), now() FROM billing.payments WHERE payment_id = 'pi_test_a1'",
      );
    await expect(insert()).rejects.toThrow(/refund_failures_pkey/);
    await test.database.client.query("DELETE FROM billing.payments WHERE payment_id = 'pi_test_a1'");
    expect((await test.database.client.query("SELECT 1 FROM billing.refund_failures")).rows).toEqual([]);
  });
});

describe("a failed refund of a lifetime", () => {
  it("gives lifetime access back", async () => {
    const test = await createTestBilling({ plans: PLANS });
    try {
      const adaId = await createAccount(test, "ada@example.com");
      await recordPayment(test.ctx, paid(adaId, { planId: "lifetime", amount: 49900 }));
      expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toMatchObject(ok({ entitlement: { status: "trial" } }));
      test.clock.set(FAILED_AT);
      expect(await failRefund(test.ctx, failure({ amount: 49900 }))).toMatchObject(ok({ status: "refund_failed", entitlement: { status: "paid", endsAt: null } }));
      expect((await readRow(test, adaId))?.is_lifetime).toBe(true);
      expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "0" });
    } finally {
      await test.database.close();
    }
  });
});

describe("a failed refund under keep_access", () => {
  it("gives back every day the completing refund took", async () => {
    const options: BillingInput = { plans: PLANS, partialRefunds: "keep_access" };
    const test = await createTestBilling(options);
    try {
      const adaId = await createAccount(test, "ada@example.com");
      await recordPayment(test.ctx, paid(adaId));
      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1", amountRefunded: 2000 });
      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" });
      expect((await readRow(test, adaId))?.paid_until).toBeNull();

      test.clock.set(FAILED_AT);
      await failRefund(test.ctx, failure({ refundId: "re_test_b2", amount: 900 }));
      expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
      expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "2000", taken_back_days: 0 });
    } finally {
      await test.database.close();
    }
  });
});

describe("failed refunds through the Stripe webhook", () => {
  it("follow signed deliveries, once per refund, and ignore the charge's older state", async () => {
    const test = await createTestBilling({ plans: PLANS });
    try {
      const adaId = await createAccount(test, "ada@example.com");
      const deliver = (payload: string) => receiveStripeWebhook(test.ctx, { payload, signature: signature(payload, { now: test.clock.now() }), secret: WEBHOOK_SECRET });

      await deliver(stripeEvent("checkout.session.completed", checkoutSession({ userId: adaId, planId: "monthly" }), "evt_test_paid"));
      const refunded = stripeEvent("charge.refunded", charge("pi_test_a1", true), "evt_test_refunded");
      expect(await deliver(refunded)).toMatchObject(ok({ outcome: { status: "refunded", entitlement: { status: "trial" } } }));

      test.clock.set(FAILED_AT);
      const failed = stripeEvent("refund.failed", refundObject({ amount: 2900 }), "evt_test_failed", FAILED_AT);
      expect(await deliver(failed)).toMatchObject(ok({ eventId: "evt_test_failed", outcome: { status: "refund_failed", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } } }));
      const updated = stripeEvent("charge.refund.updated", refundObject({ amount: 2900 }), "evt_test_updated", FAILED_AT);
      expect(await deliver(updated)).toMatchObject(ok({ outcome: { status: "duplicate" } }));
      // Stripe retries the refund's own event after the failure: it still counts the failed refund.
      expect(await deliver(refunded)).toMatchObject(ok({ outcome: { status: "duplicate" } }));
      expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
    } finally {
      await test.database.close();
    }
  });
});
