// Partial refunds on PGlite: each one takes back its share of the payment's unused days (or nothing
// under `keep_access`), partial refunds that add up to the payment end where one full refund does,
// a lifetime ends only when refunded in full, and a repeated or stale delivery changes nothing.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { getEntitlement, receiveStripeWebhook, recordPayment, refundPayment } from "@softure-ai/billing/server";
import { ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { charge, signature, stripeEvent, WEBHOOK_SECRET } from "./stripe-fixtures.js";
import { createAccount, createTestBilling, readRow, type BillingInput, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
/** Midnight starting 17 October in Warsaw: the end of the 14-day trial begun at NOW (3 October). */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Midnight starting 17 November in Warsaw (CET): one month after the trial. */
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
/** Midnight starting 2 November in Warsaw: 15 of the month's 31 days taken back. */
const HALF_MONTH_LEFT = new Date("2026-11-01T23:00:00Z");

interface PaymentState {
  status: string;
  refunded_amount: string;
  refunded_at: Date | null;
  granted_from: Date | null;
  granted_until: Date | null;
}

async function readPayment(test: TestBilling, paymentId: string): Promise<PaymentState | undefined> {
  const result = await test.database.client.query<PaymentState>(
    "SELECT status, refunded_amount::text, refunded_at, granted_from, granted_until FROM billing.payments WHERE payment_id = $1",
    [paymentId],
  );
  return result.rows[0];
}

function paid(userId: string, overrides: Partial<Parameters<typeof recordPayment>[1]> = {}): Parameters<typeof recordPayment>[1] {
  return { provider: "stripe", checkoutId: "cs_test_a1", paymentId: "pi_test_a1", userId, planId: "monthly", amount: 2900, currency: "PLN", ...overrides };
}

describe("a partial refund under the default pro_rata policy", () => {
  let test: TestBilling;
  let adaId: string;
  const refund = (paymentId: string, amountRefunded?: number) => refundPayment(test.ctx, { provider: "stripe", paymentId, amountRefunded });

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    await recordPayment(test.ctx, paid(adaId));
  });
  afterEach(() => test.database.close());

  it("takes back the refunded share of the unused days and keeps the payment paid", async () => {
    // Half of 2900 is half of the 31 unused days, rounded down: 15.
    expect(await refund("pi_test_a1", 1450)).toMatchObject(ok({ status: "partially_refunded", entitlement: { status: "paid", endsAt: HALF_MONTH_LEFT } }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(HALF_MONTH_LEFT);
    expect(await readPayment(test, "pi_test_a1")).toEqual({
      status: "paid",
      refunded_amount: "1450",
      refunded_at: null,
      granted_from: TRIAL_END,
      granted_until: HALF_MONTH_LEFT,
    });
  });

  it("ends where one full refund does once the halves add up, with the payment refunded", async () => {
    await refund("pi_test_a1", 1450);
    expect(await refund("pi_test_a1", 2900)).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial", endsAt: TRIAL_END } }));
    // Paid access that would end inside the trial is gone: the account is back on its trial.
    expect((await readRow(test, adaId))?.paid_until).toBeNull();
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "refunded", refunded_amount: "2900", refunded_at: test.clock.now() });
  });

  it("treats a full refund after a partial one as the rest of the payment", async () => {
    await refund("pi_test_a1", 1450);
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial" } }));
    expect((await readRow(test, adaId))?.paid_until).toBeNull();
  });

  it("treats a total above the payment's amount as a full refund", async () => {
    expect(await refund("pi_test_a1", 5000)).toMatchObject(ok({ status: "refunded" }));
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "refunded", refunded_amount: "2900" });
  });

  it("changes nothing for the same total delivered again, or a smaller one delivered late", async () => {
    await refund("pi_test_a1", 1450);
    expect(await refund("pi_test_a1", 1450)).toEqual(ok({ status: "duplicate" }));
    expect(await refund("pi_test_a1", 900)).toEqual(ok({ status: "duplicate" }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(HALF_MONTH_LEFT);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ refunded_amount: "1450", granted_until: HALF_MONTH_LEFT });
  });

  it("changes nothing for a partial refund of a payment already refunded in full", async () => {
    await refund("pi_test_a1");
    expect(await refund("pi_test_a1", 1450)).toEqual(ok({ status: "duplicate" }));
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "refunded", refunded_amount: "2900" });
  });

  it("records a share too small for a day without taking any", async () => {
    expect(await refund("pi_test_a1", 50)).toMatchObject(ok({ status: "partially_refunded" }));
    expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ refunded_amount: "50", granted_until: MONTH_AFTER_TRIAL });
  });

  it("refuses a refunded amount above the payment's, and a refunded payment with less, in the database", async () => {
    const update = (set: string) => test.database.client.query(`UPDATE billing.payments SET ${set} WHERE payment_id = 'pi_test_a1'`);
    await expect(update("refunded_amount = 2901")).rejects.toThrow(/payments_refunded_amount_by_status/);
    await expect(update("refunded_amount = 2900")).rejects.toThrow(/payments_refunded_amount_by_status/);
    await expect(update("refunded_amount = -1")).rejects.toThrow(/payments_refunded_amount_by_status/);
    await expect(update("status = 'refunded', refunded_at = paid_at, refunded_amount = 100")).rejects.toThrow(/payments_refunded_amount_by_status/);
  });
});

