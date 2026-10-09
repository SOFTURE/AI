// The suppression list: recording opt-outs from signed links and from operators, and reading them.
import type { UnsubscribeEvent } from "@softure-ai/mailing";
import { findSuppressedAddresses, getRecipientKey, getUnsubscribeLinkParams, isSuppressed, liftSuppression, readUnsubscribeLink, signRecipientKey, suppressRecipient, unsubscribe } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("finds which of many addresses are suppressed, each as it was given", async () => {
    await suppressRecipient(test.ctx, "ada@example.org");
    await suppressRecipient(test.ctx, "cyd@example.org", "one-click");
    const addresses = [" ADA@example.org", "bob@example.org", "cyd@example.org", ...Array.from({ length: 1200 }, (_, index) => `n${index}@example.org`)];
    expect(await findSuppressedAddresses(test.ctx, addresses)).toEqual(new Set([" ADA@example.org", "cyd@example.org"]));
    expect(await findSuppressedAddresses(test.ctx, [])).toEqual(new Set());
  });

  it("lets the database failure propagate, for the caller to answer", async () => {
    await test.database.client.query("DROP TABLE mailing.suppressions CASCADE");
    await expect(unsubscribe(test.ctx, ADA_TOKEN, "page", ENV)).rejects.toThrow();
    await expect(isSuppressed(test.ctx, "ada@example.org")).rejects.toThrow();
    await expect(findSuppressedAddresses(test.ctx, ["ada@example.org"])).rejects.toThrow();
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

  it("receives the recipient key, the source and the link's scheme, inside the suppression's transaction", async () => {
    const seen: string[] = [];
    const test = await createWithHook(async (event, ctx) => {
      // The hook's context sees the row its transaction just wrote.
      seen.push(`${event.recipientKey} ${event.source} ${event.link.scheme} ${String(await isSuppressed(ctx, "ada@example.org"))}`);
    });
    try {
      expect(await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV)).toEqual({ ok: true, value: undefined });
      expect(seen).toEqual([`${ADA_KEY} one-click signed true`]);
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

describe("legacy unsubscribe links", () => {
  const LEGACY = { u: "signup-17", t: "old-hmac" };
  let verify: ReturnType<typeof vi.fn<(values: Readonly<Record<string, string>>) => Promise<string | null>>>;
  let hook: ReturnType<typeof vi.fn<(event: UnsubscribeEvent) => Promise<void>>>;
  let test: TestMailing;

  beforeEach(async () => {
    verify = vi.fn((values: Readonly<Record<string, string>>) => Promise.resolve(values.u === LEGACY.u && values.t === LEGACY.t ? " Ada@example.org" : null));
    hook = vi.fn(() => Promise.resolve());
    test = await createTestMailing(createConfig(fakeMailProvider(), { legacyUnsubscribe: { params: ["u", "t"], verify }, onUnsubscribed: hook }));
  });
  afterEach(async () => {
    await test.database.close();
  });

  const read = (query: string) => readUnsubscribeLink(new URLSearchParams(query), test.config);

  it("reads a link with every legacy parameter as a legacy link", () => {
    expect(read("u=signup-17&t=old-hmac&utm=x")).toEqual({ scheme: "legacy", values: LEGACY });
  });

  it("reads a link with the recipient parameter as a signed link, even when it also carries the legacy ones", () => {
    expect(read(`r=${ADA_KEY}&t=${ADA_TOKEN.signature}&u=signup-17`)).toEqual({ scheme: "signed", token: ADA_TOKEN });
    expect(read(`r=${ADA_KEY}&u=signup-17`)).toBeNull();
  });

  it.each([
    ["a missing parameter", "u=signup-17"],
    ["an empty parameter", "u=&t=old-hmac"],
    ["a value over 512 characters", `u=${"a".repeat(513)}&t=old-hmac`],
  ])("reads %s as no link", (_case, query) => {
    expect(read(query)).toBeNull();
  });

  it("reads no legacy link when the app set no legacyUnsubscribe", async () => {
    const plain = await createTestMailing();
    try {
      expect(readUnsubscribeLink(new URLSearchParams("u=signup-17&t=old-hmac"), plain.config)).toBeNull();
      expect(await unsubscribe(plain.ctx, { scheme: "legacy", values: LEGACY }, "page", ENV)).toEqual({ ok: false, error: "mailing.invalid_link" });
    } finally {
      await plain.database.close();
    }
  });

  it("records the opt-out of the address the app's verify names, and runs onUnsubscribed with its key and the verified values", async () => {
    expect(await unsubscribe(test.ctx, { scheme: "legacy", values: LEGACY }, "one-click", ENV)).toEqual({ ok: true, value: undefined });
    expect(verify).toHaveBeenCalledWith(LEGACY, test.ctx, ENV);
    expect(await listSuppressions(test.database)).toEqual([`${ADA_KEY} one-click ${NOW.toISOString()}`]);
    expect(hook.mock.calls.map(([event]) => event)).toEqual([{ recipientKey: ADA_KEY, source: "one-click", link: { scheme: "legacy", values: LEGACY } }]);
  });

  it("refuses a link the app's verify does not accept, and stores nothing", async () => {
    expect(await unsubscribe(test.ctx, { scheme: "legacy", values: { u: "signup-17", t: "forged" } }, "page", ENV)).toEqual({ ok: false, error: "mailing.invalid_link" });
    expect(await listSuppressions(test.database)).toEqual([]);
    expect(hook).not.toHaveBeenCalled();
  });

  it("lets a failing verify propagate, so the person may try again", async () => {
    verify.mockRejectedValueOnce(new Error("signups unreadable"));
    await expect(unsubscribe(test.ctx, { scheme: "legacy", values: LEGACY }, "page", ENV)).rejects.toThrow("signups unreadable");
    expect(await listSuppressions(test.database)).toEqual([]);
  });

  it("never asks the app's verify about a signed link", async () => {
    expect(await unsubscribe(test.ctx, { scheme: "signed", token: ADA_TOKEN }, "page", ENV)).toEqual({ ok: true, value: undefined });
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("legacy unsubscribe links with optional parameters", () => {
  let verify: ReturnType<typeof vi.fn<(values: Readonly<Record<string, string>>) => Promise<string | null>>>;
  let hook: ReturnType<typeof vi.fn<(event: UnsubscribeEvent) => Promise<void>>>;
  let test: TestMailing;

  beforeEach(async () => {
    verify = vi.fn((values: Readonly<Record<string, string>>) => Promise.resolve(values.t === "bare-token" || (values.u === "signup-17" && values.t === "old-hmac") ? "ada@example.org" : null));
    hook = vi.fn(() => Promise.resolve());
    test = await createTestMailing(createConfig(fakeMailProvider(), { legacyUnsubscribe: { params: { required: ["t"], optional: ["u"] }, verify }, onUnsubscribed: hook }));
  });
  afterEach(async () => {
    await test.database.close();
  });

  const read = (query: string) => readUnsubscribeLink(new URLSearchParams(query), test.config);

  it.each([
    ["the bare-token form", "t=bare-token", { t: "bare-token" }],
    ["the signed form", "u=signup-17&t=old-hmac", { u: "signup-17", t: "old-hmac" }],
    ["an empty optional value as absent", "u=&t=bare-token", { t: "bare-token" }],
  ])("reads %s with the values present", (_case, query, values) => {
    expect(read(query)).toEqual({ scheme: "legacy", values });
  });

  it.each([
    ["a missing required parameter", "u=signup-17"],
    ["an optional value over 512 characters", `u=${"a".repeat(513)}&t=old-hmac`],
  ])("reads %s as no link", (_case, query) => {
    expect(read(query)).toBeNull();
  });

  it("gives the page back only the values the link carried", () => {
    const link = read("t=bare-token");
    expect(link === null ? null : getUnsubscribeLinkParams(link)).toEqual({ t: "bare-token" });
  });

  it("unsubscribes both forms and passes each one's values to verify and the hook", async () => {
    for (const query of ["t=bare-token", "u=signup-17&t=old-hmac"]) {
      expect(await unsubscribe(test.ctx, read(query), "page", ENV)).toEqual({ ok: true, value: undefined });
    }
    expect(verify.mock.calls.map(([values]) => values)).toEqual([{ t: "bare-token" }, { u: "signup-17", t: "old-hmac" }]);
    expect(hook.mock.calls.map(([event]) => event.link)).toEqual([
      { scheme: "legacy", values: { t: "bare-token" } },
      { scheme: "legacy", values: { u: "signup-17", t: "old-hmac" } },
    ]);
    expect(await listSuppressions(test.database)).toEqual([`${ADA_KEY} page ${NOW.toISOString()}`]);
  });
});
