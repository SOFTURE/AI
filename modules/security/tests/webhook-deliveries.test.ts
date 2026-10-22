// The webhook delivery ledger on a real Postgres (PGlite): the first delivery of an id is new, a retry is a replay.
import { forgetDelivery, pruneWebhookDeliveries, recordDeliveryOnce } from "@softure-ai/security/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestSecurity, NOW, type TestSecurity } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DELIVERY = { source: "github", deliveryId: "72d3162e-cc78-11e3-81ab-4c9367dc0958" };

async function listDeliveries(test: TestSecurity): Promise<{ source: string; delivery_id: string; received_at: Date }[]> {
  const result = await test.database.client.query<{ source: string; delivery_id: string; received_at: Date }>(
    "SELECT source, delivery_id, received_at FROM security.webhook_deliveries ORDER BY received_at, delivery_id",
  );
  return result.rows;
}

describe("recordDeliveryOnce", () => {
  let test: TestSecurity;

  beforeEach(async () => {
    test = await createTestSecurity();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("answers true for the first delivery and false for its retry, keeping the first receipt time", async () => {
    expect(await recordDeliveryOnce(test.ctx, DELIVERY)).toEqual({ ok: true, value: true });
    test.clock.advance(60_000);
    expect(await recordDeliveryOnce(test.ctx, DELIVERY)).toEqual({ ok: true, value: false });
    expect(await listDeliveries(test)).toEqual([{ source: "github", delivery_id: DELIVERY.deliveryId, received_at: NOW }]);
  });

  it("keeps sources apart: the same id from another source is a new delivery", async () => {
    await recordDeliveryOnce(test.ctx, DELIVERY);
    expect(await recordDeliveryOnce(test.ctx, { source: "shopify", deliveryId: DELIVERY.deliveryId })).toEqual({ ok: true, value: true });
  });

  it("lets exactly one of several parallel retries through", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => recordDeliveryOnce(test.ctx, DELIVERY)));
    expect(results.filter((result) => result.ok && result.value)).toHaveLength(1);
    expect(results.filter((result) => result.ok && !result.value)).toHaveLength(4);
  });

  it("leaves no record when the work's transaction rolls back, so the provider's retry is processed", async () => {
    await expect(
      test.database.db.transaction(async (tx) => {
        expect(await recordDeliveryOnce({ ...test.ctx, db: tx }, DELIVERY)).toEqual({ ok: true, value: true });
        throw new Error("the work failed");
      }),
    ).rejects.toThrow("the work failed");
    expect(await recordDeliveryOnce(test.ctx, DELIVERY)).toEqual({ ok: true, value: true });
  });

  it("refuses a delivery id that is empty, over 200 characters or holds control characters, as a value", async () => {
    const invalid = { ok: false, error: "security.delivery_id_invalid" };
    expect(await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "" })).toEqual(invalid);
    expect(await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "a".repeat(201) })).toEqual(invalid);
    expect(await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "evt\n1" })).toEqual(invalid);
    expect(await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "a".repeat(200) })).toEqual({ ok: true, value: true });
    expect(await listDeliveries(test)).toHaveLength(1);
  });

  it("throws on a source that is not a lowercase name: the source is the app's constant", async () => {
    await expect(recordDeliveryOnce(test.ctx, { source: "GitHub", deliveryId: "1" })).rejects.toThrow(
      '@softure-ai/security: "GitHub" is not a webhook source: lowercase letters, digits, _ . and -, starting with a letter, at most 63',
    );
    await expect(forgetDelivery(test.ctx, { source: "", deliveryId: "1" })).rejects.toThrow("is not a webhook source");
  });
});

describe("forgetDelivery", () => {
  let test: TestSecurity;

  beforeEach(async () => {
    test = await createTestSecurity();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("forgets one delivery, so a retry after failed work is new again", async () => {
    await recordDeliveryOnce(test.ctx, DELIVERY);
    await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "other" });
    await forgetDelivery(test.ctx, DELIVERY);
    expect(await recordDeliveryOnce(test.ctx, DELIVERY)).toEqual({ ok: true, value: true });
    expect(await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "other" })).toEqual({ ok: true, value: false });
  });

  it("does nothing for an id it never recorded, an invalid one included", async () => {
    await forgetDelivery(test.ctx, { source: "github", deliveryId: "" });
    await forgetDelivery(test.ctx, DELIVERY);
    expect(await listDeliveries(test)).toEqual([]);
  });
});

describe("pruneWebhookDeliveries", () => {
  let test: TestSecurity | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("deletes deliveries older than the default retention of 30 days and keeps the rest", async () => {
    test = await createTestSecurity();
    await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "old" });
    test.clock.advance(DAY_MS);
    await recordDeliveryOnce(test.ctx, { source: "github", deliveryId: "recent" });
    test.clock.advance(30 * DAY_MS);

    await pruneWebhookDeliveries(test.ctx);
    expect((await listDeliveries(test)).map((row) => row.delivery_id)).toEqual(["recent"]);
  });

  it("keeps a delivery received exactly at the cutoff", async () => {
    test = await createTestSecurity();
    await recordDeliveryOnce(test.ctx, DELIVERY);
    test.clock.advance(30 * DAY_MS);
    await pruneWebhookDeliveries(test.ctx);
    expect(await listDeliveries(test)).toHaveLength(1);
  });

  it("follows webhookDeliveries.retentionDays", async () => {
    test = await createTestSecurity({ webhookDeliveries: { retentionDays: 2 } });
    await recordDeliveryOnce(test.ctx, DELIVERY);
    test.clock.advance(2 * DAY_MS + 1);
    await pruneWebhookDeliveries(test.ctx);
    expect(await listDeliveries(test)).toEqual([]);
    expect(await recordDeliveryOnce(test.ctx, DELIVERY)).toEqual({ ok: true, value: true });
  });
});

describe("the security.webhook_deliveries table", () => {
  let test: TestSecurity;

  beforeEach(async () => {
    test = await createTestSecurity();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it.each([
    ["a source that is not a lowercase name", "Shop", "1"],
    ["an empty delivery id", "github", ""],
    ["a delivery id over 200 characters", "github", "a".repeat(201)],
  ])("refuses %s", async (_case, source, deliveryId) => {
    await expect(
      test.database.client.query("INSERT INTO security.webhook_deliveries (source, delivery_id, received_at) VALUES ($1, $2, now())", [
        source,
        deliveryId,
      ]),
    ).rejects.toThrow(/check constraint/);
  });
});
