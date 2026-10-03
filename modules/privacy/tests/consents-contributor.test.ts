// The module's own contributor: a user's consents in their export, and gone with their account,
// including the ones their email address gave before the account existed.
import { privacy } from "@softure-ai/privacy";
import { collectUserData, eraseUserData, getEmailKey, recordConsent } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestPrivacy, DOCUMENTS, NOW, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

describe("the consents contributor", () => {
  let test: TestPrivacy;
  let ada: SeededUser;
  let bob: SeededUser;

  const countRows = async (condition: string, value: string) =>
    (await test.database.client.query<{ count: number }>(`SELECT count(*)::int AS count FROM privacy.consents WHERE ${condition} = $1`, [value])).rows[0]?.count;

  beforeEach(async () => {
    test = await createTestPrivacy();
    ada = await seedUser(test, "ada@example.com");
    bob = await seedUser(test, "bob@example.com");
    // Ada joined the waitlist before registering; Bob too.
    await recordConsent(test.ctx, { subject: { email: "ADA@example.com" }, purpose: "newsletter", granted: true, source: "waitlist" });
    await recordConsent(test.ctx, { subject: { email: bob.email }, purpose: "newsletter", granted: true, source: "waitlist" });
  });
  afterEach(() => test.database.close());

  it("exports the account's consents and its email's, marked by subject", async () => {
    const result = await collectUserData(test.ctx, ada.id);
    if (!result.ok) throw new Error(result.error);
    const consents = (result.value.document.data["privacy"] as { consents: { purpose: string; subject: string; recordedAt: Date }[] }).consents;
    expect(consents.map(({ purpose, subject }) => `${subject}:${purpose}`)).toEqual(["account:terms", "account:privacy-policy", "email:newsletter"]);
    expect(result.value.json).not.toContain(getEmailKey(ada.email));
  });

  it("deletes the account's consents and its email's, and nobody else's", async () => {
    expect(await eraseUserData(test.ctx, ada.id)).toEqual({ ok: true, value: undefined });
    expect(await countRows("user_id", ada.id)).toBe(0);
    expect(await countRows("email_key", getEmailKey(ada.email))).toBe(0);
    expect(await countRows("user_id", bob.id)).toBe(DOCUMENTS.length);
    expect(await countRows("email_key", getEmailKey(bob.email))).toBe(1);
  });

  it("has nothing for an id that is not an account", async () => {
    const contributor = privacy().privacy;
    expect(await contributor?.exportUserData?.(test.ctx, "00000000-0000-4000-8000-000000000000")).toEqual({ ok: true, value: { consents: [] } });
    expect(await contributor?.exportUserData?.(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: { consents: [] } });
    expect(await contributor?.deleteUserData?.(test.ctx, "not-a-uuid")).toEqual({ ok: true, value: undefined });
    expect(await countRows("user_id", ada.id)).toBe(DOCUMENTS.length);
  });

  it("dates the records as they were recorded", async () => {
    const result = await collectUserData(test.ctx, ada.id);
    if (!result.ok) throw new Error(result.error);
    const parsed = JSON.parse(result.value.json) as { data: { privacy: { consents: { recordedAt: string }[] } } };
    expect(parsed.data.privacy.consents.map((record) => record.recordedAt)).toEqual([NOW, NOW, NOW].map((date) => date.toISOString()));
  });
});

describe("the privacy health check", () => {
  it("passes once the table exists and throws without it", async () => {
    const test = await createTestPrivacy();
    try {
      expect(await privacy().health?.(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.query("DROP TABLE privacy.consents");
      await expect(privacy().health?.(test.ctx)).rejects.toThrow(/privacy\.consents/);
    } finally {
      await test.database.close();
    }
  });
});
