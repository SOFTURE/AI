// handleWebhook on a real Postgres (PGlite): the order of the checks, the answers, and the work in the delivery's
// transaction.
import { signWebhookRequest, WEBHOOK_SENDERS } from "@softure-ai/security";
import { handleWebhook, type HandleWebhookOptions, type SecurityContext } from "@softure-ai/security/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestSecurity, type TestSecurity } from "./support.js";

const SECRET = "provider-issued-secret";
const URL_PATH = "https://app.example/api/webhooks/github";
const DELIVERY_ID = "72d3162e-cc78-11e3-81ab-4c9367dc0958";
const eventSchema = z.object({ action: z.string(), issue: z.object({ id: z.number() }) });
type Event = z.infer<typeof eventSchema>;
const EVENT: Event = { action: "opened", issue: { id: 42 } };

interface Call {
  readonly event: Event;
  readonly ctx: SecurityContext;
}

async function countDeliveries(test: TestSecurity): Promise<number> {
  const result = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM security.webhook_deliveries");
  return result.rows[0]?.count ?? 0;
}

function signed(body: string, overrides: { secret?: string; deliveryId?: string | null } = {}): Promise<Request> {
  const deliveryId = overrides.deliveryId === null ? undefined : (overrides.deliveryId ?? DELIVERY_ID);
  return signWebhookRequest({ url: URL_PATH, sender: WEBHOOK_SENDERS.github, secret: overrides.secret ?? SECRET, body, deliveryId });
}

async function readAnswer(response: Response): Promise<{ status: number; body: unknown }> {
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : (JSON.parse(text) as unknown) };
}

