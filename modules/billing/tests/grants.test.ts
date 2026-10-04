// Manual payments on PGlite: invoice requests stored one per account and plan and closed once,
// plans granted by hand and recorded with what they added, a revoke that takes back only that grant
// (moving later periods of both tables), and an account's history of grants and provider payments.
import { type BillingOptionsInput } from "@softure-ai/billing";
import {
  dismissPaymentRequest,
  getAccountHistory,
  getEntitlement,
  grantPaymentRequest,
  grantPlanManually,
  listOpenRequests,
  recordPayment,
  recordPaymentRequest,
  refundPayment,
  revokeManualGrant,
} from "@softure-ai/billing/server";
import { err, ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const PLANS: BillingOptionsInput["plans"] = [
  { id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" },
  { id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: "lifetime" },
];
/** The end of a 14-day trial begun at NOW, one month on top, and a second month after that. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const MONTH_AFTER_TRIAL = new Date("2026-11-16T23:00:00Z");
const TWO_MONTHS_AFTER_TRIAL = new Date("2026-12-16T23:00:00Z");
/** 31 days (17 October to 16 November) before the end of the second month. */
const SHIFTED_END = new Date("2026-11-15T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const INVOICE = { name: "Ada Lovelace Ltd", taxId: "PL1234567890", address: "1 Analytical Way, London" };
const PRICE = { amount: 2900, currency: "PLN" };
const LIFETIME_PRICE = { amount: 49900, currency: "PLN" };

interface RequestRow {
  plan_id: string;
  invoice_name: string | null;
  invoice_tax_id: string | null;
  invoice_address: string | null;
  status: string;
  requested_at: Date;
  closed_at: Date | null;
}

async function readRequests(test: TestBilling): Promise<RequestRow[]> {
  const result = await test.database.client.query<RequestRow>(
    "SELECT plan_id, invoice_name, invoice_tax_id, invoice_address, status, requested_at, closed_at FROM billing.payment_requests ORDER BY requested_at, closed_at NULLS LAST",
  );
  return result.rows;
}

interface ManualGrantRow {
  id: string;
  user_id: string;
  plan_id: string;
  request_id: string | null;
  granted_by: string | null;
  granted_at: Date;
  grant_kind: string;
  granted_from: Date | null;
  granted_until: Date | null;
  status: string;
  revoked_at: Date | null;
  revoked_by: string | null;
  amount: number | null;
  currency: string | null;
}

async function readManualGrants(test: TestBilling): Promise<ManualGrantRow[]> {
  const result = await test.database.client.query<ManualGrantRow>("SELECT * FROM billing.manual_grants ORDER BY granted_at, granted_from NULLS LAST");
  return result.rows;
}

async function readPaymentPeriods(test: TestBilling): Promise<{ payment_id: string; granted_from: Date | null; granted_until: Date | null }[]> {
  const result = await test.database.client.query<{ payment_id: string; granted_from: Date | null; granted_until: Date | null }>(
    "SELECT payment_id, granted_from, granted_until FROM billing.payments ORDER BY paid_at, checkout_id",
  );
  return result.rows;
}

async function readPaymentGrantKinds(test: TestBilling): Promise<(string | null)[]> {
  const result = await test.database.client.query<{ grant_kind: string | null }>("SELECT grant_kind FROM billing.payments ORDER BY paid_at, checkout_id");
  return result.rows.map((row) => row.grant_kind);
}

function paid(userId: string, overrides: Partial<Parameters<typeof recordPayment>[1]> = {}): Parameters<typeof recordPayment>[1] {
  return { provider: "stripe", checkoutId: "cs_test_a1", paymentId: "pi_test_a1", userId, planId: "monthly", amount: 2900, currency: "PLN", ...overrides };
}

describe("payment requests", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("keeps one open request per account and plan, refreshed (details, price, time) when asked again", async () => {
    const first = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    const later = new Date("2026-10-04T08:00:00Z");
    test.clock.set(later);
    const raised = { amount: 3500, currency: "PLN" };
    const again = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: { ...INVOICE, taxId: null }, price: raised });
    expect(again).toBe(first);
    const latest = new Date("2026-10-05T08:00:00Z");
    test.clock.set(latest);
    await recordPaymentRequest(test.ctx, { userId: adaId, planId: "lifetime", invoice: INVOICE, price: LIFETIME_PRICE });
    expect(await listOpenRequests(test.ctx)).toEqual([
      { id: first, userId: adaId, email: "ada@example.com", planId: "monthly", invoice: { ...INVOICE, taxId: null }, price: raised, requestedAt: later },
      { id: expect.any(String) as unknown, userId: adaId, email: "ada@example.com", planId: "lifetime", invoice: INVOICE, price: LIFETIME_PRICE, requestedAt: latest },
    ]);
  });

  it("lists open requests oldest first, up to the limit", async () => {
    const eveId = await createAccount(test, "eve@example.com");
    await recordPaymentRequest(test.ctx, { userId: eveId, planId: "monthly", invoice: INVOICE, price: PRICE });
    test.clock.set(new Date("2026-10-04T08:00:00Z"));
    await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: null, price: PRICE });
    expect((await listOpenRequests(test.ctx)).map((request) => [request.email, request.invoice])).toEqual([
      ["eve@example.com", INVOICE],
      ["ada@example.com", null],
    ]);
    expect(await listOpenRequests(test.ctx, 1)).toHaveLength(1);
  });

  it("dismisses an open request once and clears its invoice details", async () => {
    const id = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    test.clock.set(new Date("2026-10-04T08:00:00Z"));
    expect(await dismissPaymentRequest(test.ctx, id)).toEqual(ok());
    expect(await dismissPaymentRequest(test.ctx, id)).toEqual(err("billing.request_closed"));
    expect(await dismissPaymentRequest(test.ctx, UNKNOWN_ID)).toEqual(err("billing.request_closed"));
    expect(await dismissPaymentRequest(test.ctx, "not-a-uuid")).toEqual(err("billing.request_closed"));
    expect(await readRequests(test)).toEqual([
      { plan_id: "monthly", invoice_name: null, invoice_tax_id: null, invoice_address: null, status: "dismissed", requested_at: NOW, closed_at: new Date("2026-10-04T08:00:00Z") },
    ]);
    expect(await listOpenRequests(test.ctx)).toEqual([]);
  });

  it("opens a fresh request after a closed one, never reopening it", async () => {
    const closed = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    await dismissPaymentRequest(test.ctx, closed);
    const fresh = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    expect(fresh).not.toBe(closed);
    expect((await readRequests(test)).map((row) => row.status)).toEqual(["dismissed", "open"]);
  });

  it("is refused by the database for a closed request that keeps its details, or one without an address", async () => {
    await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    await expect(test.database.client.query("UPDATE billing.payment_requests SET status = 'dismissed', closed_at = now()")).rejects.toThrow(/payment_requests_details_while_open/);
    await expect(test.database.client.query("UPDATE billing.payment_requests SET invoice_address = NULL")).rejects.toThrow(/payment_requests_name_with_address/);
    await expect(test.database.client.query("UPDATE billing.payment_requests SET status = 'granted'")).rejects.toThrow(/payment_requests_closed_at_with_status/);
  });
});

