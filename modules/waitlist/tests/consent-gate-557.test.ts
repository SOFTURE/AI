// Issue #557: a form without its required consent is refused before the address is read. The refusal
// costs one client attempt (the form cannot probe addresses for free), but no per-address attempt,
// and it writes, looks up and sends nothing.
import { AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { getEmailKey } from "@softure-ai/privacy/server";
import { WAITLIST_RATE_LIMIT_BUCKETS } from "@softure-ai/waitlist";
import { getSignup, joinWaitlist, type JoinWaitlistInput } from "@softure-ai/waitlist/server";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, type TestWaitlist } from "./support.js";

const ADA = "ada@example.com";
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT };
const OTHER_CLIENT = "ip:192.0.2.20";

describe("a missing required consent", () => {
  let test: TestWaitlist | undefined;
  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("is answered before a malformed address", async () => {
    test = await createTestWaitlist();
    expect(await joinWaitlist(test.ctx, { ...JOIN, email: "ada.example.com", scopes: ["newsletter"] })).toEqual({ ok: false, error: "waitlist.consent_required" });
    expect(await joinWaitlist(test.ctx, { ...JOIN, email: "ada.example.com", scopes: [] })).toEqual({ ok: false, error: "waitlist.consent_required" });
  });

  it("costs one client attempt, no attempt of the address, and stores and sends nothing", async () => {
    test = await createTestWaitlist({
      buckets: {
        ...AUTH_RATE_LIMIT_BUCKETS,
        ...PRIVACY_RATE_LIMIT_BUCKETS,
        waitlist: { ...WAITLIST_RATE_LIMIT_BUCKETS.waitlist, limit: 1 },
        "waitlist-email": { ...WAITLIST_RATE_LIMIT_BUCKETS["waitlist-email"], limit: 1 },
      },
    });
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: ["newsletter"] })).toEqual({ ok: false, error: "waitlist.consent_required" });
    expect(await getSignup(test.ctx, ADA)).toBeNull();
    expect(await listConsentRows(test, getEmailKey(ADA))).toEqual([]);
    expect(test.provider.sent).toEqual([]);

    // The client's only attempt is spent: a complete form from it is refused.
    expect(await joinWaitlist(test.ctx, JOIN)).toMatchObject({ ok: false, error: "security.rate_limited" });
    // The address's only attempt is not: it signs up from another client.
    expect((await joinWaitlist(test.ctx, { ...JOIN, clientKey: OTHER_CLIENT })).ok).toBe(true);
  });

  it("leaves a waitlist without a required scope answering a malformed address as before", async () => {
    test = await createTestWaitlist({ waitlist: { scopes: [{ id: "newsletter", label: { en: "News" } }] } });
    expect(await joinWaitlist(test.ctx, { ...JOIN, email: "ada.example.com", scopes: ["newsletter"], placement: "default" })).toEqual({ ok: false, error: "waitlist.email_invalid" });
    expect(await joinWaitlist(test.ctx, { ...JOIN, scopes: [], placement: "default" })).toEqual({ ok: false, error: "waitlist.consent_required" });
  });
});
