// The billing part of a GDPR export and deletion: the account's entitlement row, if it has one, its
// invoice requests and its manual grants (payments: stripe-payments.test.ts).
import { changeEntitlement, dismissPaymentRequest, exportBillingUserData, getEntitlement, grantPlanManually, recordPaymentRequest } from "@softure-ai/billing/server";
import { collectUserData, eraseUserData } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const PAID_END = new Date("2026-11-30T23:00:00Z");
const EMPTY = { entitlement: null, payments: [], paymentRequests: [], manualGrants: [] };
const INVOICE = { name: "Ada Lovelace Ltd", taxId: null, address: "1 Analytical Way, London" };

describe("the billing privacy contributor", () => {
  let test: TestBilling;
  let adaId: string;
  let eveId: string;

  beforeEach(async () => {
    test = await createTestBilling({ plans: [{ id: "monthly", name: { en: "Monthly" }, price: { amount: 2900, currency: "PLN" }, period: "month" }] });
    adaId = await createAccount(test, "ada@example.com");
    eveId = await createAccount(test, "eve@example.com");
    for (const id of [adaId, eveId]) await changeEntitlement(test.ctx, id, { type: "grant", until: PAID_END });
  });
  afterEach(() => test.database.close());

  it("exports the account's entitlement row, its requests (details only while open) and its manual grants", async () => {
    const dismissed = await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE });
    await dismissPaymentRequest(test.ctx, dismissed);
    const later = new Date("2026-10-04T08:00:00Z");
    test.clock.set(later);
    await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE });
    await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: eveId });
    const collected = await collectUserData(test.ctx, adaId);
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    const data = JSON.parse(collected.value.json) as { data: Record<string, unknown> };
    expect(data.data.billing).toEqual({
      entitlement: { trialEndsAt: "2026-10-16T22:00:00.000Z", paidUntil: "2026-12-31T23:00:00.000Z", isLifetime: false, createdAt: NOW.toISOString(), updatedAt: later.toISOString() },
      payments: [],
      paymentRequests: [
        { planId: "monthly", invoiceName: null, invoiceTaxId: null, invoiceAddress: null, status: "dismissed", requestedAt: NOW.toISOString(), closedAt: NOW.toISOString() },
        { planId: "monthly", invoiceName: INVOICE.name, invoiceTaxId: null, invoiceAddress: INVOICE.address, status: "open", requestedAt: later.toISOString(), closedAt: null },
      ],
      // The admin who granted it (eve) is the admin's data, not ada's.
      manualGrants: [
        { planId: "monthly", grantedAt: later.toISOString(), grantKind: "period", grantedFrom: PAID_END.toISOString(), grantedUntil: "2026-12-31T23:00:00.000Z", status: "active", revokedAt: null },
      ],
    });
  });

  it("exports nothing for an account without a row, an unknown id or a malformed one", async () => {
    const bobId = await createAccount(test, "bob@example.com");
    expect(await exportBillingUserData(test.ctx, bobId)).toEqual({ ok: true, value: EMPTY });
    expect(await exportBillingUserData(test.ctx, "00000000-0000-4000-8000-000000000000")).toEqual({ ok: true, value: EMPTY });
    expect(await exportBillingUserData(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: EMPTY });
  });

  it("deletes the account's rows with the account and leaves other accounts alone", async () => {
    await recordPaymentRequest(test.ctx, { userId: adaId, planId: "monthly", invoice: INVOICE });
    await grantPlanManually(test.ctx, { userId: adaId, planId: "monthly", adminId: eveId });
    await grantPlanManually(test.ctx, { userId: eveId, planId: "monthly", adminId: adaId });
    expect(await eraseUserData(test.ctx, adaId)).toEqual({ ok: true, value: undefined });
    expect(await exportBillingUserData(test.ctx, adaId)).toEqual({ ok: true, value: EMPTY });
    // Eve's grant stays; ada is gone as the admin who granted it.
    const eves = await test.database.client.query<{ granted_by: string | null }>("SELECT granted_by FROM billing.manual_grants WHERE user_id = $1", [eveId]);
    expect(eves.rows).toEqual([{ granted_by: null }]);
    expect(await readRow(test, adaId)).toBeUndefined();
    expect(await getEntitlement(test.ctx, adaId)).toBeNull();
    // Eve's own month, then the month ada granted her on top.
    expect(await readRow(test, eveId)).toMatchObject({ paid_until: new Date("2026-12-31T23:00:00Z") });
  });
});
