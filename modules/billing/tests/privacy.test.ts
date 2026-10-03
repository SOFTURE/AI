// The billing part of a GDPR export and deletion: the account's entitlement row, if it has one.
import { changeEntitlement, exportBillingUserData, getEntitlement } from "@softure-ai/billing/server";
import { collectUserData, eraseUserData } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

const PAID_END = new Date("2026-11-30T23:00:00Z");

describe("the billing privacy contributor", () => {
  let test: TestBilling;
  let adaId: string;
  let eveId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
    eveId = await createAccount(test, "eve@example.com");
    for (const id of [adaId, eveId]) await changeEntitlement(test.ctx, id, { type: "grant", until: PAID_END });
  });
  afterEach(() => test.database.close());

  it("exports the account's entitlement row", async () => {
    const collected = await collectUserData(test.ctx, adaId);
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    const data = JSON.parse(collected.value.json) as { data: Record<string, unknown> };
    expect(data.data.billing).toEqual({
      entitlement: { trialEndsAt: "2026-10-16T22:00:00.000Z", paidUntil: PAID_END.toISOString(), isLifetime: false, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() },
    });
  });

  it("exports nothing for an account without a row, an unknown id or a malformed one", async () => {
    const bobId = await createAccount(test, "bob@example.com");
    expect(await exportBillingUserData(test.ctx, bobId)).toEqual({ ok: true, value: { entitlement: null } });
    expect(await exportBillingUserData(test.ctx, "00000000-0000-4000-8000-000000000000")).toEqual({ ok: true, value: { entitlement: null } });
    expect(await exportBillingUserData(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: { entitlement: null } });
  });

  it("deletes the account's row with the account and leaves other accounts alone", async () => {
    expect(await eraseUserData(test.ctx, adaId)).toEqual({ ok: true, value: undefined });
    expect(await readRow(test, adaId)).toBeUndefined();
    expect(await getEntitlement(test.ctx, adaId)).toBeNull();
    expect(await readRow(test, eveId)).toMatchObject({ paid_until: PAID_END });
  });
});
