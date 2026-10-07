// Session tokens: 32 random bytes in the cookie, only their sha256 in the database. A stolen
// database row cannot be replayed as a cookie.
import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
/** base64url of 32 bytes. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function createSessionToken(): { readonly token: string; readonly tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Whether a cookie value could be a token at all; anything else is not looked up. `legacyPattern`
 * (from `legacySession.tokenPattern`, anchored and without the g or y flag) admits an adopted
 * system's tokens, stored as the same sha256 hex.
 */
export function isSessionTokenShape(token: string, legacyPattern?: RegExp): boolean {
  return TOKEN_SHAPE.test(token) || (legacyPattern?.test(token) ?? false);
}
