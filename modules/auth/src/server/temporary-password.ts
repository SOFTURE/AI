// Temporary passwords an operator hands over: random characters drawn uniformly with `randomInt`
// from `node:crypto`. The same function serves the `set-temporary-password` script and an
// operator's local half, which hashes the password with `hashPassword` and gives the script only
// the hash, so the plain password never reaches the server.
import { randomInt } from "node:crypto";

/** The URL-safe base64 alphabet: the default, what the script printed before alphabets existed. */
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Letters and digits without the ones that read alike when dictated or copied by hand (`0`/`O`,
 * `1`/`l`/`I`) and without `-` and `_`: 57 characters.
 */
export const READABLE_PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DEFAULT_LENGTH = 20;

export interface TemporaryPasswordOptions {
  /** The characters to draw from, each at most once; base64url by default. */
  readonly alphabet?: string;
  /** How many characters; 20 by default. Use at least the app's `password.minLength`. */
  readonly length?: number;
}

/** A random password of `length` characters from `alphabet`. Throws on an unusable alphabet or length. */
export function createTemporaryPassword(options: TemporaryPasswordOptions = {}): string {
  const alphabet = [...(options.alphabet ?? BASE64URL_ALPHABET)];
  const length = options.length ?? DEFAULT_LENGTH;
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new Error("@softure-ai/auth: createTemporaryPassword needs a whole length of at least 1");
  }
  if (alphabet.length < 2 || new Set(alphabet).size !== alphabet.length) {
    throw new Error("@softure-ai/auth: createTemporaryPassword needs an alphabet of at least 2 distinct characters");
  }
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}
