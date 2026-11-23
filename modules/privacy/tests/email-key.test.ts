// The key of an email subject: keyed by SOFTURE_EMAIL_KEY_SECRET, the same bytes as mailing's recipient key.
import { pbkdf2Sync } from "node:crypto";
import { SoftureConfigError } from "@softure-ai/core";
import { EMAIL_KEY_ITERATIONS, getEmailKey, readEmailKeySecret } from "@softure-ai/privacy/server";
import { describe, expect, it } from "vitest";

const SECRET = "an-email-key-secret-of-32-chars!";
const ENV = { SOFTURE_EMAIL_KEY_SECRET: SECRET };
// Computed apart from the module, so a change of the derivation fails here (stored keys would all be orphaned).
const EVE_KEY = pbkdf2Sync("eve@example.com", `softure.email-key.v1:${SECRET}`, 10_000, 32, "sha256").toString("base64url");

describe("getEmailKey", () => {
  it("is the unpadded base64url PBKDF2-HMAC-SHA256 of the trimmed, lowercased address, keyed by the secret", () => {
    expect(EMAIL_KEY_ITERATIONS).toBe(10_000);
    expect(getEmailKey("  Eve@Example.COM ", ENV)).toBe(EVE_KEY);
    expect(EVE_KEY).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("differs per address and per secret", () => {
    expect(getEmailKey("bob@example.com", ENV)).not.toBe(EVE_KEY);
    expect(getEmailKey("eve@example.com", { SOFTURE_EMAIL_KEY_SECRET: "another-email-key-secret-32-chrs" })).not.toBe(EVE_KEY);
  });

  it.each([
    ["missing", {}],
    ["31 characters", { SOFTURE_EMAIL_KEY_SECRET: SECRET.slice(1) }],
  ])("throws a configuration error naming the variable when the secret is %s", (_case, env) => {
    expect(readEmailKeySecret(env)).toBeNull();
    expect(() => getEmailKey("eve@example.com", env)).toThrow(SoftureConfigError);
    expect(() => getEmailKey("eve@example.com", env)).toThrow(/SOFTURE_EMAIL_KEY_SECRET: required to key email subjects, at least 32 characters/);
  });
});
