// Password hashing with scrypt from node:crypto. A hash describes its own parameters
// (`scrypt$<N>$<r>$<p>$<salt>$<key>`, base64url), so the cost can be raised later: a login with an
// older cost rehashes (`needsRehash`). Keys are compared with `timingSafeEqual`.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { ScryptParams } from "../options.js";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** Longest password accepted anywhere, so a request cannot make the server hash megabytes. */
export const MAX_PASSWORD_LENGTH = 1024;

interface ParsedHash {
  readonly params: ScryptParams;
  readonly salt: Buffer;
  readonly key: Buffer;
}

/** A new salted hash of `password`. */
export async function hashPassword(password: string, params: ScryptParams): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password.normalize("NFC"), salt, params);
  return ["scrypt", params.cost, params.blockSize, params.parallelization, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/**
 * How `password` matched `storedHash`: `match`, `mismatch`, or `legacy` when only the raw input
 * matched. This module hashes the NFC form; a system it took over may have hashed what the browser
 * sent, so a password typed in another Unicode form (NFD from some keyboards) is tried as given
 * when the NFC form fails. A `legacy` match is rehashed at login. Throws on a hash this module did
 * not write: that is damaged data, not a wrong password.
 */
export async function matchPassword(password: string, storedHash: string): Promise<PasswordMatch> {
  const parsed = parseHash(storedHash);
  const normalized = password.normalize("NFC");
  if (isSameKey(await deriveKey(normalized, parsed.salt, parsed.params), parsed.key)) return "match";
  if (normalized === password) return "mismatch";
  return isSameKey(await deriveKey(password, parsed.salt, parsed.params), parsed.key) ? "legacy" : "mismatch";
}

export type PasswordMatch = "match" | "legacy" | "mismatch";

/** Whether `password` matches `storedHash` (`matchPassword` as a yes or no). */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return (await matchPassword(password, storedHash)) !== "mismatch";
}

function isSameKey(key: Buffer, stored: Buffer): boolean {
  return key.length === stored.length && timingSafeEqual(key, stored);
}

/** Whether `storedHash` was made with other parameters than `params`. */
export function needsRehash(storedHash: string, params: ScryptParams): boolean {
  const current = parseHash(storedHash).params;
  return current.cost !== params.cost || current.blockSize !== params.blockSize || current.parallelization !== params.parallelization;
}

const dummyHashes = new Map<string, Promise<string>>();

/**
 * Spends the time of one verification without an account, so a login for an unknown email takes
 * as long as one with a wrong password (the NFC retry included: it goes through `verifyPassword`).
 * The dummy hash is made once per parameter set.
 */
export async function verifyDummyPassword(password: string, params: ScryptParams): Promise<void> {
  const cacheKey = `${String(params.cost)}:${String(params.blockSize)}:${String(params.parallelization)}`;
  let dummy = dummyHashes.get(cacheKey);
  if (dummy === undefined) {
    dummy = hashPassword(randomBytes(SALT_BYTES).toString("base64url"), params);
    dummyHashes.set(cacheKey, dummy);
    dummy.catch(() => dummyHashes.delete(cacheKey));
  }
  await verifyPassword(password, await dummy);
}

/** The key of `password` exactly as given; callers normalise. */
function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.cost,
    r: params.blockSize,
    p: params.parallelization,
    // Node refuses above 32 MiB by default; scrypt needs 128 * N * r bytes, so leave room for it.
    maxmem: 256 * params.cost * params.blockSize,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, options, (error, key) => {
      if (error === null) resolve(key);
      else reject(error);
    });
  });
}

/** Whether `value` is in the `scrypt$N$r$p$salt$key` format this module writes and reads. */
export function isPasswordHash(value: string): boolean {
  return readHashParts(value) !== null;
}

function readHashParts(value: string): { params: ScryptParams; salt: string; key: string } | null {
  const [scheme, cost, blockSize, parallelization, salt, key, ...rest] = value.split("$");
  const params = { cost: Number(cost), blockSize: Number(blockSize), parallelization: Number(parallelization) };
  const isValid =
    scheme === "scrypt" &&
    rest.length === 0 &&
    Object.values(params).every((part) => Number.isSafeInteger(part) && part > 0) &&
    salt !== undefined &&
    salt !== "" &&
    key !== undefined &&
    key !== "";
  return isValid ? { params, salt, key } : null;
}

function parseHash(storedHash: string): ParsedHash {
  const parts = readHashParts(storedHash);
  if (parts === null) {
    // The hash itself stays out of the message: it is secret-derived data.
    throw new Error("@softure-ai/auth: a stored password hash is not in the scrypt$N$r$p$salt$key format");
  }
  return { params: parts.params, salt: Buffer.from(parts.salt, "base64url"), key: Buffer.from(parts.key, "base64url") };
}
