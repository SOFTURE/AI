// The key an email subject is stored under. The same derivation, constants and secret as `getRecipientKey` of
// `@softure-ai/mailing`: an unsubscribe carries only mailing's recipient key, and the consents of that address are
// found under this key (`@softure-ai/waitlist` relies on the two being equal, and its tests pin it).
import { pbkdf2Sync } from "node:crypto";
import { memoizeByContent, SoftureConfigError } from "@softure-ai/core";

/** Keys every email subject. Never rotate it: a new value orphans every stored key. */
export const EMAIL_KEY_SECRET_ENV = "SOFTURE_EMAIL_KEY_SECRET";
/** A shorter secret counts as missing. */
export const MIN_EMAIL_KEY_SECRET_LENGTH = 32;
/** PBKDF2 rounds: about 2 ms per key. The secret is the protection; the rounds slow a search if it leaks. */
export const EMAIL_KEY_ITERATIONS = 10_000;
const EMAIL_KEY_SALT_PREFIX = "softure.email-key.v1:";

export type Env = Readonly<Record<string, string | undefined>>;

const deriveEmailKey = memoizeByContent(
  (normalized: string, secret: string): string =>
    pbkdf2Sync(normalized, `${EMAIL_KEY_SALT_PREFIX}${secret}`, EMAIL_KEY_ITERATIONS, 32, "sha256").toString("base64url"),
  { max: 10_000 },
);

/** The secret from the environment; one shorter than 32 characters reads as not set. */
export function readEmailKeySecret(env: Env = process.env): string | null {
  const value = env[EMAIL_KEY_SECRET_ENV];
  return value !== undefined && value.length >= MIN_EMAIL_KEY_SECRET_LENGTH ? value : null;
}

/**
 * The key an email subject is stored under: base64url PBKDF2-HMAC-SHA256 of the trimmed, lowercased address, keyed by
 * `SOFTURE_EMAIL_KEY_SECRET` (43 characters). The table holds no address, and without the secret no key can be matched
 * to one. Throws a `SoftureConfigError` when the secret is missing or short.
 */
export function getEmailKey(email: string, env: Env = process.env): string {
  const secret = readEmailKeySecret(env);
  if (secret === null) {
    throw new SoftureConfigError("the environment", [
      `${EMAIL_KEY_SECRET_ENV}: required to key email subjects, at least ${String(MIN_EMAIL_KEY_SECRET_LENGTH)} characters`,
    ]);
  }
  return deriveEmailKey(email.trim().toLowerCase(), secret);
}