describe("partial refunds over time", () => {
  it("add up to what one full refund at the time of the last one takes back, across the DST change", async () => {
    const test = await createTestBilling({ plans: PLANS });
    try {
      const adaId = await createAccount(test, "ada@example.com");
      const eveId = await createAccount(test, "eve@example.com");
      await recordPayment(test.ctx, paid(adaId));
      await recordPayment(test.ctx, paid(eveId, { checkoutId: "cs_test_eve", paymentId: "pi_test_eve" }));
      const refund = (paymentId: string, amountRefunded?: number) => refundPayment(test.ctx, { provider: "stripe", paymentId, amountRefunded });

      // 900 of 2900: 9 of 31 days (9.6 rounded down); the month now ends on 8 November.
      await refund("pi_test_a1", 900);
      expect((await readRow(test, adaId))?.paid_until).toEqual(new Date("2026-11-07T23:00:00Z"));
      // 25 October (the DST change): 1000 more of the 2000 left is half of the 14 unused days.
      test.clock.set(new Date("2026-10-25T08:00:00Z"));
      await refund("pi_test_a1", 1900);
      expect((await readRow(test, adaId))?.paid_until).toEqual(new Date("2026-10-31T23:00:00Z"));
      // 28 October: the rest takes the 4 days left.
      test.clock.set(new Date("2026-10-28T09:00:00Z"));
      expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded" }));
      expect(await refund("pi_test_eve")).toMatchObject(ok({ status: "refunded" }));

      const accessEnd = new Date("2026-10-27T23:00:00Z");
      expect((await readRow(test, adaId))?.paid_until).toEqual(accessEnd);
      expect((await readRow(test, eveId))?.paid_until).toEqual(accessEnd);
      expect(await getEntitlement(test.ctx, adaId)).toEqual(await getEntitlement(test.ctx, eveId));
    } finally {
      await test.database.close();
    }
  });
});

