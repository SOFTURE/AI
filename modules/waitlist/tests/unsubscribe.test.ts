// The consent ledger follows mailing's suppression list: an unsubscribe through the signed link
// withdraws the waitlist's scopes (the hook wired in support.ts), and signing up again lifts the
// address's own opt-out only through a confirmation link (double opt-in), storing exactly the scopes
// checked this time; without double opt-in it changes nothing.
import { getRecipientKey, isSuppressed, signRecipientKey, suppressRecipient, unsubscribe } from "@softure-ai/mailing/server";
import { getEmailKey, hasConsent } from "@softure-ai/privacy/server";
import { confirmSignup, getSignup, joinWaitlist, withdrawWaitlistConsents, type JoinWaitlistInput } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, OPTIONS, SECRET, type TestWaitlist } from "./support.js";

const LATER = new Date(NOW.getTime() + 60_000);
const MUCH_LATER = new Date(NOW.getTime() + 120_000);
const ADA = "ada@example.com";
const ADA_KEY = getRecipientKey(ADA);
const ENV = { MAILING_UNSUBSCRIBE_SECRET: SECRET };
const ADA_TOKEN = { recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, SECRET) };
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch", "newsletter"], placement: "hero", clientKey: CLIENT };

async function readLedger(test: TestWaitlist): Promise<string[]> {
  return (await listConsentRows(test, getEmailKey(ADA))).map((row) => `${row.purpose} ${String(row.granted)} ${row.source}`);
}

describe("an unsubscribe and the waitlist's consents", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist();
  });
  afterEach(() => test.database.close());

  it("uses one key for an address in mailing and in privacy", () => {
    expect(getRecipientKey("  Ada@Example.COM ")).toBe(getEmailKey("ada@example.com"));
  });

  it("withdraws every granted scope in the unsubscribe's transaction", async () => {
    await joinWaitlist(test.ctx, JOIN);
    test.clock.set(LATER);
    expect(await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV)).toEqual({ ok: true, value: undefined });

    expect(await readLedger(test)).toEqual(["launch true waitlist", "newsletter true waitlist", "launch false unsubscribe", "newsletter false unsubscribe"]);
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "launch" })).toBe(false);
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });

  it("records nothing more when the same link is used again", async () => {
    await joinWaitlist(test.ctx, JOIN);
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    await unsubscribe(test.ctx, ADA_TOKEN, "one-click", ENV);
    expect(await readLedger(test)).toHaveLength(4);
  });

  it("withdraws only what was granted, and nothing for an address that never signed up", async () => {
    await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch"] });
    await withdrawWaitlistConsents({ recipientKey: ADA_KEY, source: "page", link: { scheme: "signed" } }, test.ctx);
    expect(await readLedger(test)).toEqual(["launch true waitlist", "launch false unsubscribe"]);

    await withdrawWaitlistConsents({ recipientKey: getRecipientKey("bob@example.com"), source: "page", link: { scheme: "signed" } }, test.ctx);
    expect(await listConsentRows(test, getEmailKey("bob@example.com"))).toEqual([]);
  });

  it("lifts the opt-out only through a confirmed sign-up, granting again only the scopes checked now", async () => {
    await test.database.close();
    test = await createTestWaitlist({ waitlist: { ...OPTIONS, doubleOptIn: true } });
    const first = await joinWaitlist(test.ctx, JOIN);
    if (!first.ok || first.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
    await confirmSignup(test.ctx, { token: first.value.token, clientKey: CLIENT });
    test.clock.set(LATER);
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    test.clock.set(MUCH_LATER);

    const again = await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch"] });
    if (!again.ok || again.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
    const confirmed = await confirmSignup(test.ctx, { token: again.value.token, clientKey: CLIENT });
    expect(confirmed.ok && confirmed.value).toMatchObject({ recordedScopes: ["launch"], signup: { scopes: ["launch"], updatedAt: MUCH_LATER } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(false);
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "launch" })).toBe(true);
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "newsletter" })).toBe(false);
  });

  it("keeps the opt-out and changes nothing on a sign-up without double opt-in", async () => {
    await joinWaitlist(test.ctx, JOIN);
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    const ledger = await readLedger(test);
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch"] })).toEqual({ ok: true, value: { status: "suppressed" } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
    expect(await readLedger(test)).toEqual(ledger);
  });

  it("keeps an operator's suppression and widens nothing", async () => {
    await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch"] });
    await suppressRecipient(test.ctx, ADA);
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["newsletter", "launch"] })).toEqual({ ok: true, value: { status: "suppressed" } });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ scopes: ["launch"] });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });

  it("keeps the opt-out when the sign-up is refused", async () => {
    await joinWaitlist(test.ctx, JOIN);
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["newsletter"] })).toEqual({ ok: false, error: "waitlist.consent_required" });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });
});
