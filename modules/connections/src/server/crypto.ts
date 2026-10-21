// Secrets at rest: AES-256-GCM under a keyring from `SOFTURE_CONNECTIONS_KEYS`
// (`<id>:<base64 of 32 bytes>[,<id>:<key>…]`). The first key seals, every key opens, and each ciphertext names
// its key id, so a key is rotated by putting a new one first, re-sealing (`reencryptConnections`) and dropping
// the old one. The additional data binds a ciphertext to the row it belongs to: copied to another provider's
// row, it does not open. Failures are codes; neither a key nor a plaintext ever reaches an error or a log.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { ConnectionsKeyErrorCode } from "../contract.js";

export const CONNECTIONS_KEYS_ENV = "SOFTURE_CONNECTIONS_KEYS";

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** The format version of a sealed value: `v1.<key id>.<iv>.<ciphertext and tag>`, base64url parts. */
const SEALED_PREFIX = "v1";

export interface ConnectionsKey {
  readonly id: string;
  readonly key: Buffer;
}

/** The keys, the sealing one first. */
export interface Keyring {
  readonly current: ConnectionsKey;
  readonly keys: ReadonlyMap<string, Buffer>;
}

export type Env = Readonly<Record<string, string | undefined>>;

export type KeyringResult = Ok<Keyring> | Err<"connections.key_missing" | "connections.key_invalid">;

/** Parses the keyring from the environment. Never echoes the value it read. */
export function readKeyring(env: Env = process.env): KeyringResult {
  const raw = env[CONNECTIONS_KEYS_ENV]?.trim();
  if (raw === undefined || raw === "") return err("connections.key_missing");
  const keys = new Map<string, Buffer>();
  let current: ConnectionsKey | undefined;
  for (const entry of raw.split(",")) {
    const parsed = parseKeyEntry(entry.trim());
    if (parsed === null || keys.has(parsed.id)) return err("connections.key_invalid");
    keys.set(parsed.id, parsed.key);
    current ??= parsed;
  }
  // The split always yields one entry, so a parsed list has a current key.
  return current === undefined ? err("connections.key_invalid") : ok({ current, keys });
}

function parseKeyEntry(entry: string): ConnectionsKey | null {
  const separator = entry.indexOf(":");
  if (separator <= 0) return null;
  const id = entry.slice(0, separator);
  const encoded = entry.slice(separator + 1);
  if (!KEY_ID_PATTERN.test(id) || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded)) return null;
  // Node's base64 decoder takes both alphabets, standard and URL-safe.
  const key = Buffer.from(encoded, "base64");
  return key.length === KEY_BYTES ? { id, key } : null;
}

/** A new keyring entry, `<id>:<base64url of 32 random bytes>`, for `SOFTURE_CONNECTIONS_KEYS`. */
export function generateConnectionsKey(id: string = new Date().toISOString().slice(0, 10).replaceAll("-", "")): string {
  if (!KEY_ID_PATTERN.test(id)) {
    throw new RangeError("generateConnectionsKey: the id must be 1 to 32 letters, digits, _ or -");
  }
  return `${id}:${randomBytes(KEY_BYTES).toString("base64url")}`;
}

export interface SealedSecret {
  readonly keyId: string;
  readonly sealed: string;
}

/** Seals `plaintext` with the keyring's current key, bound to `context` (the row it is stored in). */
export function sealSecret(keyring: Keyring, plaintext: string, context: string): SealedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyring.current.key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    keyId: keyring.current.id,
    sealed: [SEALED_PREFIX, keyring.current.id, iv.toString("base64url"), body.toString("base64url")].join("."),
  };
}

export type OpenSecretResult = Ok<string> | Err<"connections.key_unknown" | "connections.secret_unreadable">;

/** Opens a value `sealSecret` produced for the same `context`. */
export function openSecret(keyring: Keyring, sealed: string, context: string): OpenSecretResult {
  const [prefix, keyId, ivPart, bodyPart, extra] = sealed.split(".");
  if (prefix !== SEALED_PREFIX || keyId === undefined || ivPart === undefined || bodyPart === undefined || extra !== undefined) {
    return err("connections.secret_unreadable");
  }
  const key = keyring.keys.get(keyId);
  if (key === undefined) return err("connections.key_unknown");
  const iv = Buffer.from(ivPart, "base64url");
  const body = Buffer.from(bodyPart, "base64url");
  if (iv.length !== IV_BYTES || body.length < TAG_BYTES) return err("connections.secret_unreadable");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
    return ok(Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString("utf8"));
  } catch {
    // A wrong tag: tampered, or sealed for another row. The error carries nothing worth logging.
    return err("connections.secret_unreadable");
  }
}

/** The key id a sealed value names, or null for a value this module did not seal. */
export function readSealedKeyId(sealed: string): string | null {
  const [prefix, keyId] = sealed.split(".");
  return prefix === SEALED_PREFIX && keyId !== undefined && KEY_ID_PATTERN.test(keyId) ? keyId : null;
}

/** The additional data of a connection's credentials. */
export function getCredentialContext(provider: string, accountId: string): string {
  return `connections/accounts/${provider}/${accountId}`;
}

/** The additional data of an authorization's PKCE verifier. */
export function getVerifierContext(stateHash: string): string {
  return `connections/oauth_states/${stateHash}`;
}

/** Narrows a keyring failure to the codes callers share. */
export type KeyFailure = Err<ConnectionsKeyErrorCode>;
