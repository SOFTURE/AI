// The GitHub App's own credential: a short-lived JWT signed RS256 with the App's private key, which GitHub accepts on
// the `/app/...` endpoints (an installation's details, an installation access token). Signed with WebCrypto, so it runs
// on Node and on Cloudflare Workers alike. GitHub hands out the key as PKCS#1 (`BEGIN RSA PRIVATE KEY`); WebCrypto
// imports PKCS#8 only, so a PKCS#1 key is wrapped in a PKCS#8 envelope first.
import { err, ok, type Err, type Result } from "@softure-ai/core";

/** A GitHub App's id (or client id, which GitHub accepts as the JWT issuer too) and its private key in PEM. */
export interface GithubAppCredentials {
  readonly appId: string;
  /** PKCS#1 or PKCS#8 PEM. Line breaks written as `\n` (a value pasted into one environment line) are accepted. */
  readonly privateKey: string;
}

export type GithubAppKeyInvalid = Err<"connections.github_app_key_invalid">;

/** GitHub refuses a JWT that lives longer than ten minutes; one minute back covers a clock that runs ahead. */
const JWT_BACKDATE_SECONDS = 60;
const JWT_LIFETIME_SECONDS = 540;

/** AlgorithmIdentifier of rsaEncryption with NULL parameters, DER: the fixed middle of a PKCS#8 RSA key. */
const RSA_ALGORITHM_IDENTIFIER = Uint8Array.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
const PKCS8_VERSION = Uint8Array.from([0x02, 0x01, 0x00]);

const keyCache = new Map<string, Promise<CryptoKey | null>>();

/**
 * A JWT for the App, issued now minus a minute and valid nine minutes. `connections.github_app_key_invalid` when the
 * key is not an RSA private key in PEM; the key itself never appears in an error.
 */
export async function createGithubAppJwt(credentials: GithubAppCredentials, options: { readonly now?: () => Date } = {}): Promise<Result<string, "connections.github_app_key_invalid">> {
  const key = await importPrivateKey(credentials.privateKey);
  if (key === null || credentials.appId.trim() === "") return err("connections.github_app_key_invalid");
  const issuedAt = Math.floor((options.now?.() ?? new Date()).getTime() / 1000) - JWT_BACKDATE_SECONDS;
  const header = encodeSegment({ alg: "RS256", typ: "JWT" });
  const payload = encodeSegment({ iat: issuedAt, exp: issuedAt + JWT_BACKDATE_SECONDS + JWT_LIFETIME_SECONDS, iss: credentials.appId.trim() });
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return ok(`${signingInput}.${toBase64Url(new Uint8Array(signature))}`);
}

/** The key as a WebCrypto signing key, memoized per PEM; null when it cannot be read. */
function importPrivateKey(pem: string): Promise<CryptoKey | null> {
  const cached = keyCache.get(pem);
  if (cached !== undefined) return cached;
  const der = readPkcs8(pem);
  const imported =
    der === null
      ? Promise.resolve(null)
      : crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]).catch(() => null);
  keyCache.set(pem, imported);
  return imported;
}

/** The DER of a PKCS#8 key, from PKCS#8 PEM as it is or from PKCS#1 PEM wrapped; null for anything else. */
function readPkcs8(pem: string): ArrayBuffer | null {
  const text = pem.replaceAll("\\n", "\n").trim();
  const match = /^-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]+?)-----END (RSA )?PRIVATE KEY-----$/.exec(text);
  if (match === null || match[1] !== match[3]) return null;
  const body = fromBase64(match[2] ?? "");
  if (body === null || body.length === 0) return null;
  const der = match[1] === undefined ? body : wrapPkcs1(body);
  return der.slice().buffer;
}

/** PrivateKeyInfo ::= SEQUENCE { version 0, rsaEncryption, OCTET STRING pkcs1 }. */
function wrapPkcs1(pkcs1: Uint8Array): Uint8Array {
  const octetString = concat(Uint8Array.from([0x04]), encodeLength(pkcs1.length), pkcs1);
  const content = concat(PKCS8_VERSION, RSA_ALGORITHM_IDENTIFIER, octetString);
  return concat(Uint8Array.from([0x30]), encodeLength(content.length), content);
}

/** A DER length: short form below 128, otherwise the number of length bytes then the length, big-endian. */
function encodeLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.from([length]);
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return Uint8Array.from([0x80 | bytes.length, ...bytes]);
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeSegment(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64(text: string): Uint8Array | null {
  const compact = text.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  try {
    return Uint8Array.from(atob(compact), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}
