// The S3-compatible driver (Cloudflare R2, MinIO, Garage, AWS S3): path-style URLs, `<endpoint>/<bucket>/<key>`,
// signed with SigV4. A body that fits one part goes up in a single `PUT`; a longer one as a multipart upload, so
// memory holds one part at a time (`partSizeBytes`, 8 MiB by default) and a failure aborts the upload, leaving no
// object. The access keys are read from the environment on each request, so building the driver needs neither.
import { createHash, randomUUID } from "node:crypto";
import { errorLogLabel, type FetchFunction } from "@softure-ai/core";
import type { ByteRange } from "../contract.js";
import type { FileBody, FileStorage, StorageCheck } from "../storage.js";
import type { Env } from "./context.js";
import { EMPTY_PAYLOAD_SHA256, encodeRfc3986, signRequest, type SigV4Credentials } from "./sigv4.js";

const MIB = 1024 * 1024;
/** S3's smallest part (except the last one). */
const MIN_PART_BYTES = 5 * MIB;
const DEFAULT_PART_BYTES = 8 * MIB;
const DEFAULT_TIMEOUT_MS = 60_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const PREFIX_PATTERN = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*$/;

export interface S3StorageOptions {
  /** The service origin: `https://<account>.r2.cloudflarestorage.com`, `http://localhost:9000` for MinIO. */
  readonly endpoint: string;
  readonly bucket: string;
  /** `auto` for R2; the bucket's region elsewhere (`us-east-1` for MinIO and Garage defaults). */
  readonly region?: string;
  /** A folder inside the bucket, ending in `/` (`files/`); none by default. */
  readonly prefix?: string;
  readonly accessKeyIdEnv?: string;
  readonly secretAccessKeyEnv?: string;
  /** The part size of a multipart upload, at least 5 MiB. */
  readonly partSizeBytes?: number;
  /** How long a request may wait for the service's answer (the headers). */
  readonly timeoutMs?: number;
  /** For tests: the `fetch` the driver calls, the environment the keys come from and the signing time. */
  readonly fetch?: FetchFunction;
  readonly env?: Env;
  readonly now?: () => Date;
}

export const S3_ACCESS_KEY_ID_ENV = "SOFTURE_FILES_S3_ACCESS_KEY_ID";
export const S3_SECRET_ACCESS_KEY_ENV = "SOFTURE_FILES_S3_SECRET_ACCESS_KEY";

interface S3Request {
  readonly method: string;
  readonly key: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
}

/** Thrown for an answer the driver did not expect; carries the operation and status, never a URL or a key. */
export class S3StorageError extends Error {
  constructor(
    operation: string,
    readonly status: number,
  ) {
    super(`@softure-ai/files: S3 ${operation} answered ${String(status)}`);
    this.name = "S3StorageError";
  }
}

