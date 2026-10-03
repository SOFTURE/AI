// Confirmation link tokens: 32 random bytes in the link, only their sha256 in the database, so a
// leaked row cannot be turned back into a working link. The same shape as auth's reset tokens.
import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
/** base64url of 32 bytes. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function createConfirmationToken(): { readonly token: string; readonly tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashConfirmationToken(token) };
}

export function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Whether a value could be a token at all; anything else is not looked up. */
export function isConfirmationTokenShape(token: string): boolean {
  return TOKEN_SHAPE.test(token);
}
