/** The key types an `authorized_keys` line of this package may carry. */
export const PUBLIC_KEY_TYPES = [
  "ssh-ed25519",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
  "ssh-rsa",
] as const;

export type PublicKeyType = (typeof PUBLIC_KEY_TYPES)[number];

export interface PublicKey {
  type: PublicKeyType;
  /** The base64 key blob, exactly as it appears in the line. */
  body: string;
  /** The key's own comment, possibly empty; lines this package writes replace it. */
  comment: string;
}

export type ParsedPublicKey = { ok: true; key: PublicKey } | { ok: false; reason: string };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function isPublicKeyType(value: string): value is PublicKeyType {
  return (PUBLIC_KEY_TYPES as readonly string[]).includes(value);
}

/** The first SSH wire-format string of a key blob: the key type the blob itself declares. */
function readBlobType(blob: Buffer): string | null {
  if (blob.length < 4) return null;
  const length = blob.readUInt32BE(0);
  if (length === 0 || length > 64 || blob.length < 4 + length) return null;
  return blob.subarray(4, 4 + length).toString("latin1");
}

/**
 * Reads the contents of a `.pub` file: exactly one public key line (`<type> <base64> [comment]`), no options prefix,
 * a known type, and a blob that decodes and declares the same type. Anything else, a private key included, is refused
 * with the reason.
 */
export function parsePublicKey(text: string): ParsedPublicKey {
  if (text.includes("PRIVATE KEY")) return { ok: false, reason: "this is a private key; pass the .pub file" };
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
  if (lines.length !== 1) return { ok: false, reason: `expected one public key line, found ${lines.length}` };
  const [type = "", body = "", ...rest] = (lines[0] ?? "").split(/\s+/);
  if (!isPublicKeyType(type)) {
    return { ok: false, reason: `unsupported key type "${type.slice(0, 40)}" (options before the key are not accepted)` };
  }
  if (!BASE64.test(body) || body.length % 4 !== 0) return { ok: false, reason: "the key body is not base64" };
  if (readBlobType(Buffer.from(body, "base64")) !== type) {
    return { ok: false, reason: `the key body is not a ${type} key` };
  }
  return { ok: true, key: { type, body, comment: rest.join(" ") } };
}
