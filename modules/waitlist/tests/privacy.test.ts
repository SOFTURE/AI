// The waitlist's part of a GDPR export and deletion: the sign-up of the account's email address,
// next to privacy's own part (the consents the sign-up recorded).
import { registerUser } from "@softure-ai/auth/server";
import { collectUserData, eraseUserData, getEmailKey } from "@softure-ai/privacy/server";
import { exportWaitlistUserData, getSignup, joinWaitlist } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, type TestWaitlist } from "./support.js";

const PASSWORD = "correct horse battery";

describe("the waitlist privacy contributor", () => {
  let test: TestWaitlist;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestWaitlist();
    for (const email of ["ada@example.com", "eve@example.com"]) {
      const joined = await joinWaitlist(test.ctx, { email, scopes: ["launch", "newsletter"], placement: "footer", clientKey: CLIENT });
      if (!joined.ok) throw new Error(`joining failed with ${joined.error}`);
    }
    // Ada creates an account later, with her address in another case.
    const registered = await registerUser(test.ctx, { email: "Ada@Example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`registration failed with ${registered.error}`);
    adaId = registered.value.user.id;
  });
  afterEach(() => test.database.close());

  it("exports the sign-up of the account's email, and privacy exports its consents", async () => {
    const collected = await collectUserData(test.ctx, adaId);
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    const data = JSON.parse(collected.value.json) as { data: Record<string, unknown> };
    expect(data.data.waitlist).toEqual({ signup: { scopes: ["launch", "newsletter"], placement: "footer", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), confirmedAt: NOW.toISOString(), pendingScopes: null } });
    expect((data.data.privacy as { consents: { purpose: string; source: string }[] }).consents.map((consent) => [consent.purpose, consent.source])).toEqual([
      ["launch", "waitlist"],
      ["newsletter", "waitlist"],
    ]);
  });

  it("exports nothing for an account without a sign-up, an unknown id or a malformed one", async () => {
    const registered = await registerUser(test.ctx, { email: "bob@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`registration failed with ${registered.error}`);
    expect(await exportWaitlistUserData(test.ctx, registered.value.user.id)).toEqual({ ok: true, value: { signup: null } });
    expect(await exportWaitlistUserData(test.ctx, "00000000-0000-4000-8000-000000000000")).toEqual({ ok: true, value: { signup: null } });
    expect(await exportWaitlistUserData(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: { signup: null } });
  });

  it("deletes the account's sign-up and its consents with the account, and leaves other sign-ups alone", async () => {
    expect(await eraseUserData(test.ctx, adaId)).toEqual({ ok: true, value: undefined });
    expect(await getSignup(test.ctx, "ada@example.com")).toBeNull();
    expect(await listConsentRows(test, getEmailKey("ada@example.com"))).toEqual([]);
    expect((await getSignup(test.ctx, "eve@example.com"))?.scopes).toEqual(["launch", "newsletter"]);
    expect(await listConsentRows(test, getEmailKey("eve@example.com"))).toHaveLength(2);
  });
});
