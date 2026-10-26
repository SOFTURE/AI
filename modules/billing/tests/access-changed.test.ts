// The app's hook on access changes on PGlite: every recorded grant, refund (or revoked grant) and trial extension
// calls `billing({ onAccessChanged })` once, after its transaction committed, with the account, the change, the plan,
// the end of the access it is about and where the account stands; a refusal or a repeated delivery calls nothing,
// and a hook that throws is logged and never fails the change.
import { LIFETIME_GRANT_PLAN_ID, type AccessChangedEvent, type BillingOptionsInput } from "@softure-ai/billing";
import {
  extendTrialManually,
  failRefund,
  getAccountHistory,
  grantLifetimeManually,
  grantPaymentRequest,
  grantPlanManually,
  recordPayment,
  recordPaymentRequest,
  refundPayment,
  revokeManualGrant,
} from "@softure-ai/billing/server";
import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, createConfig, createTestBilling, NOW, type BillingInput, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
const DAY = 86_400_000;
/** Midnight starting 17 October in Warsaw: the end of the 14-day trial begun at NOW. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
/** Midnight starting 21 October in Warsaw: an extended trial's end. */
const EXTENDED_TRIAL_END = new Date("2026-10-20T22:00:00Z");
/** Midnight starting 17 November in Warsaw (CET): one month after the trial. */
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
/** Midnight starting 8 November in Warsaw: 9 of the month's 31 days taken back (900 of 2900). */
const NINE_DAYS_EARLY = new Date("2026-11-07T23:00:00Z");
const INVOICE = { name: "Ada Lovelace Ltd", taxId: "PL1234567890", address: "1 Analytical Way, London" };

interface HookCall {
  readonly event: AccessChangedEvent;
  readonly ctx: ModuleContext<Queryable>;
}

function paid(userId: string): Parameters<typeof recordPayment>[1] {
  return { provider: "stripe", checkoutId: "cs_test_a1", paymentId: "pi_test_a1", userId, planId: "monthly", amount: 2900, currency: "PLN" };
}

