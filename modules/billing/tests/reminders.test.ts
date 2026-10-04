// The accounts due a reminder mail, read from Postgres (PGlite): accounts without a row by their
// creation day, stored rows by their ends, and a brute-force cross-check that the bounded queries
// find exactly the accounts the pure rule picks out of all of them.
import { getAccessReminder } from "@softure-ai/billing";
import { changeEntitlement, findAccessReminders, findEntitlementRecord, getEntitlementPolicy, type AccessReminderDue } from "@softure-ai/billing/server";
import { afterEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, type BillingInput, type TestBilling } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Midnight starting 17 October in Warsaw: the end of a 14-day trial begun on 3 October. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");

let test: TestBilling | undefined;

afterEach(async () => {
  await test?.database.close();
  test = undefined;
});

async function setUp(options?: BillingInput): Promise<TestBilling> {
  test = await createTestBilling(options);
  return test;
}

async function createAccountAt(billing: TestBilling, email: string, instant: Date): Promise<string> {
  billing.clock.set(instant);
  return createAccount(billing, email);
}

function summarize(due: readonly AccessReminderDue[]): string[] {
  return due.map((reminder) => `${reminder.email} ${reminder.kind} ${reminder.endsAt.toISOString()}`);
}

describe("findAccessReminders", () => {
  it("finds an account without a row in its trial reminder window, with its derived end", async () => {
    const billing = await setUp();
    const userId = await createAccountAt(billing, "ada@example.com", new Date("2026-10-03T08:00:00Z"));
    billing.clock.set(new Date("2026-10-14T08:00:00Z"));

    expect(await findAccessReminders(billing.ctx)).toEqual([{ userId, email: "ada@example.com", kind: "trial-ending", endsAt: TRIAL_END }]);
  });

  it("finds nothing outside every window", async () => {
    const billing = await setUp();
    await createAccountAt(billing, "ada@example.com", new Date("2026-10-03T08:00:00Z"));
    billing.clock.set(new Date("2026-10-13T08:00:00Z"));
    expect(await findAccessReminders(billing.ctx)).toEqual([]);
    billing.clock.set(new Date("2026-10-21T08:00:00Z"));
    expect(await findAccessReminders(billing.ctx)).toEqual([]);
  });

  it("finds an ended trial within the catch-up days, and leaves it out with fewer", async () => {
    const billing = await setUp();
    await createAccountAt(billing, "ada@example.com", new Date("2026-10-03T08:00:00Z"));
    billing.clock.set(new Date("2026-10-19T08:00:00Z"));

    expect(summarize(await findAccessReminders(billing.ctx))).toEqual([`ada@example.com trial-ended ${TRIAL_END.toISOString()}`]);
    expect(await findAccessReminders(billing.ctx, { catchUpDays: 1 })).toEqual([]);
  });

  it("uses a stored row's ends: an extended trial and dated paid access", async () => {
    const billing = await setUp();
    const extended = await createAccountAt(billing, "ext@example.com", new Date("2026-09-01T08:00:00Z"));
    const paid = await createAccountAt(billing, "paid@example.com", new Date("2026-09-01T08:00:00Z"));
    billing.clock.set(new Date("2026-09-02T08:00:00Z"));
    const extendedEnd = new Date("2026-10-15T22:00:00Z");
    const paidEnd = new Date("2026-10-19T22:00:00Z");
    expect((await changeEntitlement(billing.ctx, extended, { type: "extend_trial", until: extendedEnd })).ok).toBe(true);
    expect((await changeEntitlement(billing.ctx, paid, { type: "grant", until: paidEnd })).ok).toBe(true);
    billing.clock.set(new Date("2026-10-14T08:00:00Z"));

    expect(summarize(await findAccessReminders(billing.ctx))).toEqual([
      `ext@example.com trial-ending ${extendedEnd.toISOString()}`,
      `paid@example.com paid-ending ${paidEnd.toISOString()}`,
    ]);
  });

  it("skips lifetime access whatever its dates", async () => {
    const billing = await setUp();
    const userId = await createAccountAt(billing, "life@example.com", new Date("2026-10-03T08:00:00Z"));
    expect((await changeEntitlement(billing.ctx, userId, { type: "grant_lifetime" })).ok).toBe(true);
    billing.clock.set(new Date("2026-10-15T08:00:00Z"));
    expect(await findAccessReminders(billing.ctx)).toEqual([]);
  });

  it("finds every account created before trial.startsAt in the floor trial's windows, and only then", async () => {
    const billing = await setUp({ trial: { startsAt: "2026-10-05" } });
    // Old accounts share the floor's trial: 5 to 18 October, ending when 19 October begins.
    const floorEnd = new Date("2026-10-18T22:00:00Z");
    await createAccountAt(billing, "old1@example.com", new Date("2026-01-10T08:00:00Z"));
    await createAccountAt(billing, "old2@example.com", new Date("2026-06-20T08:00:00Z"));
    // Created after the floor: its own trial, 10 to 23 October.
    await createAccountAt(billing, "new@example.com", new Date("2026-10-10T08:00:00Z"));

    billing.clock.set(new Date("2026-10-15T08:00:00Z"));
    expect(await findAccessReminders(billing.ctx)).toEqual([]);
    billing.clock.set(new Date("2026-10-16T08:00:00Z"));
    // Same end: ordered by account id, so compared sorted.
    expect(summarize(await findAccessReminders(billing.ctx)).toSorted()).toEqual([
      `old1@example.com trial-ending ${floorEnd.toISOString()}`,
      `old2@example.com trial-ending ${floorEnd.toISOString()}`,
    ]);
    billing.clock.set(new Date("2026-10-20T08:00:00Z"));
    expect(summarize(await findAccessReminders(billing.ctx)).toSorted()).toEqual([
      `old1@example.com trial-ended ${floorEnd.toISOString()}`,
      `old2@example.com trial-ended ${floorEnd.toISOString()}`,
    ]);
    billing.clock.set(new Date("2026-10-23T08:00:00Z"));
    expect(summarize(await findAccessReminders(billing.ctx))).toEqual([`new@example.com trial-ending ${new Date("2026-10-23T22:00:00Z").toISOString()}`]);
  });

  it("refuses a catch-up window that is not a whole number of days from 0 to 365", async () => {
    const billing = await setUp();
    await expect(findAccessReminders(billing.ctx, { catchUpDays: -1 })).rejects.toThrow(/catchUpDays/);
    await expect(findAccessReminders(billing.ctx, { catchUpDays: 1.5 })).rejects.toThrow(/catchUpDays/);
    await expect(findAccessReminders(billing.ctx, { catchUpDays: 366 })).rejects.toThrow(/catchUpDays/);
  });

  it.each([
    ["without a trial floor", undefined],
    ["with a trial floor inside the spread", "2026-09-25"],
  ])("finds exactly the accounts the pure rule picks out of all of them, %s", async (_case, startsAt) => {
    const billing = await setUp(startsAt === undefined ? undefined : { trial: { startsAt } });
    const start = new Date("2026-09-10T05:30:00Z");
    const userIds: string[] = [];
    // One account a day at shifting hours (midnight in Warsaw included), some with a stored row.
    for (let day = 0; day < 40; day += 1) {
      const createdAt = new Date(start.getTime() + day * DAY_MS + (day % 6) * 4 * 60 * 60 * 1000);
      const userId = await createAccountAt(billing, `user${String(day)}@example.com`, createdAt);
      userIds.push(userId);
      if (day % 5 === 1) await changeEntitlement(billing.ctx, userId, { type: "grant", until: new Date(createdAt.getTime() + (20 + day) * DAY_MS) });
      if (day % 7 === 3) await changeEntitlement(billing.ctx, userId, { type: "extend_trial", until: new Date(createdAt.getTime() + 18 * DAY_MS) });
      if (day === 9) await changeEntitlement(billing.ctx, userId, { type: "grant_lifetime" });
    }

    const policy = getEntitlementPolicy(billing.config);
    let found = 0;
    for (let offset = 0; offset < 50; offset += 1) {
      const now = new Date(start.getTime() + offset * DAY_MS + 7 * 60 * 60 * 1000);
      billing.clock.set(now);
      const expected: string[] = [];
      for (const [index, userId] of userIds.entries()) {
        const record = await findEntitlementRecord(billing.ctx, userId);
        if (record === null) throw new Error(`no record for ${userId}`);
        const row = await billing.database.client.query<{ created_at: Date }>("SELECT created_at FROM auth.users WHERE id = $1", [userId]);
        const accountCreatedAt = row.rows[0]?.created_at;
        if (accountCreatedAt === undefined) throw new Error(`no account ${userId}`);
        const reminder = getAccessReminder({ record, accountCreatedAt, now, policy, catchUpDays: 3 });
        if (reminder !== null && accountCreatedAt <= now) expected.push(`user${String(index)}@example.com ${reminder.kind} ${reminder.endsAt.toISOString()}`);
      }
      const actual = summarize(await findAccessReminders(billing.ctx));
      expect(actual.toSorted(), now.toISOString()).toEqual(expected.toSorted());
      found += actual.length;
    }
    // The spread actually exercises the windows.
    expect(found).toBeGreaterThan(100);
  });

  it("has an index on auth.users.created_at for the range of accounts without a row", async () => {
    const billing = await setUp();
    const result = await billing.database.client.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE schemaname = 'auth' AND indexname = 'users_created_at_idx'",
    );
    expect(result.rows.map((row) => row.indexdef)).toEqual(["CREATE INDEX users_created_at_idx ON auth.users USING btree (created_at)"]);
  });
});
