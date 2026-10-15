// consumeUsage on a real Postgres (tests/postgres.ts): consumers on separate connections that
// overlap in time. A blocker connection holds the usage row (or its first insert) until both
// consumers wait on it, so the race happens on every run; a burst of consumers checks the same
// without a blocker.
import { type BillingOptionsInput } from "@softure-ai/billing";
import { consumeUsage, getUsage } from "@softure-ai/billing/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresBilling, openBlocker, POSTGRES_ADMIN_URL, waitForLockWaiters, type Blocker, type PostgresBilling } from "./postgres.js";
import { createAccount } from "./support.js";

const OPTIONS: BillingOptionsInput = { trial: { limits: { "ai-calls": 3 } } };
/** October in Warsaw, from the start of the 1st. */
const OCTOBER = "2026-09-30T22:00:00Z";

describe.skipIf(POSTGRES_ADMIN_URL === undefined)("consumeUsage on two connections", () => {
  let test: PostgresBilling;
  let adaId: string;
  let blocker: Blocker | undefined;

  beforeEach(async () => {
    test = await createPostgresBilling(OPTIONS);
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(async () => {
    await blocker?.release();
    blocker = undefined;
    await test.close();
  });

  async function consumeTwiceBehind(open: Blocker): Promise<string[]> {
    const consumers = [consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" }), consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" })];
    await waitForLockWaiters(test, 2);
    await open.release();
    const results = await Promise.all(consumers);
    return results.map((result) => (result.ok ? `ok ${String(result.value.used)}` : result.error)).sort();
  }

  it("lets one of two consumers of the last unit through when both wait on the row", async () => {
    await consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls", amount: 2 });
    blocker = await openBlocker(test);
    await blocker.query("SELECT used FROM billing.usage WHERE user_id = $1 FOR UPDATE", [adaId]);
    expect(await consumeTwiceBehind(blocker)).toEqual(["billing.quota_exhausted", "ok 3"]);
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toMatchObject({ ok: true, value: { used: 3, remaining: 0 } });
  });

  it("lets one of two consumers of the last unit through when both wait on the period's first insert", async () => {
    blocker = await openBlocker(test);
    await blocker.query("INSERT INTO billing.usage (user_id, meter, period, period_start, used, updated_at) VALUES ($1, 'ai-calls', 'month', $2, 2, now())", [adaId, OCTOBER]);
    expect(await consumeTwiceBehind(blocker)).toEqual(["billing.quota_exhausted", "ok 3"]);
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toMatchObject({ ok: true, value: { used: 3 } });
  });

  it("never passes the limit under a burst of consumers", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeUsage(test.ctx, { userId: adaId, meter: "ai-calls" })));
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok).map((result) => (result.ok ? null : result.error))).toEqual(Array.from({ length: 9 }, () => "billing.quota_exhausted"));
    expect(await getUsage(test.ctx, { userId: adaId, meter: "ai-calls" })).toMatchObject({ ok: true, value: { used: 3 } });
  });
});