export function createS3Storage(options: S3StorageOptions): FileStorage {
  const endpoint = parseEndpoint(options.endpoint);
  if (!BUCKET_PATTERN.test(options.bucket)) throw new RangeError("createS3Storage: bucket must be a valid S3 bucket name");
  const prefix = options.prefix ?? "";
  if (!PREFIX_PATTERN.test(prefix)) throw new RangeError("createS3Storage: prefix must be folder names ending in /, e.g. files/");
  const partSize = options.partSizeBytes ?? DEFAULT_PART_BYTES;
  if (!Number.isSafeInteger(partSize) || partSize < MIN_PART_BYTES) throw new RangeError("createS3Storage: partSizeBytes must be at least 5 MiB");
  const region = options.region ?? "auto";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accessKeyIdEnv = options.accessKeyIdEnv ?? S3_ACCESS_KEY_ID_ENV;
  const secretAccessKeyEnv = options.secretAccessKeyEnv ?? S3_SECRET_ACCESS_KEY_ENV;

  function readCredentials(): SigV4Credentials {
    const env = options.env ?? process.env;
    const accessKeyId = env[accessKeyIdEnv]?.trim();
    const secretAccessKey = env[secretAccessKeyEnv]?.trim();
    if (accessKeyId === undefined || accessKeyId === "" || secretAccessKey === undefined || secretAccessKey === "") {
      throw new Error(`@softure-ai/files: the S3 driver needs ${accessKeyIdEnv} and ${secretAccessKeyEnv}`);
    }
    return { accessKeyId, secretAccessKey };
  }

  async function send(request: S3Request): Promise<Response> {
    const objectPath = `${prefix}${request.key}`.split("/").map(encodeRfc3986).join("/");
    const url = new URL(`${endpoint.pathname}${encodeRfc3986(options.bucket)}/${objectPath}`, endpoint.origin);
    for (const [name, value] of Object.entries(request.query ?? {})) url.searchParams.set(name, value);
    const payloadSha256 = request.body === undefined ? EMPTY_PAYLOAD_SHA256 : createHash("sha256").update(request.body).digest("hex");
    const signed = signRequest({
      method: request.method,
      url,
      headers: request.headers,
      payloadSha256,
      region,
      credentials: readCredentials(),
      date: options.now?.() ?? new Date(),
    });
    // fetch sets Host from the URL itself (the same value that was signed).
    const headers = Object.fromEntries(Object.entries(signed).filter(([name]) => name !== "host"));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // A Buffer is a Uint8Array over an ArrayBufferLike; fetch takes it as bytes, the DOM typing only names ArrayBuffer.
      const body = request.body as Uint8Array<ArrayBuffer> | undefined;
      return await (options.fetch ?? fetch)(url, {
        method: request.method,
        headers,
        body,
        signal: controller.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function expectOk(response: Response, operation: string): Promise<string> {
    const text = await response.text();
    // CompleteMultipartUpload can answer 200 with an <Error> body.
    if (!response.ok || text.includes("<Error>")) throw new S3StorageError(operation, response.status);
    return text;
  }

  async function putMultipart(parts: AsyncIterator<Buffer>, first: Buffer, second: Buffer, key: string): Promise<void> {
    const created = await expectOk(await send({ method: "POST", key, query: { uploads: "" } }), "CreateMultipartUpload");
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)?.[1];
    if (uploadId === undefined) throw new S3StorageError("CreateMultipartUpload", 200);
    const etags: string[] = [];
    try {
      const uploadPart = async (body: Buffer) => {
        const response = await send({
          method: "PUT",
          key,
          query: { partNumber: String(etags.length + 1), uploadId },
          body,
        });
        await expectOk(response, "UploadPart");
        const etag = response.headers.get("etag");
        if (etag === null) throw new S3StorageError("UploadPart", response.status);
        etags.push(etag);
      };
      await uploadPart(first);
      await uploadPart(second);
      for (let next = await parts.next(); next.done !== true; next = await parts.next()) await uploadPart(next.value);
      const xml = `<CompleteMultipartUpload>${etags.map((etag, index) => `<Part><PartNumber>${String(index + 1)}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
      await expectOk(
        await send({
          method: "POST",
          key,
          query: { uploadId },
          headers: { "content-type": "application/xml" },
          body: Buffer.from(xml),
        }),
        "CompleteMultipartUpload",
      );
    } catch (error) {
      // Best effort: an upload left open is billed until the bucket's lifecycle rule removes it.
      await send({ method: "DELETE", key, query: { uploadId } }).then(
        (response) => response.body?.cancel(),
        () => undefined,
      );
      throw error;
    }
  }

  return {
    kind: "s3",
    async put(body: FileBody, key: string) {
      const parts = splitIntoParts(body, partSize)[Symbol.asyncIterator]();
      const first = await parts.next();
      const second = first.done === true ? first : await parts.next();
      if (second.done === true) {
        const content = first.done === true ? Buffer.alloc(0) : first.value;
        await expectOk(await send({ method: "PUT", key, body: content }), "PutObject");
        return;
      }
      // Two parts read means the first one is a value too.
      await putMultipart(parts, first.value as Buffer, second.value, key);
    },
    async get(key: string, range?: ByteRange) {
      const headers = range === undefined ? undefined : { range: `bytes=${String(range.start)}-${String(range.end)}` };
      const response = await send({ method: "GET", key, headers });
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if ((response.status !== 200 && response.status !== 206) || response.body === null) {
        await response.body?.cancel();
        throw new S3StorageError("GetObject", response.status);
      }
      return response.body;
    },
    async head(key: string) {
      const response = await send({ method: "HEAD", key });
      await response.body?.cancel();
      if (response.status === 404) return null;
      if (!response.ok) throw new S3StorageError("HeadObject", response.status);
      return { size: Number(response.headers.get("content-length") ?? "0") };
    },
    async delete(key: string) {
      const response = await send({ method: "DELETE", key });
      await response.body?.cancel();
      if (!response.ok && response.status !== 404) throw new S3StorageError("DeleteObject", response.status);
    },
    async check(): Promise<StorageCheck> {
      const key = `health-probe/${randomUUID()}`;
      try {
        await expectOk(await send({ method: "PUT", key, body: Buffer.from("ok") }), "PutObject");
        const response = await send({ method: "DELETE", key });
        await response.body?.cancel();
        return { isWritable: true, freeBytes: null };
      } catch (error) {
        console.error(`@softure-ai/files: the S3 health probe failed: ${errorLogLabel(error)}`);
        return { isWritable: false, freeBytes: null };
      }
    },
  };
}

function parseEndpoint(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RangeError("createS3Storage: endpoint must be a URL such as https://<account>.r2.cloudflarestorage.com");
  }
  const isAllowed = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!isAllowed || url.search !== "" || url.hash !== "") {
    throw new RangeError("createS3Storage: endpoint must be an https origin (http only on localhost), without query or fragment");
  }
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  return url;
}

/** The body re-cut into parts of exactly `size` bytes (the last one shorter), holding at most one part plus a chunk. */
export async function* splitIntoParts(body: FileBody, size: number): AsyncGenerator<Buffer> {
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  for await (const chunk of body) {
    pending.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    pendingBytes += chunk.byteLength;
    while (pendingBytes >= size) {
      const joined = Buffer.concat(pending, pendingBytes);
      yield joined.subarray(0, size);
      pending = [joined.subarray(size)];
      pendingBytes -= size;
    }
  }
  if (pendingBytes > 0) yield Buffer.concat(pending, pendingBytes);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
