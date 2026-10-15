// Usage limits of an account on PGlite: its state, the plan paying for today read from provider
// payments and manual grants, and the limits that follow.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { findCurrentPlanId, getLimits, grantPlanManually, importEntitlement, recordPayment, refundPayment, revokeManualGrant } from "@softure-ai/billing/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month", limits: { "ai-calls": 100 } },
  { id: "pro", name: { en: "Pro" }, price: { amount: 4900, currency: "PLN" }, period: "month", limits: { "ai-calls": 1000, exports: null } },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime", limits: { "ai-calls": 5000 } },
];
const OPTIONS: BillingOptionsInput = {
  trial: { limits: { "ai-calls": 10 } },
  paid: { limits: { "ai-calls": 50, exports: 2 } },
  readOnly: { limits: { exports: 1 } },
  plans: PLANS,
};
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
/** The end of a 14-day trial begun at NOW, and of one month after it. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");

describe("getLimits", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling(OPTIONS);
    adaId = await createAccount(test, "ada@example.com");
  });

  afterEach(async () => {
    await test.database.close();
  });

  async function pay(planId: string, checkoutId: string): Promise<void> {
    const paid = await recordPayment(test.ctx, { provider: "stripe", checkoutId, paymentId: `pi_${checkoutId}`, userId: adaId, planId, amount: 2900, currency: "PLN" });
    if (!paid.ok) throw new Error(`payment failed with ${paid.error}`);
  }

  it("answers null for an account that does not exist", async () => {
    expect(await getLimits(test.ctx, UNKNOWN_ID)).toBeNull();
    expect(await getLimits(test.ctx, "not-a-uuid")).toBeNull();
  });

  it("gives the trial's limits during the trial, 0 for a meter it leaves out", async () => {
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "trial", planId: null, limits: { "ai-calls": 10, exports: 0 } });
  });

  it("gives the read-only limits once the trial ended", async () => {
    test.clock.set(TRIAL_END);
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "read_only", planId: null, limits: { "ai-calls": 0, exports: 1 } });
  });

  it("gives the paid plan's limits from the payment, also while the bought month waits for the trial to end", async () => {
    await pay("pro", "cs_pro");
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "paid", planId: "pro", limits: { "ai-calls": 1000, exports: null } });
    test.clock.set(new Date(TRIAL_END.getTime() + 1));
    expect(await getLimits(test.ctx, adaId)).toMatchObject({ status: "paid", planId: "pro" });
  });

  it("falls back to paid.limits for a meter the plan leaves out", async () => {
    await pay("monthly", "cs_monthly");
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "paid", planId: "monthly", limits: { "ai-calls": 100, exports: 2 } });
  });

  it("follows the plan of the period in force as one period hands over to the next", async () => {
    await pay("monthly", "cs_first");
    await grantPlanManually(test.ctx, { userId: adaId, planId: "pro", adminId: null });
    expect(await findCurrentPlanId(test.ctx.db, adaId, test.clock.now())).toBe("monthly");
    test.clock.set(new Date(MONTH_AFTER_TRIAL.getTime() - 1));
    expect(await findCurrentPlanId(test.ctx.db, adaId, test.clock.now())).toBe("monthly");
    test.clock.set(MONTH_AFTER_TRIAL);
    expect(await getLimits(test.ctx, adaId)).toMatchObject({ status: "paid", planId: "pro" });
  });

  it("lets a lifetime grant win over the periods beside it, until it is revoked", async () => {
    await pay("monthly", "cs_monthly");
    const granted = await grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId: null });
    if (!granted.ok) throw new Error(`grant failed with ${granted.error}`);
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "paid", planId: "lifetime", limits: { "ai-calls": 5000, exports: 2 } });
    await revokeManualGrant(test.ctx, { grantId: granted.value.grantId, adminId: null });
    expect(await getLimits(test.ctx, adaId)).toMatchObject({ status: "paid", planId: "monthly" });
  });

  it("drops a refunded payment's plan", async () => {
    await pay("pro", "cs_pro");
    await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_cs_pro" });
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "trial", planId: null, limits: { "ai-calls": 10, exports: 0 } });
    expect(await findCurrentPlanId(test.ctx.db, adaId, test.clock.now())).toBeNull();
  });

  it("uses paid.limits for paid access no recorded grant explains", async () => {
    await importEntitlement(test.ctx, { userId: adaId, paidUntil: MONTH_AFTER_TRIAL });
    expect(await getLimits(test.ctx, adaId)).toEqual({ status: "paid", planId: null, limits: { "ai-calls": 50, exports: 2 } });
  });
});
