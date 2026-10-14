// Shared-secret signatures for webhook-style requests (an edge worker forwarding mail, a payment
// provider, a CI callback): HMAC-SHA256 over `<unix seconds>.<body>`, sent as `t=<seconds>,v1=<hex>`.
// Web Crypto only, so the sending side (a Cloudflare Worker) signs with the same code the app verifies
// with; `@softure-ai/security/signed-request` imports nothing else from the package.
import { err, ok, type Err, type Ok } from "@softure-ai/core";

/** The shortest secret accepted, in characters: 32 random hex or base64 characters or more. */
export const MIN_SIGNING_SECRET_LENGTH = 32;
/** How far a request's timestamp may be from now, in seconds, in either direction, unless the caller says otherwise. */
export const SIGNED_REQUEST_TOLERANCE_SECONDS = 300;

/** One secret, or several while one is rotated out: the signer signs with each, the verifier accepts any. */
export type SigningSecret = string | readonly string[];

export interface SignRequestBodyInput {
  readonly secret: SigningSecret;
  /** The exact bytes sent; a string is signed as UTF-8. */
  readonly body: string | Uint8Array;
  readonly now: Date;
}

export interface VerifySignedRequestInput {
  /** Undefined or empty when the app's configuration has no secret: every request is refused. */
  readonly secret: SigningSecret | undefined;
  /** The signature header, or null when the request had none. */
  readonly header: string | null;
  /** The exact bytes received (`readSmallBodyBytes`), or the text when the sender signed text. */
  readonly body: string | Uint8Array;
  readonly now: Date;
  readonly toleranceSeconds?: number;
}

export type VerifySignedRequestResult = Ok<undefined> | Err<"security.signature_invalid">;

const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const TIMESTAMP_PATTERN = /^\d{1,12}$/;
const encoder = new TextEncoder();

/**
 * The signature header value for `body` at `now`: `t=<unix seconds>,v1=<hex>`, with one `v1` per secret.
 * Throws on a secret shorter than `MIN_SIGNING_SECRET_LENGTH` or an invalid date: both are configuration bugs.
 */
export async function signRequestBody(input: SignRequestBodyInput): Promise<string> {
  const secrets = toSecretList(input.secret);
  if (secrets.length === 0 || secrets.some((secret) => !isLongEnough(secret))) {
    throw new RangeError(`signRequestBody: every secret must be at least ${String(MIN_SIGNING_SECRET_LENGTH)} characters`);
  }
  const timestamp = toUnixSeconds(input.now, "signRequestBody");
  const payload = signedPayload(timestamp, input.body);
  const signatures = await Promise.all(secrets.map(async (secret) => toHex(await hmacSha256(secret, payload))));
  return [`t=${String(timestamp)}`, ...signatures.map((signature) => `v1=${signature}`)].join(",");
}

/**
 * Whether `header` signs `body` under one of the secrets, within `toleranceSeconds` of `now`.
 * Fails closed: a missing or short secret, a missing or malformed header, a timestamp outside the
 * window (old or in the future) and a wrong MAC all give `security.signature_invalid`.
 * Throws on a `toleranceSeconds` that is not a whole, non-negative number.
 */
export async function verifySignedRequest(input: VerifySignedRequestInput): Promise<VerifySignedRequestResult> {
  const tolerance = input.toleranceSeconds ?? SIGNED_REQUEST_TOLERANCE_SECONDS;
  if (!Number.isSafeInteger(tolerance) || tolerance < 0) {
    throw new RangeError(`verifySignedRequest: toleranceSeconds must be a whole number of seconds, got ${String(tolerance)}`);
  }
  const secrets = input.secret === undefined ? [] : toSecretList(input.secret);
  if (secrets.length === 0 || secrets.some((secret) => !isLongEnough(secret)) || input.header === null) {
    return err("security.signature_invalid");
  }
  const parsed = parseSignatureHeader(input.header);
  if (parsed === null) {
    return err("security.signature_invalid");
  }
  const now = toUnixSeconds(input.now, "verifySignedRequest");
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return err("security.signature_invalid");
  }

  const payload = signedPayload(parsed.timestamp, input.body);
  const candidates = parsed.signatures.map(fromHex);
  for (const secret of secrets) {
    const expected = await hmacSha256(secret, payload);
    // Every candidate is compared in full, so the time taken says nothing about which bytes matched.
    if (candidates.map((candidate) => equalsInConstantTime(candidate, expected)).includes(true)) {
      return ok();
    }
  }
  return err("security.signature_invalid");
}

function toSecretList(secret: SigningSecret): readonly string[] {
  return typeof secret === "string" ? [secret] : secret;
}

function isLongEnough(secret: string): boolean {
  return secret.length >= MIN_SIGNING_SECRET_LENGTH;
}

function toUnixSeconds(date: Date, caller: string): number {
  const milliseconds = date.getTime();
  if (Number.isNaN(milliseconds)) {
    throw new RangeError(`${caller}: now is an invalid date`);
  }
  return Math.floor(milliseconds / 1000);
}

/** The timestamp and the well-formed `v1` values, or null when `t` is missing, repeated or not a number, or no `v1` is usable. */
function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  const timestamps: string[] = [];
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      timestamps.push(value);
    } else if (key === "v1" && SIGNATURE_PATTERN.test(value)) {
      signatures.push(value);
    }
  }
  const [timestamp] = timestamps;
  if (timestamps.length !== 1 || timestamp === undefined || !TIMESTAMP_PATTERN.test(timestamp) || signatures.length === 0) {
    return null;
  }
  return { timestamp: Number(timestamp), signatures };
}

function signedPayload(timestamp: number, body: string | Uint8Array): Uint8Array<ArrayBuffer> {
  const prefix = encoder.encode(`${String(timestamp)}.`);
  const bodyBytes = typeof body === "string" ? encoder.encode(body) : body;
  const payload = new Uint8Array(prefix.byteLength + bodyBytes.byteLength);
  payload.set(prefix, 0);
  payload.set(bodyBytes, prefix.byteLength);
  return payload;
}

async function hmacSha256(secret: string, payload: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
}

function equalsInConstantTime(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Only called on values that matched `SIGNATURE_PATTERN`. */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
