// The consent ledger follows mailing's suppression list: an unsubscribe through the signed link
// withdraws the waitlist's scopes (the hook wired in support.ts), and signing up again lifts the
// address's own opt-out and stores exactly the scopes checked this time.
import { getRecipientKey, isSuppressed, signRecipientKey, suppressRecipient, unsubscribe } from "@softure-ai/mailing/server";
import { getEmailKey, hasConsent } from "@softure-ai/privacy/server";
import { joinWaitlist, withdrawWaitlistConsents, type JoinWaitlistInput } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, SECRET, type TestWaitlist } from "./support.js";

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
    await withdrawWaitlistConsents({ recipientKey: ADA_KEY, source: "page" }, test.ctx);
    expect(await readLedger(test)).toEqual(["launch true waitlist", "launch false unsubscribe"]);

    await withdrawWaitlistConsents({ recipientKey: getRecipientKey("bob@example.com"), source: "page" }, test.ctx);
    expect(await listConsentRows(test, getEmailKey("bob@example.com"))).toEqual([]);
  });

  it("lifts the opt-out on a new sign-up, grants again and stores only the scopes checked now", async () => {
    await joinWaitlist(test.ctx, JOIN);
    test.clock.set(LATER);
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    test.clock.set(MUCH_LATER);

    const again = await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch"] });
    expect(again.ok && again.value).toMatchObject({ status: "joined", isNew: false, recordedScopes: ["launch"], signup: { scopes: ["launch"], updatedAt: MUCH_LATER } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(false);
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "launch" })).toBe(true);
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "newsletter" })).toBe(false);
  });

  it("keeps an operator's suppression and widens as usual", async () => {
    await joinWaitlist(test.ctx, { ...JOIN, scopes: ["launch"] });
    await suppressRecipient(test.ctx, ADA);
    const again = await joinWaitlist(test.ctx, { ...JOIN, scopes: ["newsletter", "launch"] });
    expect(again.ok && again.value.signup.scopes).toEqual(["launch", "newsletter"]);
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });

  it("keeps the opt-out when the sign-up is refused", async () => {
    await joinWaitlist(test.ctx, JOIN);
    await unsubscribe(test.ctx, ADA_TOKEN, "page", ENV);
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["newsletter"] })).toEqual({ ok: false, error: "waitlist.consent_required" });
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });
});