describe("onAccessChanged", () => {
  let test: TestBilling;
  let adaId: string;
  let calls: HookCall[];

  async function setUp(options: BillingInput = {}): Promise<void> {
    calls = [];
    test = await createTestBilling({
      plans: PLANS,
      onAccessChanged: (event, ctx) => {
        calls.push({ event, ctx });
      },
      ...options,
    });
    adaId = await createAccount(test, "ada@example.com");
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await test.database.close();
  });

  describe("on the admin's changes", () => {
    beforeEach(() => setUp());

    it("reports a plan granted by hand with its plan, paid access' end and the context the grant ran with", async () => {
      const granted = await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null });

      expect(granted.ok).toBe(true);
      expect(calls).toEqual([
        {
          event: { accountId: adaId, change: "granted", planId: "monthly", endsAt: MONTH_AFTER_TRIAL, entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL, daysLeft: 45, isEnding: false } },
          ctx: test.ctx,
        },
      ]);
    });

    it("reports lifetime access granted without a plan under the lifetime grant's plan id, with no end", async () => {
      await grantLifetimeManually(test.ctx, { userId: adaId, adminId: null });

      expect(calls.map(({ event }) => event)).toEqual([
        { accountId: adaId, change: "granted", planId: LIFETIME_GRANT_PLAN_ID, endsAt: null, entitlement: { status: "paid", endsAt: null, daysLeft: null, isEnding: false } },
      ]);
    });

    it("reports a granted invoice request as a grant of the plan it asked for", async () => {
      await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: { amount: 2900, currency: "PLN" } });
      const [request] = (await test.database.client.query<{ id: string }>("SELECT id FROM billing.payment_requests")).rows;
      if (request === undefined) throw new Error("the request was not stored");

      await grantPaymentRequest(test.ctx, { requestId: request.id, adminId: null });

      expect(calls.map(({ event }) => [event.change, event.planId, event.endsAt])).toEqual([["granted", "monthly", MONTH_AFTER_TRIAL]]);
    });

    it("reports a revoked grant as refunded, with no paid access left", async () => {
      const granted = await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null });
      if (!granted.ok) throw new Error(`the grant failed with ${granted.error}`);

      await revokeManualGrant(test.ctx, { grantId: granted.value.grantId, adminId: null });

      expect(calls.map(({ event }) => event)).toEqual([
        expect.objectContaining({ change: "granted" }),
        { accountId: adaId, change: "refunded", planId: "monthly", endsAt: null, entitlement: { status: "trial", endsAt: TRIAL_END, daysLeft: 14, isEnding: false } },
      ]);
    });

    it("reports a trial extension with the new trial end and no plan", async () => {
      await extendTrialManually(test.ctx, { userId: adaId, until: EXTENDED_TRIAL_END, adminId: null });

      expect(calls.map(({ event }) => event)).toEqual([
        { accountId: adaId, change: "trial_extended", planId: null, endsAt: EXTENDED_TRIAL_END, entitlement: { status: "trial", endsAt: EXTENDED_TRIAL_END, daysLeft: 18, isEnding: false } },
      ]);
    });

    it("calls the hook once the change committed, so it reads the change through the context", async () => {
      const histories: number[] = [];
      calls = [];
      await test.database.close();
      test = await createTestBilling({
        plans: PLANS,
        onAccessChanged: async (event, ctx) => {
          histories.push((await getAccountHistory(ctx, event.accountId)).length);
        },
      });
      adaId = await createAccount(test, "ada@example.com");

      await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null });

      expect(histories).toEqual([1]);
    });

    it("calls nothing for a refusal", async () => {
      await grantLifetimeManually(test.ctx, { userId: adaId, adminId: null });
      calls = [];

      await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null });
      await grantPlanManually(test.ctx, { userId: adaId, planId: "unknown", adminId: null });
      await revokeManualGrant(test.ctx, { grantId: "00000000-0000-4000-8000-000000000000", adminId: null });
      await extendTrialManually(test.ctx, { userId: adaId, until: TRIAL_END, adminId: null });

      expect(calls).toEqual([]);
    });
  });

  describe("on a provider's payments", () => {
    beforeEach(() => setUp());

    it("reports a paid checkout as a grant of its plan, and nothing for its repeated delivery", async () => {
      await recordPayment(test.ctx, paid(adaId));
      await recordPayment(test.ctx, paid(adaId));

      expect(calls.map(({ event }) => [event.change, event.planId, event.endsAt])).toEqual([["granted", "monthly", MONTH_AFTER_TRIAL]]);
    });

    it("reports a full refund as refunded, and nothing for its repeated delivery or an unknown payment", async () => {
      await recordPayment(test.ctx, paid(adaId));
      calls = [];

      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" });
      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" });
      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_unknown" });

      expect(calls.map(({ event }) => [event.accountId, event.change, event.planId, event.endsAt, event.entitlement.status])).toEqual([[adaId, "refunded", "monthly", null, "trial"]]);
    });

    it("reports a partial refund with the shortened end, and its failure as access granted back", async () => {
      await recordPayment(test.ctx, paid(adaId));
      calls = [];

      await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1", amountRefunded: 900 });
      test.clock.set(new Date(NOW.getTime() + DAY));
      await failRefund(test.ctx, { provider: "stripe", paymentId: "pi_test_a1", refundId: "re_test_a1", amount: 900, refundCreatedAt: NOW, failedAt: test.clock.now() });

      expect(calls.map(({ event }) => [event.change, event.planId, event.endsAt])).toEqual([
        ["refunded", "monthly", NINE_DAYS_EARLY],
        ["granted", "monthly", MONTH_AFTER_TRIAL],
      ]);
    });

    it("calls nothing for the failure of a refund billing never counted", async () => {
      await recordPayment(test.ctx, paid(adaId));
      calls = [];

      await failRefund(test.ctx, { provider: "stripe", paymentId: "pi_test_a1", refundId: "re_test_a1", amount: 900, refundCreatedAt: NOW, failedAt: NOW });

      expect(calls).toEqual([]);
    });
  });

  describe("a hook that fails", () => {
    it.each([
      ["throws", () => {
        throw new Error("analytics down for ada@example.com");
      }],
      ["rejects", () => Promise.reject(new TypeError("analytics down for ada@example.com"))],
    ])("is logged by the change's kind, without the account or the message, and the grant stands when it %s", async (_case, hook) => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await setUp({ onAccessChanged: hook });

      const granted = await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null });

      expect(granted).toMatchObject({ ok: true, value: { entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL } } });
      expect(await getAccountHistory(test.ctx, adaId)).toHaveLength(1);
      expect(logged.mock.calls.map((call) => String(call[0]))).toEqual([expect.stringMatching(/^@softure-ai\/billing: onAccessChanged failed for a "granted" change: (Error|TypeError)$/)]);
    });
  });
});

describe("the onAccessChanged option", () => {
  it("is refused when it is not a function", () => {
    expect(() => createConfig({ onAccessChanged: "notify" as never })).toThrow(/onAccessChanged/);
  });
});
