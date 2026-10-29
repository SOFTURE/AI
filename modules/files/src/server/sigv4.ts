// AWS Signature Version 4 for S3-compatible storage (R2, MinIO, Garage, AWS), with `node:crypto` only. The signer
// takes the request as it will be sent and answers the headers to add; it is checked against the test vector AWS
// publishes for S3 (tests/sigv4.test.ts).
import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
export const EMPTY_PAYLOAD_SHA256 = createHash("sha256").update("").digest("hex");

export interface SigV4Credentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface SignRequestInput {
  readonly method: string;
  /** The URL as sent: its path already percent-encoded per segment (`encodeRfc3986`), its query in any order. */
  readonly url: URL;
  /** Headers to sign besides `host`, `x-amz-date` and `x-amz-content-sha256`, which the signer sets. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Lowercase hex SHA-256 of the body (`EMPTY_PAYLOAD_SHA256` for none). */
  readonly payloadSha256: string;
  readonly region: string;
  readonly service?: string;
  readonly credentials: SigV4Credentials;
  readonly date: Date;
}

/** RFC 3986 percent-encoding as SigV4 wants it: everything but `A-Z a-z 0-9 - . _ ~` is escaped. */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

/** `20130524T000000Z`. */
function formatAmzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** The request's headers with `authorization` added: every header in the result is signed. */
export function signRequest(input: SignRequestInput): Record<string, string> {
  const service = input.service ?? "s3";
  const amzDate = formatAmzDate(input.date);
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value;
  headers.host = input.url.host;
  headers["x-amz-content-sha256"] = input.payloadSha256;
  headers["x-amz-date"] = amzDate;

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${(headers[name] ?? "").trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalQuery = [...input.url.searchParams.entries()]
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
    .sort(([a, aValue], [b, bValue]) => (a === b ? compare(aValue, bValue) : compare(a, b)))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  const canonicalRequest = [input.method, input.url.pathname, canonicalQuery, canonicalHeaders, signedHeaders, input.payloadSha256].join("\n");

  const scope = `${day}/${input.region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.credentials.secretAccessKey}`, day), input.region), service), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  headers.authorization = `${ALGORITHM} Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

/** Byte order, as SigV4 sorts (not the locale's). */
function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