describe("granting by hand", () => {
  let test: TestBilling;
  let adaId: string;
  let adminId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    adminId = await createAccount(test, "admin@example.com");
  });
  afterEach(() => test.database.close());

  it("grants a request's plan, closes the request and records what the grant added", async () => {
    const requestId = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    const granted = await grantPaymentRequest(test.ctx, { requestId, adminId });
    expect(granted).toEqual(ok({ grantId: expect.any(String) as unknown, entitlement: { status: "paid", endsAt: MONTH_AFTER_TRIAL, daysLeft: 45, isEnding: false } }));
    expect(await readRequests(test)).toEqual([
      { plan_id: "monthly", invoice_name: null, invoice_tax_id: null, invoice_address: null, status: "granted", requested_at: NOW, closed_at: NOW },
    ]);
    expect(await readManualGrants(test)).toEqual([
      {
        id: granted.ok ? granted.value.grantId : "",
        user_id: adaId,
        plan_id: "monthly",
        request_id: requestId,
        granted_by: adminId,
        granted_at: NOW,
        grant_kind: "period",
        granted_from: TRIAL_END,
        granted_until: MONTH_AFTER_TRIAL,
        status: "active",
        revoked_at: null,
        revoked_by: null,
        amount: 2900,
        currency: "PLN",
      },
    ]);
  });

  it("records the price the request quoted, and the plan's price for a grant by email", async () => {
    // The request was asked for at an older price; the grant is for what was invoiced.
    const quoted = { amount: 2500, currency: "PLN" };
    const requestId = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: quoted });
    await grantPaymentRequest(test.ctx, { requestId, adminId });
    test.clock.set(new Date("2026-10-04T08:00:00Z"));
    await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId });
    expect((await readManualGrants(test)).map((row) => [row.request_id, row.amount, row.currency])).toEqual([
      [requestId, 2500, "PLN"],
      [null, 2900, "PLN"],
    ]);
    expect((await getAccountHistory(test.ctx, adaId)).map((entry) => (entry.source === "manual" ? entry.price : null))).toEqual([PRICE, quoted]);
  });

  it("grants a request once: a second grant or a dismissal finds it closed and changes nothing", async () => {
    const requestId = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    await grantPaymentRequest(test.ctx, { requestId, adminId });
    expect(await grantPaymentRequest(test.ctx, { requestId, adminId })).toEqual(err("billing.request_closed"));
    expect(await dismissPaymentRequest(test.ctx, requestId)).toEqual(err("billing.request_closed"));
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "paid", endsAt: MONTH_AFTER_TRIAL });
    expect(await readManualGrants(test)).toHaveLength(1);
  });

  it("leaves a request open when its plan is gone from the config or the request is another account's", async () => {
    const gone = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "weekly", invoice: INVOICE, price: PRICE });
    expect(await grantPaymentRequest(test.ctx, { requestId: gone, adminId })).toEqual(err("billing.plan_unknown"));
    const eveId = await createAccount(test, "eve@example.com");
    const eves = await recordPaymentRequest(test.ctx, { userId: eveId, planId: "monthly", invoice: INVOICE, price: PRICE });
    expect(await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId, requestId: eves })).toEqual(err("billing.request_closed"));
    expect(await grantPaymentRequest(test.ctx, { requestId: "not-a-uuid", adminId })).toEqual(err("billing.request_closed"));
    expect((await listOpenRequests(test.ctx)).map((request) => request.planId).sort()).toEqual(["monthly", "weekly"]);
    expect(await readManualGrants(test)).toEqual([]);
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });

  it("refuses an account with lifetime access, leaving its request open", async () => {
    await grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId });
    const requestId = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
    expect(await grantPaymentRequest(test.ctx, { requestId, adminId })).toEqual(err("billing.lifetime_active"));
    expect(await grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId })).toEqual(err("billing.lifetime_active"));
    expect(await listOpenRequests(test.ctx)).toHaveLength(1);
    expect((await readManualGrants(test)).map((row) => row.grant_kind)).toEqual(["lifetime"]);
  });

  it("records a grant typed in by email without a request, and refuses an unknown plan or account", async () => {
    expect(await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: null })).toMatchObject({ ok: true });
    expect(await grantPlanManually(test.ctx, { userId: adaId, planId: "weekly", adminId })).toEqual(err("billing.plan_unknown"));
    expect(await grantPlanManually(test.ctx, { userId: UNKNOWN_ID, planId: "monthly", adminId })).toEqual(err("billing.account_unknown"));
    expect(await grantPlanManually(test.ctx, { userId: "not-a-uuid", planId: "monthly", adminId })).toEqual(err("billing.account_unknown"));
    expect(await readManualGrants(test)).toMatchObject([{ request_id: null, granted_by: null, granted_from: TRIAL_END, granted_until: MONTH_AFTER_TRIAL }]);
  });
});

