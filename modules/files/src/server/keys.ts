// The link signing keyring from `SOFTURE_FILES_LINK_KEYS` (`<id>:<base64 of 32 bytes>[,<id>:<key>…]`), the same
// format as `@softure-ai/connections`: the first key signs, every key verifies. A key is rotated by putting a new
// one first and dropping the old one after the longest link lifetime. Failures are codes; a key never reaches an
// error or a log.
import { randomBytes } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Env } from "./context.js";

export const FILES_LINK_KEYS_ENV = "SOFTURE_FILES_LINK_KEYS";

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const KEY_BYTES = 32;

/** The keys, the signing one first. */
export interface LinkKeyring {
  readonly current: Buffer;
  readonly keys: readonly Buffer[];
}

export type LinkKeyringResult = Ok<LinkKeyring> | Err<"files.link_key_missing" | "files.link_key_invalid">;

/** Parses the keyring from the environment. Never echoes the value it read. */
export function readLinkKeyring(env: Env = process.env): LinkKeyringResult {
  const raw = env[FILES_LINK_KEYS_ENV]?.trim();
  if (raw === undefined || raw === "") return err("files.link_key_missing");
  const ids = new Set<string>();
  const keys: Buffer[] = [];
  for (const entry of raw.split(",")) {
    const parsed = parseKeyEntry(entry.trim());
    if (parsed === null || ids.has(parsed.id)) return err("files.link_key_invalid");
    ids.add(parsed.id);
    keys.push(parsed.key);
  }
  const [current] = keys;
  // The split always yields one entry, so a parsed list has a current key.
  return current === undefined ? err("files.link_key_invalid") : ok({ current, keys });
}

function parseKeyEntry(entry: string): { id: string; key: Buffer } | null {
  const separator = entry.indexOf(":");
  if (separator <= 0) return null;
  const id = entry.slice(0, separator);
  const encoded = entry.slice(separator + 1);
  if (!KEY_ID_PATTERN.test(id) || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded)) return null;
  // Node's base64 decoder takes both alphabets, standard and URL-safe.
  const key = Buffer.from(encoded, "base64");
  return key.length === KEY_BYTES ? { id, key } : null;
}

/** A new keyring entry, `<id>:<base64url of 32 random bytes>`, for `SOFTURE_FILES_LINK_KEYS`. */
export function generateFilesLinkKey(id: string = new Date().toISOString().slice(0, 10).replaceAll("-", "")): string {
  if (!KEY_ID_PATTERN.test(id)) {
    throw new RangeError("generateFilesLinkKey: the id must be 1 to 32 letters, digits, _ or -");
  }
  return `${id}:${randomBytes(KEY_BYTES).toString("base64url")}`;
}
