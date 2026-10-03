// The suppression list: recording opt-outs from signed links and from operators, and reading them.
import type { UnsubscribeEvent } from "@softure-ai/mailing";
import { getRecipientKey, isSuppressed, liftSuppression, signRecipientKey, suppressRecipient, unsubscribe } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestMailing, listSuppressions, NOW, PREVIOUS_SECRET, SECRET, type TestMailing } from "./support.js";

const ENV = { MAILING_UNSUBSCRIBE_SECRET: SECRET };
const ADA_KEY = getRecipientKey("ada@example.org");
const ADA_TOKEN = { recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, SECRET) };

describe("the suppression list", () => {
  let test: TestMailing;

  beforeEach(async () => {
    test = await createTestMailing();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("records the recipient of a signed link, with its source and the time", async () => {
    expect(await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV)).toEqual({ ok: true, value: undefined });
    expect(await listSuppressions(test.database)).toEqual([`${ADA_KEY} one-click ${NOW.toISOString()}`]);
    expect(await isSuppressed(test.ctx, "ada@example.org")).toBe(true);
    expect(await isSuppressed(test.ctx, "  ADA@example.org")).toBe(true);
    expect(await isSuppressed(test.ctx, "bob@example.org")).toBe(false);
  });

  it("keeps the first opt-out when the same link is used again", async () => {
    await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV);
    test.clock.advance(60_000);
    expect(await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV)).toEqual({ ok: true, value: undefined });
    expect(await listSuppressions(test.database)).toEqual([`${ADA_KEY} one-click ${NOW.toISOString()}`]);
  });

  it("accepts a link signed with the previous secret during a rotation", async () => {
    const token = { recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, PREVIOUS_SECRET) };
    const env = { MAILING_UNSUBSCRIBE_SECRET: "a-brand-new-secret-of-32-chars!!", MAILING_UNSUBSCRIBE_SECRET_PREVIOUS: PREVIOUS_SECRET };
    expect(await unsubscribe(test.ctx, token, "page", env)).toEqual({ ok: true, value: undefined });
  });

  it.each([
    ["no link", null, ENV],
    ["a forged signature", { recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, "f".repeat(32)) }, ENV],
    ["a malformed key", { recipientKey: "ada@example.org", signature: ADA_TOKEN.signature }, ENV],
    ["a valid link while no secret is set", ADA_TOKEN, {}],
  ])("refuses %s as an invalid link and stores nothing", async (_case, token, env) => {
    expect(await unsubscribe(test.ctx, token, "one-click", env)).toEqual({ ok: false, error: "mailing.invalid_link" });
    expect(await listSuppressions(test.database)).toEqual([]);
  });

  it("does not touch the database for an invalid link", async () => {
    const ctx = { ...test.ctx, db: new Proxy({}, { get: () => { throw new Error("database touched"); } }) as typeof test.ctx.db };
    expect(await unsubscribe(ctx, { recipientKey: ADA_KEY, signature: "x".repeat(43) }, "one-click", ENV)).toEqual({ ok: false, error: "mailing.invalid_link" });
  });

  it("lets an operator suppress an address directly", async () => {
    await suppressRecipient(test.ctx, "Bob@example.org");
    expect(await listSuppressions(test.database)).toEqual([`${getRecipientKey("bob@example.org")} operator ${NOW.toISOString()}`]);
  });

  it("lets the database failure propagate, for the caller to answer", async () => {
    await test.database.client.query("DROP TABLE mailing.suppressions");
    await expect(unsubscribe(test.ctx, ADA_TOKEN, "page", ENV)).rejects.toThrow();
    await expect(isSuppressed(test.ctx, "ada@example.org")).rejects.toThrow();
  });

  it("lifts the recipient's own opt-out and reports it", async () => {
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    expect(await liftSuppression(test.ctx, " Ada@Example.org ")).toBe(true);
    expect(await isSuppressed(test.ctx, "ada@example.org")).toBe(false);
    expect(await liftSuppression(test.ctx, "ada@example.org")).toBe(false);
  });

  it("keeps an operator's suppression when a new consent arrives", async () => {
    await suppressRecipient(test.ctx, "ada@example.org");
    expect(await liftSuppression(test.ctx, "ada@example.org")).toBe(false);
    expect(await isSuppressed(test.ctx, "ada@example.org")).toBe(true);
  });
});

describe("the onUnsubscribed hook", () => {
  async function createWithHook(onUnsubscribed: (event: UnsubscribeEvent, ctx: TestMailing["ctx"]) => Promise<void>): Promise<TestMailing> {
    return createTestMailing(createConfig(fakeMailProvider(), { onUnsubscribed }));
  }

  it("receives the recipient key and the source, inside the suppression's transaction", async () => {
    const seen: string[] = [];
    const test = await createWithHook(async (event, ctx) => {
      // The hook's context sees the row its transaction just wrote.
      seen.push(`${event.recipientKey} ${event.source} ${String(await isSuppressed(ctx, "ada@example.org"))}`);
    });
    try {
      expect(await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV)).toEqual({ ok: true, value: undefined });
      expect(seen).toEqual([`${ADA_KEY} one-click true`]);
    } finally {
      await test.database.close();
    }
  });

  it("runs again for a repeated unsubscribe, so a retry heals a missed hook", async () => {
    const sources: string[] = [];
    const test = await createWithHook((event) => {
      sources.push(event.source);
      return Promise.resolve();
    });
    try {
      await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV);
      await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
      expect(sources).toEqual(["one-click", "page"]);
    } finally {
      await test.database.close();
    }
  });

  it("is not called for a link that does not verify", async () => {
    let calls = 0;
    const test = await createWithHook(() => {
      calls += 1;
      return Promise.resolve();
    });
    try {
      await unsubscribe(test.ctx, { recipientKey: ADA_KEY, signature: "x".repeat(43) }, "page", ENV);
      expect(calls).toBe(0);
    } finally {
      await test.database.close();
    }
  });

  it("rolls the opt-out back when it throws, and the failure propagates", async () => {
    const test = await createWithHook(() => Promise.reject(new Error("ledger unavailable")));
    try {
      await expect(unsubscribe(test.ctx, ADA_TOKEN, "page", ENV)).rejects.toThrow("ledger unavailable");
      expect(await listSuppressions(test.database)).toEqual([]);
    } finally {
      await test.database.close();
    }
  });

  it("is not called when an operator suppresses an address", async () => {
    let calls = 0;
    const test = await createWithHook(() => {
      calls += 1;
      return Promise.resolve();
    });
    try {
      await suppressRecipient(test.ctx, "ada@example.org");
      expect(calls).toBe(0);
    } finally {
      await test.database.close();
    }
  });
});