describe("handleWebhook", () => {
  let test: TestSecurity;
  let calls: Call[];
  let options: HandleWebhookOptions<Event>;

  beforeEach(async () => {
    test = await createTestSecurity();
    calls = [];
    options = {
      source: "github",
      maxBytes: 1024,
      sender: WEBHOOK_SENDERS.github,
      secret: SECRET,
      schema: eventSchema,
      handle: async (event, ctx) => {
        calls.push({ event, ctx });
        await Promise.resolve();
      },
    };
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  it("answers 200 with an empty body and runs the work once with the parsed event", async () => {
    const response = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), options);
    expect(await readAnswer(response)).toEqual({ status: 200, body: null });
    expect(calls.map((call) => call.event)).toEqual([EVENT]);
    expect(await countDeliveries(test)).toBe(1);
  });

  it("gives the work the delivery's transaction, not the connection", async () => {
    await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), options);
    expect(calls[0]?.ctx.db).not.toBe(test.ctx.db);
    expect(calls[0]?.ctx.clock).toBe(test.ctx.clock);
    expect(calls[0]?.ctx.config).toBe(test.ctx.config);
  });

  it("answers a replay of the same delivery with 200 and skips the work", async () => {
    await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), options);
    const replay = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), options);
    expect(await readAnswer(replay)).toEqual({ status: 200, body: null });
    expect(calls).toHaveLength(1);
  });

  it("answers 413 for a body over maxBytes, before checking the signature", async () => {
    const big = JSON.stringify({ ...EVENT, padding: "x".repeat(1024) });
    const response = await handleWebhook(test.ctx, await signed(big, { secret: "wrong" }), options);
    expect(await readAnswer(response)).toEqual({ status: 413, body: { error: "security.body_too_large" } });
  });

  it("answers 401 for a wrong signature, without parsing or recording anything", async () => {
    const parse = vi.spyOn(eventSchema, "safeParse");
    const response = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT), { secret: "wrong" }), options);
    expect(await readAnswer(response)).toEqual({ status: 401, body: { error: "security.signature_invalid" } });
    expect(parse).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(await countDeliveries(test)).toBe(0);
  });

  it("answers 401 when the app has no secret configured", async () => {
    const response = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), { ...options, secret: undefined });
    expect(await readAnswer(response)).toEqual({ status: 401, body: { error: "security.signature_invalid" } });
  });

  it.each([
    ["is not JSON", "not json {"],
    ["is empty", ""],
    ["does not match the schema", JSON.stringify({ action: "opened" })],
  ])("answers 400 for a signed body that %s, recording nothing", async (_case, body) => {
    const response = await handleWebhook(test.ctx, await signed(body), options);
    expect(await readAnswer(response)).toEqual({ status: 400, body: { error: "security.webhook_payload_invalid" } });
    expect(calls).toEqual([]);
    expect(await countDeliveries(test)).toBe(0);
  });

  it("answers 400 for signed bytes that are not UTF-8", async () => {
    const request = await signWebhookRequest({ url: URL_PATH, sender: WEBHOOK_SENDERS.github, secret: SECRET, body: new Uint8Array([0x22, 0xff, 0x22]), deliveryId: DELIVERY_ID });
    const response = await handleWebhook(test.ctx, request, options);
    expect(await readAnswer(response)).toEqual({ status: 400, body: { error: "security.webhook_payload_invalid" } });
  });

  it("answers 400 when the delivery id header is missing", async () => {
    const response = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT), { deliveryId: null }), options);
    expect(await readAnswer(response)).toEqual({ status: 400, body: { error: "security.delivery_id_invalid" } });
    expect(calls).toEqual([]);
  });

  it("takes the delivery id from the event for a sender without an id header", async () => {
    const lemonOptions: HandleWebhookOptions<{ meta: { webhook_id: string } }> = {
      source: "lemonsqueezy",
      maxBytes: 1024,
      sender: WEBHOOK_SENDERS.lemonSqueezy,
      secret: SECRET,
      schema: z.object({ meta: z.object({ webhook_id: z.string() }) }),
      deliveryId: (event) => event.meta.webhook_id,
      handle: async () => {
        await Promise.resolve();
      },
    };
    const body = JSON.stringify({ meta: { webhook_id: "w-1" } });
    const send = () => signWebhookRequest({ url: URL_PATH, sender: WEBHOOK_SENDERS.lemonSqueezy, secret: SECRET, body });
    const handle = vi.spyOn(lemonOptions, "handle");
    expect((await handleWebhook(test.ctx, await send(), lemonOptions)).status).toBe(200);
    expect((await handleWebhook(test.ctx, await send(), lemonOptions)).status).toBe(200);
    expect(handle).toHaveBeenCalledTimes(1);
    const rows = await test.database.client.query<{ delivery_id: string }>("SELECT delivery_id FROM security.webhook_deliveries");
    expect(rows.rows).toEqual([{ delivery_id: "w-1" }]);
  });

  it("answers 500 with a code when the work fails, rolls the delivery back and processes the retry", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = { ...options, handle: () => Promise.reject(new Error("queue unavailable")) };
    const response = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), failing);
    expect(await readAnswer(response)).toEqual({ status: 500, body: { error: "security.webhook_failed" } });
    expect(log).toHaveBeenCalledWith('@softure-ai/security: webhook "github" failed: queue unavailable');
    expect(await countDeliveries(test)).toBe(0);

    const retry = await handleWebhook(test.ctx, await signed(JSON.stringify(EVENT)), options);
    expect(retry.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("throws on a sender without an id header when no deliveryId is given: a configuration bug", async () => {
    const request = await signed(JSON.stringify(EVENT));
    await expect(handleWebhook(test.ctx, request, { ...options, sender: WEBHOOK_SENDERS.lemonSqueezy })).rejects.toThrow(
      'handleWebhook: the sender of "github" has no deliveryIdHeader; pass deliveryId',
    );
    expect(request.bodyUsed).toBe(false);
  });

  it("throws on a malformed source before reading the request", async () => {
    const request = await signed(JSON.stringify(EVENT));
    await expect(handleWebhook(test.ctx, request, { ...options, source: "GitHub" })).rejects.toThrow(RangeError);
    expect(request.bodyUsed).toBe(false);
  });
});
