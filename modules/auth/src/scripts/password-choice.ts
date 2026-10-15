// The password an ops script stores: a drawn temporary one, or a `hashPassword` hash computed where
// the password was made (`--password-hash`, best through `--password-hash-file=-`), so the plain
// password never reaches the server. Shared by `set-temporary-password` and `create-account`.
import type { SoftureConfig } from "@softure-ai/core";
import { z } from "zod";
import { getAuthOptions } from "../server/options.js";
import { hashPassword, isPasswordHash } from "../server/password.js";
import { createTemporaryPassword } from "../server/temporary-password.js";

/** Long enough to be out of guessing range in any rate limit window. */
const MIN_TEMPORARY_LENGTH = 20;
export const PASSWORD_HASH_KEY = "password-hash";
export const PASSWORD_HASH_USAGE = `--${PASSWORD_HASH_KEY}=<hash>  store this hashPassword() hash instead of drawing a password`;

// A constant message: the value is secret-derived and must not be echoed.
export const passwordHashArg = z.string().refine(isPasswordHash, "is not a scrypt hash written by @softure-ai/auth").optional();

export type ChosenPassword =
  | { readonly from: "hash"; readonly hash: string }
  | { readonly from: "drawn"; readonly hash: string; readonly plain: string };

/** The given hash, or a drawn password of at least 20 characters and `password.minLength`, with its hash. */
export async function choosePassword(givenHash: string | undefined, config: SoftureConfig, alphabet: string | undefined): Promise<ChosenPassword> {
  if (givenHash !== undefined) return { from: "hash", hash: givenHash };
  const { password } = getAuthOptions(config);
  const plain = createTemporaryPassword({ alphabet, length: Math.max(password.minLength, MIN_TEMPORARY_LENGTH) });
  return { from: "drawn", hash: await hashPassword(plain, password.scrypt), plain };
}

/** What a report says about the stored password: never the hash, the drawn password once. */
export function describeChosenPassword(password: ChosenPassword): { passwordFrom: "hash" } | { temporaryPassword: string } {
  return password.from === "hash" ? { passwordFrom: "hash" } : { temporaryPassword: password.plain };
}
