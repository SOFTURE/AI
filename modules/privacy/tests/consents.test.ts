// The consent ledger: recording consents and withdrawals with the configured document versions,
// reading the current state, and the database refusing to rewrite evidence.
import { defineSoftureConfig } from "@softure-ai/core";
import { getConsent, getEmailKey, hasConsent, listConsents, recordConsent, type PrivacyContext } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestPrivacy, NOW, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

const LATER = new Date(NOW.getTime() + 60_000);

describe("the consent ledger", () => {
  let test: TestPrivacy;
  let ada: SeededUser;

  beforeEach(async () => {
    test = await createTestPrivacy();
    ada = await seedUser(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  it("records a consent with the document version the config declares", async () => {
    const result = await recordConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter", granted: true, document: "privacy-policy", source: "account" });
    expect(result).toEqual({
      ok: true,
      value: { purpose: "newsletter", granted: true, document: { id: "privacy-policy", version: "2026-09-01" }, source: "account", recordedAt: NOW },
    });
    expect(await getConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter" })).toEqual({ ...(result.ok ? result.value : {}), isCurrentVersion: true });
  });

  it("records a withdrawal as a new row: the state is the latest row, the history keeps both", async () => {
    await recordConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter", granted: true, source: "account" });
    test.clock.set(LATER);
    await recordConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter", granted: false, source: "account" });

    expect(await getConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter" })).toEqual({
      purpose: "newsletter",
      granted: false,
      document: null,
      source: "account",
      recordedAt: LATER,
      isCurrentVersion: true,
    });
    expect(await hasConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter" })).toBe(false);
    const history = await listConsents(test.ctx, { userId: ada.id });
    expect(history.filter((record) => record.purpose === "newsletter").map((record) => [record.granted, record.recordedAt])).toEqual([
      [true, NOW],
      [false, LATER],
    ]);
  });

  it("takes the row recorded last when two share an instant", async () => {
    await recordConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter", granted: false, source: "account" });
    await recordConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter", granted: true, source: "account" });
    expect(await hasConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter" })).toBe(true);
  });

  it("reports a consent to an earlier version of a document as not current", async () => {
    const newerTerms = createConfig({ documents: [{ id: "terms", version: "2026-12-01" }] });
    const ctx: PrivacyContext = { ...test.ctx, config: newerTerms };
    expect(await getConsent(ctx, { subject: { userId: ada.id }, purpose: "terms" })).toMatchObject({
      granted: true,
      document: { id: "terms", version: "2026-09-01" },
      isCurrentVersion: false,
    });
    expect(await hasConsent(ctx, { subject: { userId: ada.id }, purpose: "terms" })).toBe(false);
    // privacy-policy is no longer declared at all: the consent names a document the app dropped.
    expect(await hasConsent(ctx, { subject: { userId: ada.id }, purpose: "privacy-policy" })).toBe(false);
    expect(await hasConsent(test.ctx, { subject: { userId: ada.id }, purpose: "terms" })).toBe(true);
  });

  it("records the consent of an email address without an account, under its key only", async () => {
    const result = await recordConsent(test.ctx, { subject: { email: "  Eve@Example.com " }, purpose: "newsletter", granted: true, source: "waitlist" });
    expect(result.ok).toBe(true);
    expect(await hasConsent(test.ctx, { subject: { email: "eve@example.com" }, purpose: "newsletter" })).toBe(true);
    const rows = await test.database.client.query("SELECT user_id, email_key FROM privacy.consents WHERE source = 'waitlist'");
    expect(rows.rows).toEqual([{ user_id: null, email_key: getEmailKey("eve@example.com") }]);
    expect(getEmailKey("eve@example.com")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("names an email subject by its key alone, the same subject as its address", async () => {
    const key = getEmailKey("eve@example.com");
    await recordConsent(test.ctx, { subject: { email: "Eve@example.com" }, purpose: "newsletter", granted: true, source: "waitlist" });
    const result = await recordConsent(test.ctx, { subject: { emailKey: key }, purpose: "newsletter", granted: false, source: "unsubscribe" });
    expect(result.ok).toBe(true);
    expect(await getConsent(test.ctx, { subject: { emailKey: key }, purpose: "newsletter" })).toMatchObject({ granted: false, source: "unsubscribe" });
    expect(await hasConsent(test.ctx, { subject: { email: "eve@example.com" }, purpose: "newsletter" })).toBe(false);
    expect((await listConsents(test.ctx, { emailKey: key })).map((record) => `${record.source} ${String(record.granted)}`)).toEqual(["waitlist true", "unsubscribe false"]);
  });

  it("keeps an account's consents and its email's consents apart when reading", async () => {
    await recordConsent(test.ctx, { subject: { email: ada.email }, purpose: "newsletter", granted: true, source: "waitlist" });
    expect(await hasConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter" })).toBe(false);
    expect(await hasConsent(test.ctx, { subject: { email: ada.email }, purpose: "newsletter" })).toBe(true);
  });

  it("has no state for a purpose never recorded, or a subject that names nobody", async () => {
    expect(await getConsent(test.ctx, { subject: { userId: ada.id }, purpose: "newsletter" })).toBeNull();
    expect(await getConsent(test.ctx, { subject: { userId: "not-a-uuid" }, purpose: "terms" })).toBeNull();
    expect(await getConsent(test.ctx, { subject: { email: "not an address" }, purpose: "terms" })).toBeNull();
    expect(await listConsents(test.ctx, { email: "not an address" })).toEqual([]);
    expect(await getConsent(test.ctx, { subject: { emailKey: "eve@example.com" }, purpose: "terms" })).toBeNull();
    expect(await listConsents(test.ctx, { emailKey: "short" })).toEqual([]);
  });

  it.each([
    ["a user id that is not a UUID", { subject: { userId: "42" }, purpose: "terms", source: "account" }],
    ["an email that is not an address", { subject: { email: "ada" }, purpose: "terms", source: "account" }],
    ["an email key that is not a SHA-256 digest", { subject: { emailKey: "ada@example.com" }, purpose: "terms", source: "account" }],
    ["a purpose that is not kebab-case", { subject: { email: "ada@example.com" }, purpose: "Terms of Service", source: "account" }],
    ["a purpose longer than 64 characters", { subject: { email: "ada@example.com" }, purpose: "a".repeat(65), source: "account" }],
    ["a source that is not kebab-case", { subject: { email: "ada@example.com" }, purpose: "terms", source: "sign up" }],
  ])("refuses %s with privacy.consent_invalid", async (_case, input) => {
    expect(await recordConsent(test.ctx, { ...input, granted: true })).toEqual({ ok: false, error: "privacy.consent_invalid" });
  });

  it("refuses a document the config does not declare", async () => {
    expect(await recordConsent(test.ctx, { subject: { userId: ada.id }, purpose: "cookies", granted: true, document: "cookie-policy", source: "account" })).toEqual({
      ok: false,
      error: "privacy.document_unknown",
    });
  });

  it("refuses to update a row: the evidence of an earlier consent cannot be rewritten", async () => {
    await expect(test.database.client.query("UPDATE privacy.consents SET granted = false")).rejects.toThrow(/privacy\.consents is append-only/);
    expect(await hasConsent(test.ctx, { subject: { userId: ada.id }, purpose: "terms" })).toBe(true);
  });

  it("refuses a row with both subjects, with none, or with a document and no version", async () => {
    const insert = (columns: string) =>
      test.database.client.query(`INSERT INTO privacy.consents (user_id, email_key, purpose, granted, document_id, document_version, source, recorded_at) VALUES (${columns}, now())`);
    const key = getEmailKey("ada@example.com");
    await expect(insert(`'${ada.id}', '${key}', 'terms', true, NULL, NULL, 'account'`)).rejects.toThrow(/consents_one_subject/);
    await expect(insert(`NULL, NULL, 'terms', true, NULL, NULL, 'account'`)).rejects.toThrow(/consents_one_subject/);
    await expect(insert(`'${ada.id}', NULL, 'terms', true, 'terms', NULL, 'account'`)).rejects.toThrow(/consents_document_with_version/);
  });
});

describe("recordConsent without the module", () => {
  it("throws a clear error: calling it then is a bug", async () => {
    const config = defineSoftureConfig({ database: null, locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [] });
    const ctx = { db: {}, clock: { now: () => NOW }, config } as unknown as PrivacyContext;
    await expect(recordConsent(ctx, { subject: { email: "ada@example.com" }, purpose: "terms", granted: true, document: "terms", source: "account" })).rejects.toThrow(
      "@softure-ai/privacy: the module is not enabled",
    );
  });
});
