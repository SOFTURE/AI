import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

const KEY_TYPE = "ssh-ed25519";

export interface DeployKey {
  /** `ssh-ed25519 <base64> <comment>`, the line authorized_keys gets. */
  publicKey: string;
  /** The private key in OpenSSH's own format, unencrypted: what the deploy workflow's `ssh-private-key` takes. */
  privateKey: string;
}

/** An SSH wire-format string: a 32-bit big-endian length, then the bytes. */
function encodeString(value: Buffer | string): Buffer {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function encodeUint32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function wrapBase64(bytes: Buffer, width: number): string {
  const text = bytes.toString("base64");
  const lines: string[] = [];
  for (let start = 0; start < text.length; start += width) lines.push(text.slice(start, start + width));
  return lines.join("\n");
}

/** The public key blob of an ed25519 key: the type, then the 32-byte point. */
function encodePublicBlob(publicBytes: Buffer): Buffer {
  return Buffer.concat([encodeString(KEY_TYPE), encodeString(publicBytes)]);
}

/** The `openssh-key-v1` container (PROTOCOL.key in OpenSSH) with one unencrypted ed25519 key. */
function encodePrivateKey(seed: Buffer, publicBytes: Buffer, comment: string): string {
  const check = randomBytes(4).readUInt32BE();
  const body = Buffer.concat([
    encodeUint32(check),
    encodeUint32(check),
    encodeString(KEY_TYPE),
    encodeString(publicBytes),
    // OpenSSH stores the 64-byte secret as the seed followed by the public point.
    encodeString(Buffer.concat([seed, publicBytes])),
    encodeString(comment),
  ]);
  const padding = Buffer.from(Array.from({ length: (8 - (body.length % 8)) % 8 }, (_, index) => index + 1));
  const container = Buffer.concat([
    Buffer.from("openssh-key-v1\0", "latin1"),
    encodeString("none"),
    encodeString("none"),
    encodeString(""),
    encodeUint32(1),
    encodeString(encodePublicBlob(publicBytes)),
    encodeString(Buffer.concat([body, padding])),
  ]);
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${wrapBase64(container, 70)}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

/** A fresh ed25519 key pair, made in memory: no `ssh-keygen`, nothing on disk. */
export function generateDeployKey(comment: string): DeployKey {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });
  if (publicJwk.x === undefined || privateJwk.d === undefined) throw new Error("ed25519 key export lost its fields");
  const publicBytes = Buffer.from(publicJwk.x, "base64url");
  const seed = Buffer.from(privateJwk.d, "base64url");
  return {
    publicKey: `${KEY_TYPE} ${encodePublicBlob(publicBytes).toString("base64")} ${comment}`,
    privateKey: encodePrivateKey(seed, publicBytes, comment),
  };
}

/** `SHA256:<base64 without padding>` of a public key line, as `ssh-keygen -l` prints it. */
export function getFingerprint(publicKeyLine: string): string {
  const blob = publicKeyLine.trim().split(/\s+/)[1] ?? "";
  const digest = createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}
