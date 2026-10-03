// The suppression list: recording opt-outs from signed links and from operators, and reading them.
import { getRecipientKey, isSuppressed, signRecipientKey, suppressRecipient, unsubscribe } from "@softure-ai/mailing/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMailing, listSuppressions, NOW, PREVIOUS_SECRET, SECRET, type TestMailing } from "./support.js";

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
});
