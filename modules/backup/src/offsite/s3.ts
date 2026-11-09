// The three S3 requests: PUT of an encrypted file (the nightly run, a write-only token suffices), GET of an object
// and ListObjectsV2 under the prefix (restore and verify, a read token). Path style: <endpoint>/<bucket>/<key>.
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { StoreConfig } from "./config.js";
import { EMPTY_SHA256, encodeRfc3986, signRequest } from "./sigv4.js";

/** A failed request, with what S3 said (its error code) but never a header or a signature. */
export class S3RequestError extends Error {
  readonly status: number | null;
  readonly s3Code: string | null;

  constructor(message: string, status: number | null, s3Code: string | null) {
    super(message);
    this.name = "S3RequestError";
    this.status = status;
    this.s3Code = s3Code;
  }

  /** 401 and 403: the token is wrong or lacks the permission. */
  get isDenied(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface StoredObject {
  readonly key: string;
  readonly bytes: number;
}

export interface S3Options {
  /** The clock of the signature. */
  readonly now?: () => Date;
  readonly fetch?: typeof fetch;
  /** Per request; an upload of a large dump needs minutes. Default 30 minutes. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ERROR_TEXT = 200;

/** The URL of a key (or of the bucket, for a list), path style under the endpoint's own path. */
export function getObjectUrl(store: StoreConfig, key: string | null): URL {
  const base = store.endpoint.pathname.replace(/\/+$/, "");
  const path = key === null ? `${base}/${encodeRfc3986(store.bucket)}` : `${base}/${encodeRfc3986(store.bucket)}/${encodeRfc3986(key, true)}`;
  return new URL(`${store.endpoint.origin}${path}`);
}

function readXmlTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match?.[1] === undefined ? null : decodeXml(match[1]);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function toError(operation: string, response: Response): Promise<S3RequestError> {
  const body = await response.text().catch(() => "");
  const code = readXmlTag(body, "Code");
  const detail = readXmlTag(body, "Message")?.slice(0, MAX_ERROR_TEXT);
  const said = [code, detail].filter((part) => part !== null && part !== undefined && part !== "").join(": ");
  return new S3RequestError(`${operation} answered HTTP ${String(response.status)}${said === "" ? "" : ` (${said})`}`, response.status, code);
}

async function send(operation: string, url: URL, init: RequestInit, options: S3Options): Promise<Response> {
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, { ...init, signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
  } catch (error) {
    // The cause names the host or the errno, never a header.
    const cause = error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error);
    throw new S3RequestError(`${operation} could not reach ${url.host} (${cause})`, null, null);
  }
  if (!response.ok) throw await toError(operation, response);
  return response;
}

function sign(store: StoreConfig, method: "GET" | "PUT", url: URL, payloadSha256: string, options: S3Options, headers?: Record<string, string>): Record<string, string> {
  return signRequest({
    method,
    url,
    payloadSha256,
    region: store.region,
    accessKeyId: store.accessKeyId,
    secretAccessKey: store.secretAccessKey,
    now: (options.now ?? (() => new Date()))(),
    ...(headers === undefined ? {} : { headers }),
  });
}

/** PUTs the file at `path` (its sha256 and size known) as `key`. */
export async function putObjectFile(
  store: StoreConfig,
  input: { key: string; path: string; bytes: number; sha256: string },
  options: S3Options = {},
): Promise<void> {
  const url = getObjectUrl(store, input.key);
  const headers = sign(store, "PUT", url, input.sha256, options, { "content-type": "application/octet-stream" });
  const body = Readable.toWeb(createReadStream(input.path)) as ReadableStream<Uint8Array>;
  await send(`PUT ${input.key}`, url, { method: "PUT", headers: { ...headers, "content-length": String(input.bytes) }, body, duplex: "half" } as RequestInit, options);
}

/** The body of `key` as a stream. */
export async function getObjectStream(store: StoreConfig, key: string, options: S3Options = {}): Promise<ReadableStream<Uint8Array>> {
  const url = getObjectUrl(store, key);
  const response = await send(`GET ${key}`, url, { method: "GET", headers: sign(store, "GET", url, EMPTY_SHA256, options) }, options);
  if (response.body === null) throw new S3RequestError(`GET ${key} answered without a body`, response.status, null);
  return response.body;
}

/** Every object under `prefix/`, through ListObjectsV2 pages. */
export async function listObjects(store: StoreConfig, prefix: string, options: S3Options = {}): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  let token: string | null = null;
  do {
    const url = getObjectUrl(store, null);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (token !== null) url.searchParams.set("continuation-token", token);
    const response = await send(`LIST ${prefix}`, url, { method: "GET", headers: sign(store, "GET", url, EMPTY_SHA256, options) }, options);
    const xml = await response.text();
    for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const entry = match[1] ?? "";
      const key = readXmlTag(entry, "Key");
      if (key !== null) objects.push({ key, bytes: Number(readXmlTag(entry, "Size") ?? 0) });
    }
    token = readXmlTag(xml, "IsTruncated") === "true" ? readXmlTag(xml, "NextContinuationToken") : null;
  } while (token !== null);
  return objects;
}
