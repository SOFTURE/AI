// The registration hook: an account and the evidence of its consent are created together, or not at all.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { registerUser } from "@softure-ai/auth/server";
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS, type PrivacyOptionsInput } from "@softure-ai/privacy";
import { listConsents, recordRegistrationConsent, type RegistrationConsentOptions } from "@softure-ai/privacy/server";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createTestPrivacy, DOCUMENTS, NOW, PASSWORD, type TestPrivacy } from "./support.js";

function createRegistrationConfig(options: {
  privacy?: PrivacyOptionsInput;
  hook?: RegistrationConsentOptions;
  requireConsent?: boolean;
}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "America/New_York",
    appOrigin: "http://localhost:3000",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({
        password: { scrypt: { cost: 2 ** 10 } },
        requireConsent: options.requireConsent ?? true,
        onRegistered: recordRegistrationConsent(options.hook),
      }),
      privacy(options.privacy ?? { documents: DOCUMENTS }),
    ],
  });
}

describe("recordRegistrationConsent", () => {
  let test: TestPrivacy | undefined;
  afterEach(() => test?.database.close());

  async function register(config: SoftureConfig, email = "ada@example.com") {
    test = await createTestPrivacy(config);
    return registerUser(test.ctx, { email, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
  }

  async function countAccounts(): Promise<number> {
    const result = await test?.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM auth.users");
    return result?.rows[0]?.count ?? -1;
  }

  it("records every declared document, with its version, at the account's creation time", async () => {
    const registered = await register(createRegistrationConfig({}));
    if (!registered.ok || test === undefined) throw new Error("registration failed");
    expect(await listConsents(test.ctx, { userId: registered.value.user.id })).toEqual([
      { purpose: "terms", granted: true, document: { id: "terms", version: "2026-09-01" }, source: "registration", recordedAt: NOW },
      { purpose: "privacy-policy", granted: true, document: { id: "privacy-policy", version: "2026-09-01" }, source: "registration", recordedAt: NOW },
    ]);
  });

  it("records only the documents it is given", async () => {
    const registered = await register(createRegistrationConfig({ hook: { documents: ["terms"] } }));
    if (!registered.ok || test === undefined) throw new Error("registration failed");
    expect((await listConsents(test.ctx, { userId: registered.value.user.id })).map((record) => record.purpose)).toEqual(["terms"]);
  });

  it("records nothing when the app does not ask for consent", async () => {
    const registered = await register(createRegistrationConfig({ requireConsent: false }));
    if (!registered.ok || test === undefined) throw new Error("registration failed");
    expect(await listConsents(test.ctx, { userId: registered.value.user.id })).toEqual([]);
  });

  it("rolls the account back when no document is declared", async () => {
    await expect(register(createRegistrationConfig({ privacy: {} }))).rejects.toThrow(
      "@softure-ai/privacy: recordRegistrationConsent() has no document to record; declare them in privacy({ documents })",
    );
    expect(await countAccounts()).toBe(0);
  });

  it("rolls the account back when it names a document the config does not declare", async () => {
    await expect(register(createRegistrationConfig({ hook: { documents: ["terms", "cookie-policy"] } }))).rejects.toThrow(
      '@softure-ai/privacy: recording the registration consent to "cookie-policy" failed: privacy.document_unknown',
    );
    expect(await countAccounts()).toBe(0);
    const consents = await test?.database.client.query("SELECT 1 FROM privacy.consents");
    expect(consents?.rows).toEqual([]);
  });
});
