// Signed unsubscribe links. Ported from FIRE_TRACKER `src/lib/unsubscribe-link.ts`, with two
// changes: the link carries a hash of the address instead of a waitlist row id (the module has no
// recipient table, and the address never appears in a URL), and a previous secret keeps verifying
// during a rotation. The whole link is a credential: whoever has it can unsubscribe that address,
// so it never reaches a log, an error or a result.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SoftureConfig } from "@softure-ai/core";
import { getMailingRoutes } from "./options.js";

/** Signs every new link and verifies. */
export const UNSUBSCRIBE_SECRET_ENV = "MAILING_UNSUBSCRIBE_SECRET";
/** Optional: verifies links signed before a rotation, never signs. */
export const UNSUBSCRIBE_PREVIOUS_SECRET_ENV = "MAILING_UNSUBSCRIBE_SECRET_PREVIOUS";
/** A shorter secret counts as missing: a guessable key lets anyone mint links. */
export const MIN_UNSUBSCRIBE_SECRET_LENGTH = 32;

/** The query parameters of both links. */
export const RECIPIENT_PARAM = "r";
export const SIGNATURE_PARAM = "t";

/**
 * Domain separation: the same key signing anything else can never produce a valid unsubscribe
 * signature. Changing it voids every link already sent, exactly like changing the key.
 */
const SIGNED_PREFIX = "softure.mailing.unsubscribe.v1:";

/** 32 bytes in unpadded base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type Env = Readonly<Record<string, string | undefined>>;

/** The key pair a link carries: the recipient key and its signature. */
export interface UnsubscribeToken {
  readonly recipientKey: string;
  readonly signature: string;
}

/** Both links of one mail: the same token, two targets. */
export interface UnsubscribeLinks {
  /** The page with a button, for the mail's footer (opening it changes nothing). */
  readonly page: string;
  /** The RFC 8058 one-click target, for the `List-Unsubscribe` header. */
  readonly oneClick: string;
}

/** The secrets in use: `current` signs, both verify. `current` is null when it is not set. */
export interface UnsubscribeSecrets {
  readonly current: string | null;
  readonly previous: string | null;
}

/**
 * The stored and linked identity of an address: base64url SHA-256 of the trimmed, lowercased
 * address. Lowercasing the local part merges `Ada@` and `ada@`, which errs on the side of not
 * mailing someone who opted out.
 */
export function getRecipientKey(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("base64url");
}

/** The signature of a recipient key. */
export function signRecipientKey(recipientKey: string, secret: string): string {
  return createHmac("sha256", secret).update(`${SIGNED_PREFIX}${recipientKey}`).digest("base64url");
}

/** The secrets from the environment; one shorter than 32 characters reads as not set. */
export function readUnsubscribeSecrets(env: Env = process.env): UnsubscribeSecrets {
  return { current: readSecret(env[UNSUBSCRIBE_SECRET_ENV]), previous: readSecret(env[UNSUBSCRIBE_PREVIOUS_SECRET_ENV]) };
}

function readSecret(value: string | undefined): string | null {
  return value !== undefined && value.length >= MIN_UNSUBSCRIBE_SECRET_LENGTH ? value : null;
}

/**
 * Whether the token was signed by the current or the previous secret. Never throws: the shape is
 * checked first (`timingSafeEqual` throws on buffers of different lengths, and a throw would be a
 * second, faster answer), then every secret is compared in constant time.
 */
export function verifyUnsubscribeToken(token: UnsubscribeToken, secrets: UnsubscribeSecrets): boolean {
  if (!TOKEN_PATTERN.test(token.recipientKey) || !TOKEN_PATTERN.test(token.signature)) return false;
  const candidate = Buffer.from(token.signature, "base64url");
  let isValid = false;
  for (const secret of [secrets.current, secrets.previous]) {
    if (secret === null) continue;
    const expected = Buffer.from(signRecipientKey(token.recipientKey, secret), "base64url");
    // No early exit: both comparisons run whichever matches.
    isValid = timingSafeEqual(candidate, expected) || isValid;
  }
  return isValid;
}

/** The two links for `address`, on the app's origin and the module's routes. */
export function buildUnsubscribeLinks(config: SoftureConfig, address: string, secret: string): UnsubscribeLinks {
  const recipientKey = getRecipientKey(address);
  const query = new URLSearchParams({ [RECIPIENT_PARAM]: recipientKey, [SIGNATURE_PARAM]: signRecipientKey(recipientKey, secret) });
  const routes = getMailingRoutes(config);
  return {
    page: `${config.appOrigin}${routes.unsubscribe}?${query.toString()}`,
    oneClick: `${config.appOrigin}${routes.oneClick}?${query.toString()}`,
  };
}

/** The token in a link's query (or a form), when both parameters are present once. */
export function readUnsubscribeToken(params: { get(name: string): unknown }): UnsubscribeToken | null {
  const recipientKey = params.get(RECIPIENT_PARAM);
  const signature = params.get(SIGNATURE_PARAM);
  return typeof recipientKey === "string" && typeof signature === "string" ? { recipientKey, signature } : null;
}
