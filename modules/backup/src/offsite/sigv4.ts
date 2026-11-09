// AWS Signature Version 4 for the three S3 requests this package sends (PUT, GET, ListObjectsV2), path style, so it
// works the same with Cloudflare R2, Backblaze B2, Hetzner Object Storage, MinIO and AWS. The payload hash is the
// real sha256 of the body (the empty body's for GET and list), never UNSIGNED-PAYLOAD.
import { createHash, createHmac } from "node:crypto";

export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export interface SignInput {
  readonly method: "GET" | "PUT" | "HEAD";
  readonly url: URL;
  /** Headers to send and sign besides host, x-amz-date and x-amz-content-sha256; names in any case. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly payloadSha256: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly now: Date;
}

/** RFC 3986 encoding of every byte except the unreserved ones, as SigV4 wants; `/` kept when `keepSlash`. */
export function encodeRfc3986(text: string, keepSlash = false): string {
  let encoded = "";
  for (const byte of Buffer.from(text, "utf8")) {
    const char = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~]/.test(char) || (keepSlash && char === "/")) encoded += char;
    else encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return encoded;
}

/** `20130524T000000Z` */
export function formatAmzDate(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function hmac(key: Buffer | string, text: string): Buffer {
  return createHmac("sha256", key).update(text, "utf8").digest();
}

function getCanonicalQuery(url: URL): string {
  return [...url.searchParams.entries()]
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
    .sort(([left, leftValue], [right, rightValue]) => (left === right ? (leftValue < rightValue ? -1 : 1) : left < right ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** The headers to send, the `Authorization` one included. */
export function signRequest(input: SignInput): Record<string, string> {
  const amzDate = formatAmzDate(input.now);
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: input.url.host,
    "x-amz-content-sha256": input.payloadSha256,
    "x-amz-date": amzDate,
  };
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value.trim().replace(/\s+/g, " ");
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name] ?? ""}\n`).join("");
  const signedHeaders = names.join(";");
  // The path as the URL holds it is already percent-encoded once; S3 signs it without a second encoding.
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    getCanonicalQuery(input.url),
    canonicalHeaders,
    signedHeaders,
    input.payloadSha256,
  ].join("\n");
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  // fetch sets Host itself from the URL.
  const sent = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== "host"));
  return {
    ...sent,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