describe("revoking a manual grant", () => {
  let test: TestBilling;
  let adaId: string;
  let adminId: string;

  async function grant(planId: string): Promise<string> {
    const granted = await grantPlanManually(test.ctx, { userId: adaId, planId, adminId });
    if (!granted.ok) throw new Error(`grant failed with ${granted.error}`);
    return granted.value.grantId;
  }

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    adminId = await createAccount(test, "admin@example.com");
  });
  afterEach(() => test.database.close());

  it("takes back a mistaken month, once, and records who revoked it", async () => {
    const grantId = await grant("monthly");
    const later = new Date("2026-10-04T08:00:00Z");
    test.clock.set(later);
    expect(await revokeManualGrant(test.ctx, { grantId, adminId })).toEqual(ok({ status: "trial", endsAt: TRIAL_END, daysLeft: 13, isEnding: false }));
    expect(await revokeManualGrant(test.ctx, { grantId, adminId })).toEqual(err("billing.grant_revoked"));
    expect(await revokeManualGrant(test.ctx, { grantId: UNKNOWN_ID, adminId })).toEqual(err("billing.grant_revoked"));
    expect(await revokeManualGrant(test.ctx, { grantId: "not-a-uuid", adminId })).toEqual(err("billing.grant_revoked"));
    expect(await readManualGrants(test)).toMatchObject([{ status: "revoked", revoked_at: later, revoked_by: adminId }]);
    expect(await readRow(test, adaId)).toMatchObject({ paid_until: null, is_lifetime: false });
  });

  it("keeps a paid month stacked after the revoked one, moving its stored period back", async () => {
    const grantId = await grant("monthly");
    await recordPayment(test.ctx, paid(adaId));
    expect(await readPaymentPeriods(test)).toEqual([{ payment_id: "pi_test_a1", granted_from: MONTH_AFTER_TRIAL, granted_until: TWO_MONTHS_AFTER_TRIAL }]);
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    expect(await revokeManualGrant(test.ctx, { grantId, adminId })).toMatchObject(ok({ status: "paid", endsAt: SHIFTED_END }));
    expect(await readPaymentPeriods(test)).toEqual([{ payment_id: "pi_test_a1", granted_from: TRIAL_END, granted_until: SHIFTED_END }]);
    // The paid month now refunds from its new place and leaves the trial.
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toMatchObject(ok({ entitlement: { status: "trial" } }));
  });

  it("moves a manual month stacked after a refunded payment, so its revoke takes back the right days", async () => {
    await recordPayment(test.ctx, paid(adaId));
    const grantId = await grant("monthly");
    test.clock.set(new Date("2026-10-05T08:00:00Z"));
    await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" });
    expect(await readManualGrants(test)).toMatchObject([{ granted_from: TRIAL_END, granted_until: SHIFTED_END }]);
    expect(await revokeManualGrant(test.ctx, { grantId, adminId })).toMatchObject(ok({ status: "trial", endsAt: TRIAL_END }));
  });

  it("ends a manual lifetime, unless a paid lifetime or another manual one still gives it", async () => {
    const first = await grant("lifetime");
    // `grantPlanManually` refuses a second lifetime, so the second one is written as an older grant would be.
    await test.database.client.query(
      "INSERT INTO billing.manual_grants (user_id, plan_id, granted_at, grant_kind, status) VALUES ($1, 'lifetime', $2, 'lifetime', 'active')",
      [adaId, NOW],
    );
    expect(await revokeManualGrant(test.ctx, { grantId: first, adminId })).toMatchObject(ok({ status: "paid", endsAt: null }));
    const second = (await readManualGrants(test)).find((row) => row.status === "active");
    await recordPayment(test.ctx, paid(adaId, { planId: "lifetime", amount: 49900 }));
    expect(await revokeManualGrant(test.ctx, { grantId: second?.id ?? "", adminId })).toMatchObject(ok({ status: "paid", endsAt: null }));
    await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" });
    expect(await getEntitlement(test.ctx, adaId)).toMatchObject({ status: "trial" });
  });

  it("ends a manual lifetime and keeps the month granted beside it", async () => {
    await grant("monthly");
    const lifetime = await grant("lifetime");
    expect(await revokeManualGrant(test.ctx, { grantId: lifetime, adminId })).toEqual(ok({ status: "paid", endsAt: MONTH_AFTER_TRIAL, daysLeft: 45, isEnding: false }));
  });

  it("is refused by the database for a revoked grant without its time, or a period without an end", async () => {
    await grant("monthly");
    await expect(test.database.client.query("UPDATE billing.manual_grants SET status = 'revoked'")).rejects.toThrow(/manual_grants_revoked_at_with_status/);
    await expect(test.database.client.query("UPDATE billing.manual_grants SET granted_until = NULL")).rejects.toThrow(/manual_grants_grant_shape/);
    await expect(test.database.client.query("UPDATE billing.manual_grants SET revoked_by = granted_by")).rejects.toThrow(/manual_grants_revoked_by_when_revoked/);
  });
});