describe("a partial refund next to other grants", () => {
  let test: TestBilling;
  let adaId: string;
  const refund = (paymentId: string, amountRefunded?: number) => refundPayment(test.ctx, { provider: "stripe", paymentId, amountRefunded });

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("shortens the stacked month after it and moves its stored dates back", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    await refund("pi_test_a1", 1450);
    // 15 days off 17 December: access ends on 2 December, the second month runs 2 November to 2 December.
    expect((await readRow(test, adaId))?.paid_until).toEqual(new Date("2026-12-01T23:00:00Z"));
    expect(await readPayment(test, "pi_test_b2")).toMatchObject({ granted_from: HALF_MONTH_LEFT, granted_until: new Date("2026-12-01T23:00:00Z") });

    // A full refund of the second month then takes its 30 days, leaving the first month's half.
    await refund("pi_test_b2");
    expect((await readRow(test, adaId))?.paid_until).toEqual(HALF_MONTH_LEFT);
  });

  it("keeps lifetime access until the lifetime payment is refunded in full", async () => {
    await recordPayment(test.ctx, paid(adaId, { planId: "lifetime", amount: 49900 }));
    expect(await refund("pi_test_a1", 10000)).toMatchObject(ok({ status: "partially_refunded", entitlement: { status: "paid", endsAt: null } }));
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "10000" });
    expect(await refund("pi_test_a1", 49900)).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial" } }));
  });

  it("takes nothing for a payment stored before grants were, until the refund completes it", async () => {
    await recordPayment(test.ctx, paid(adaId));
    await test.database.client.query("UPDATE billing.payments SET grant_kind = NULL, granted_from = NULL, granted_until = NULL WHERE payment_id = 'pi_test_a1'");
    expect(await refund("pi_test_a1", 1450)).toMatchObject(ok({ status: "partially_refunded", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }));
    expect(await refund("pi_test_a1", 2900)).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial" } }));
  });

  it("leaves the stored period alone when no dated access is left to take from", async () => {
    // An old payment's refund revokes all paid access, the second month's included.
    await recordPayment(test.ctx, paid(adaId));
    await recordPayment(test.ctx, paid(adaId, { checkoutId: "cs_test_b2", paymentId: "pi_test_b2" }));
    await test.database.client.query("UPDATE billing.payments SET grant_kind = NULL, granted_from = NULL, granted_until = NULL WHERE payment_id = 'pi_test_a1'");
    await refund("pi_test_a1");
    const before = await readPayment(test, "pi_test_b2");
    expect(await refund("pi_test_b2", 1450)).toMatchObject(ok({ status: "partially_refunded", entitlement: { status: "trial" } }));
    expect(await readPayment(test, "pi_test_b2")).toEqual({ ...before, refunded_amount: "1450" });
  });

  it("marks a free checkout refunded in full", async () => {
    await recordPayment(test.ctx, paid(adaId, { amount: 0 }));
    expect(await refund("pi_test_a1")).toMatchObject(ok({ status: "refunded" }));
    expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "refunded", refunded_amount: "0" });
  });
});

describe("a partial refund under keep_access", () => {
  it("takes nothing back until the refunds complete the payment", async () => {
    const options: BillingInput = { plans: PLANS, partialRefunds: "keep_access" };
    const test = await createTestBilling(options);
    try {
      const adaId = await createAccount(test, "ada@example.com");
      await recordPayment(test.ctx, paid(adaId));
      expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1", amountRefunded: 2000 })).toMatchObject(
        ok({ status: "partially_refunded", entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } }),
      );
      expect((await readRow(test, adaId))?.paid_until).toEqual(MONTH_AFTER_TRIAL);
      expect(await readPayment(test, "pi_test_a1")).toMatchObject({ status: "paid", refunded_amount: "2000", granted_until: MONTH_AFTER_TRIAL });

      // The completing refund takes back every unused day, as one full refund would.
      expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial" } }));
      expect((await readRow(test, adaId))?.paid_until).toBeNull();
    } finally {
      await test.database.close();
    }
  });
});

describe("partial refunds through the Stripe webhook", () => {
  it("follows signed deliveries of the refunded total, once each", async () => {
    const test = await createTestBilling({ plans: PLANS });
    try {
      const adaId = await createAccount(test, "ada@example.com");
      await recordPayment(test.ctx, paid(adaId));
      const deliver = (payload: string) => receiveStripeWebhook(test.ctx, { payload, signature: signature(payload), secret: WEBHOOK_SECRET });

      const half = stripeEvent("charge.refunded", charge("pi_test_a1", false, 1450), "evt_test_half");
      expect(await deliver(half)).toMatchObject(ok({ eventId: "evt_test_half", outcome: { status: "partially_refunded" } }));
      expect(await deliver(half)).toMatchObject(ok({ outcome: { status: "duplicate" } }));
      expect((await readRow(test, adaId))?.paid_until).toEqual(HALF_MONTH_LEFT);

      const rest = stripeEvent("charge.refunded", charge("pi_test_a1", true), "evt_test_rest");
      expect(await deliver(rest)).toMatchObject(ok({ outcome: { status: "refunded", entitlement: { status: "trial", endsAt: TRIAL_END } } }));
      expect(await deliver(half)).toMatchObject(ok({ outcome: { status: "duplicate" } }));
    } finally {
      await test.database.close();
    }
  });
});
