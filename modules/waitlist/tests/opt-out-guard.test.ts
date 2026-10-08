// Without double opt-in, nothing proves that whoever types an address into the form controls it,
// so a sign-up of an address on mailing's suppression list writes nothing and lifts nothing: it
// answers `suppressed`. With double opt-in, the link proves control and lifts the opt-out.
import { suppressRecipient, isSuppressed } from "@softure-ai/mailing/server";
import type { SuppressionSource } from "@softure-ai/mailing";
import { getEmailKey } from "@softure-ai/privacy/server";
import type { WaitlistJoinedEvent } from "@softure-ai/waitlist";
import { confirmSignup, getSignup, joinWaitlist, type JoinWaitlistInput } from "@softure-ai/waitlist/server";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, OPTIONS, type TestWaitlist } from "./support.js";

const LATER = new Date(NOW.getTime() + 60_000);
const ADA = "ada@example.com";
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT };
const SOURCES: readonly SuppressionSource[] = ["page", "one-click", "operator"];

let test: TestWaitlist | undefined;

afterEach(async () => {
  await test?.database.close();
  test = undefined;
});

async function createWithHook(doubleOptIn = false): Promise<{ test: TestWaitlist; joined: WaitlistJoinedEvent[] }> {
  const joined: WaitlistJoinedEvent[] = [];
  test = await createTestWaitlist({ waitlist: { ...OPTIONS, doubleOptIn, onJoined: (event) => void joined.push(event) } });
  return { test, joined };
}

async function readLedger(target: TestWaitlist): Promise<string[]> {
  return (await listConsentRows(target, getEmailKey(ADA))).map((row) => `${row.purpose} ${String(row.granted)} ${row.source}`);
}

describe("a sign-up of a suppressed address without double opt-in", () => {
  it.each(SOURCES)("writes nothing for an address that never signed up and is suppressed (%s)", async (source) => {
    const { test, joined } = await createWithHook();
    await suppressRecipient(test.ctx, ADA, source);

    expect(await joinWaitlist(test.ctx, { ...JOIN, email: " ADA@example.com " })).toEqual({ ok: true, value: { status: "suppressed" } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
    expect(await getSignup(test.ctx, ADA)).toBeNull();
    expect(await readLedger(test)).toEqual([]);
    expect(joined).toEqual([]);
  });

  it.each(SOURCES)("leaves a known sign-up, its scopes and its consents as they were once suppressed (%s)", async (source) => {
    const { test, joined } = await createWithHook();
    await joinWaitlist(test.ctx, JOIN);
    const before = await getSignup(test.ctx, ADA);
    await suppressRecipient(test.ctx, ADA, source);
    const ledger = await readLedger(test);
    test.clock.set(LATER);

    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch", "newsletter"] })).toEqual({ ok: true, value: { status: "suppressed" } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
    expect(await getSignup(test.ctx, ADA)).toEqual(before);
    expect(await readLedger(test)).toEqual(ledger);
    expect(joined).toHaveLength(1);
  });

  it("still answers a refused form with its refusal", async () => {
    const { test } = await createWithHook();
    await suppressRecipient(test.ctx, ADA, "page");
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["newsletter"] })).toEqual({ ok: false, error: "waitlist.consent_required" });
    expect(await joinWaitlist(test.ctx, { ...JOIN, email: "not-an-address" })).toEqual({ ok: false, error: "waitlist.email_invalid" });
  });

  it("signs up an address once its suppression is gone, as any new address", async () => {
    const { test, joined } = await createWithHook();
    await joinWaitlist(test.ctx, { ...JOIN, email: "bob@example.com" });
    await suppressRecipient(test.ctx, ADA, "page");

    const result = await joinWaitlist(test.ctx, { ...JOIN, email: "bob@example.com", scopes: ["launch", "newsletter"] });
    expect(result.ok && result.value).toMatchObject({ status: "joined", isNew: false, recordedScopes: ["newsletter"] });
    expect(joined).toHaveLength(1);
  });
});

describe("a sign-up of a suppressed address with double opt-in", () => {
  it("waits for its link, which lifts the person's own opt-out and grants what was checked", async () => {
    const { test, joined } = await createWithHook(true);
    await suppressRecipient(test.ctx, ADA, "one-click");

    const pending = await joinWaitlist(test.ctx, JOIN);
    if (!pending.ok || pending.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);

    expect(await confirmSignup(test.ctx, { token: pending.value.token, clientKey: CLIENT })).toMatchObject({ ok: true, value: { recordedScopes: ["launch"] } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(false);
    expect(joined).toHaveLength(1);
  });

  it("keeps an operator's suppression when the link is used", async () => {
    const { test } = await createWithHook(true);
    await suppressRecipient(test.ctx, ADA);
    const pending = await joinWaitlist(test.ctx, JOIN);
    if (!pending.ok || pending.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
    await confirmSignup(test.ctx, { token: pending.value.token, clientKey: CLIENT });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });
});