describe("refunding a paid lifetime beside a manual lifetime", () => {
  let test: TestBilling;
  let adaId: string;
  let adminId: string;
  let grantId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: PLANS });
    adaId = await createAccount(test, "ada@example.com");
    adminId = await createAccount(test, "admin@example.com");
    const granted = await grantPlanManually(test.ctx, { userId: adaId, planId: "lifetime", adminId });
    if (!granted.ok) throw new Error(`grant failed with ${granted.error}`);
    grantId = granted.value.grantId;
    // A checkout started before the admin's grant and paid after it: the webhook records it anyway.
    await recordPayment(test.ctx, paid(adaId, { planId: "lifetime", amount: 49900 }));
  });
  afterEach(() => test.database.close());

  it("keeps lifetime access while the manual lifetime grant is active", async () => {
    expect(await readPaymentGrantKinds(test)).toEqual(["lifetime"]);
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toEqual(
      ok({ status: "refunded", entitlement: { status: "paid", endsAt: null, daysLeft: null, isEnding: false } }),
    );
    expect(await readRow(test, adaId)).toMatchObject({ is_lifetime: true });
    // The manual grant still gives lifetime: revoking it now ends it.
    expect(await revokeManualGrant(test.ctx, { grantId, adminId })).toMatchObject(ok({ status: "trial" }));
  });

  it("ends lifetime access once the manual lifetime grant was revoked", async () => {
    // The paid lifetime kept access through the revoke.
    expect(await revokeManualGrant(test.ctx, { grantId, adminId })).toMatchObject(ok({ status: "paid", endsAt: null }));
    expect(await refundPayment(test.ctx, { provider: "stripe", paymentId: "pi_test_a1" })).toMatchObject(ok({ status: "refunded", entitlement: { status: "trial" } }));
    expect(await readRow(test, adaId)).toMatchObject({ is_lifetime: false });
  });
});

