// Reading and changing entitlements on PGlite: the derived trial of an account without a row, the
// write guard, changes pinned into a row under a lock, and the table's own constraints.
import { changeEntitlement, checkWriteAccess, getEntitlement } from "@softure-ai/billing/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, NOW, readRow, type TestBilling } from "./support.js";

/** The end of a 14-day trial begun at NOW: midnight starting 17 October in Warsaw. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const PAID_END = new Date("2026-11-30T23:00:00Z");
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("getEntitlement", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("puts an account without a row on the configured trial from its creation, writing nothing", async () => {
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "trial", endsAt: TRIAL_END, daysLeft: 14, isEnding: false });
    expect(await readRow(test, adaId)).toBeUndefined();
  });

  it("makes the account read-only once the trial ends", async () => {
    test.clock.set(TRIAL_END);
    expect(await getEntitlement(test.ctx, adaId)).toEqual({ status: "read_only", since: TRIAL_END, reason: "trial_ended" });
  });

  it("follows the configured trial length and reminder window", async () => {
    const short = await createTestBilling({ trial: { days: 2, reminderDays: 2 } });
    try {
      const id = await createAccount(short, "bob@example.com");
      expect(await getEntitlement(short.ctx, id)).toEqual({ status: "trial", endsAt: new Date("2026-10-04T22:00:00Z"), daysLeft: 2, isEnding: true });
    } finally {
      await short.database.close();
    }
  });

  it("starts no trial at all with zero trial days", async () => {
    const none = await createTestBilling({ trial: { days: 0 } });
    try {
      const id = await createAccount(none, "bob@example.com");
      expect(await getEntitlement(none.ctx, id)).toEqual({ status: "read_only", since: new Date("2026-10-02T22:00:00Z"), reason: "trial_ended" });
    } finally {
      await none.database.close();
    }
  });

  it("knows no entitlement for an unknown or malformed account id", async () => {
    expect(await getEntitlement(test.ctx, UNKNOWN_ID)).toBeNull();
    expect(await getEntitlement(test.ctx, "not-a-uuid")).toBeNull();
  });
});

describe("checkWriteAccess", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("lets a trial account write and refuses a read-only one", async () => {
    expect(await checkWriteAccess(test.ctx, adaId)).toMatchObject({ ok: true, value: { status: "trial" } });
    test.clock.set(TRIAL_END);
    expect(await checkWriteAccess(test.ctx, adaId)).toEqual({ ok: false, error: "billing.read_only" });
  });

  it("lets a paid account write after its trial", async () => {
    await changeEntitlement(test.ctx, adaId, { type: "grant", until: PAID_END });
    test.clock.set(TRIAL_END);
    expect(await checkWriteAccess(test.ctx, adaId)).toMatchObject({ ok: true, value: { status: "paid", endsAt: PAID_END } });
  });

  it("refuses an unknown account", async () => {
    expect(await checkWriteAccess(test.ctx, UNKNOWN_ID)).toEqual({ ok: false, error: "billing.account_unknown" });
  });
});

describe("changeEntitlement", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("pins the derived trial into a new row with the grant", async () => {
    const later = new Date(NOW.getTime() + 60_000);
    test.clock.set(later);
    expect(await changeEntitlement(test.ctx, adaId, { type: "grant", until: PAID_END })).toEqual({
      ok: true,
      value: { status: "paid", endsAt: PAID_END, daysLeft: 59, isEnding: false },
    });
    expect(await readRow(test, adaId)).toEqual({ trial_ends_at: TRIAL_END, paid_until: PAID_END, is_lifetime: false, created_at: later, updated_at: later });
  });

  it("keeps the pinned trial when the configured trial length changes later", async () => {
    await changeEntitlement(test.ctx, adaId, { type: "revoke" });
    const longer = await createTestBilling({ trial: { days: 30 } });
    try {
      expect(await getEntitlement({ ...test.ctx, config: longer.config }, adaId)).toMatchObject({ status: "trial", endsAt: TRIAL_END });
    } finally {
      await longer.database.close();
    }
  });

  it("updates an existing row in place, stamping the change", async () => {
    await changeEntitlement(test.ctx, adaId, { type: "grant", until: PAID_END });
    const later = new Date("2026-11-01T08:00:00Z");
    test.clock.set(later);
    expect(await changeEntitlement(test.ctx, adaId, { type: "grant_lifetime" })).toEqual({ ok: true, value: { status: "paid", endsAt: null, daysLeft: null, isEnding: false } });
    expect(await readRow(test, adaId)).toEqual({ trial_ends_at: TRIAL_END, paid_until: null, is_lifetime: true, created_at: NOW, updated_at: later });
  });

  it("brings a read-only account back to paid", async () => {
    test.clock.set(new Date("2026-10-20T08:00:00Z"));
    expect((await getEntitlement(test.ctx, adaId))?.status).toBe("read_only");
    expect(await changeEntitlement(test.ctx, adaId, { type: "grant", until: PAID_END })).toMatchObject({ ok: true, value: { status: "paid" } });
    expect((await getEntitlement(test.ctx, adaId))?.status).toBe("paid");
  });

  it("refuses an end in the past and stores nothing", async () => {
    expect(await changeEntitlement(test.ctx, adaId, { type: "grant", until: NOW })).toEqual({ ok: false, error: "billing.end_not_in_future" });
    expect(await readRow(test, adaId)).toBeUndefined();
  });

  it("refuses an unknown or malformed account", async () => {
    expect(await changeEntitlement(test.ctx, UNKNOWN_ID, { type: "grant_lifetime" })).toEqual({ ok: false, error: "billing.account_unknown" });
    expect(await changeEntitlement(test.ctx, "not-a-uuid", { type: "grant_lifetime" })).toEqual({ ok: false, error: "billing.account_unknown" });
  });

  it("keeps one row when two changes race for a new account", async () => {
    const [first, second] = await Promise.all([
      changeEntitlement(test.ctx, adaId, { type: "grant", until: PAID_END }),
      changeEntitlement(test.ctx, adaId, { type: "extend_trial", until: new Date("2026-10-23T22:00:00Z") }),
    ]);
    expect(first.ok && second.ok).toBe(true);
    expect(await readRow(test, adaId)).toMatchObject({ trial_ends_at: new Date("2026-10-23T22:00:00Z"), paid_until: PAID_END });
  });

  it("loses the row with the account", async () => {
    await changeEntitlement(test.ctx, adaId, { type: "grant_lifetime" });
    await test.database.client.query("DELETE FROM auth.users WHERE id = $1", [adaId]);
    expect(await readRow(test, adaId)).toBeUndefined();
  });
});

describe("the entitlements table", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  const insert = (userId: string, paidUntil: string | null, isLifetime: boolean, createdAt = "2026-10-03T08:00:00Z", updatedAt = createdAt) =>
    test.database.client.query(
      "INSERT INTO billing.entitlements (user_id, trial_ends_at, paid_until, is_lifetime, created_at, updated_at) VALUES ($1, '2026-10-16T22:00:00Z', $2, $3, $4, $5)",
      [userId, paidUntil, isLifetime, createdAt, updatedAt],
    );

  it("refuses lifetime access with an end", async () => {
    await expect(insert(adaId, "2026-11-30T23:00:00Z", true)).rejects.toThrow(/entitlements_lifetime_without_end/);
  });

  it("refuses a change stamped before the row's creation", async () => {
    await expect(insert(adaId, null, false, "2026-10-03T08:00:00Z", "2026-10-01T08:00:00Z")).rejects.toThrow(/entitlements_updated_after_created/);
  });

  it("refuses a row without an account, and a second row for one", async () => {
    await expect(insert("00000000-0000-4000-8000-000000000000", null, false)).rejects.toThrow(/foreign key/);
    await insert(adaId, null, false);
    await expect(insert(adaId, null, true)).rejects.toThrow(/entitlements_pkey/);
  });
});
