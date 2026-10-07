// PKCE S256 (RFC 7636 §4.6), the only method accepted: OAuth 2.1 and the MCP authorization spec
// require it, and `plain` hands the verifier to anyone who saw the authorization URL.
import { createHash, timingSafeEqual } from "node:crypto";

export const PKCE_METHOD = "S256";

/** RFC 7636 §4.1: 43 to 128 unreserved characters. A shorter one carries too little entropy. */
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
/** base64url of a sha256 without padding: always 43 characters. */
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isValidCodeChallenge(challenge: string): boolean {
  return CHALLENGE_PATTERN.test(challenge);
}

/** `BASE64URL(SHA256(ASCII(code_verifier)))`. */
export function getCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** Whether the verifier matches the challenge stored with the code; compared in constant time. */
export function isPkceVerifierValid(verifier: string, challenge: string): boolean {
  if (!VERIFIER_PATTERN.test(verifier) || !isValidCodeChallenge(challenge)) return false;
  const expected = Buffer.from(challenge);
  const actual = Buffer.from(getCodeChallenge(verifier));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