describe("an account's history", () => {
  it("lists manual grants and provider payments, newest first, with their state", async () => {
    const test = await createTestBilling({ plans: PLANS });
    try {
      const adaId = await createAccount(test, "ada@example.com");
      const requestId = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE, price: PRICE });
      const granted = await grantPaymentRequest(test.ctx, { requestId, adminId: null });
      const paidAt = new Date("2026-10-04T08:00:00Z");
      test.clock.set(paidAt);
      await recordPayment(test.ctx, paid(adaId));
      const revokedAt = new Date("2026-10-05T08:00:00Z");
      test.clock.set(revokedAt);
      await revokeManualGrant(test.ctx, { grantId: granted.ok ? granted.value.grantId : "", adminId: null });

      expect(await getAccountHistory(test.ctx, adaId)).toEqual([
        {
          source: "provider",
          id: expect.any(String) as unknown,
          provider: "stripe",
          planId: "monthly",
          at: paidAt,
          grant: { kind: "period", from: TRIAL_END, until: SHIFTED_END },
          amount: 2900,
          currency: "PLN",
          status: "paid",
          refundedAt: null,
          refundedAmount: 0,
        },
        {
          source: "manual",
          id: granted.ok ? granted.value.grantId : "",
          planId: "monthly",
          at: NOW,
          grant: { kind: "period", from: TRIAL_END, until: MONTH_AFTER_TRIAL },
          status: "revoked",
          revokedAt,
          isFromRequest: true,
          price: PRICE,
        },
      ]);
      expect(await getAccountHistory(test.ctx, UNKNOWN_ID)).toEqual([]);
      expect(await getAccountHistory(test.ctx, "not-a-uuid")).toEqual([]);
    } finally {
      await test.database.close();
    }
  });
});
