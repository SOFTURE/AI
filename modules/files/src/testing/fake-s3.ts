// An S3-compatible bucket in memory, answered over `fetch` (or `handle` behind a local HTTP server): path-style
// ListObjectsV2 (`list-type=2`, prefix, max-keys, continuation tokens) and GetObject with `If-Match` and a byte range,
// answered only to requests signed (SigV4) with the one key pair it knows. ETags are the MD5 of the content, as S3
// gives for a single-part upload. Failures can be injected per operation. A writable bucket also takes a single-part
// PutObject (its body checked against the signed hash), HeadObject and DeleteObject: enough for `createS3Storage`.
import { createHash } from "node:crypto";
import { signRequest } from "../server/sigv4.js";

export interface FakeS3Options {
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** The endpoint's base path after the origin (`/s3` for `http://host/s3`); none by default. */
  readonly basePath?: string;
  /** Also answers PUT, HEAD and DELETE of objects; read-only by default. */
  readonly isWritable?: boolean;
}

/** The fixed `LastModified` of every listed object, so a listing is the same on every run. */
const LAST_MODIFIED = "2026-01-01T00:00:00.000Z";

export type FakeS3Operation = "list" | "get" | "put" | "head" | "delete";

export interface FakeS3 {
  readonly fetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
  /** Answers one request (for an HTTP server that hands its requests over). */
  readonly handle: (request: Request) => Promise<Response>;
  put(key: string, content: string | Uint8Array): void;
  remove(key: string): void;
  /** Answers every following request of `operation` with this status until cleared with null. */
  fail(operation: FakeS3Operation, status: number | null): void;
  readonly calls: Readonly<Record<FakeS3Operation, number>>;
}

/** A fake S3 bucket for tests: hand `fetch` to `createS3Storage({ fetch })` or to any SigV4 client. */
export function createFakeS3(options: FakeS3Options): FakeS3 {
  const objects = new Map<string, Uint8Array>();
  const failures = new Map<FakeS3Operation, number>();
  const calls: Record<FakeS3Operation, number> = { list: 0, get: 0, put: 0, head: 0, delete: 0 };
  const basePath = trimTrailingSlashes(options.basePath ?? "");
  const encoder = new TextEncoder();

  const etagOf = (content: Uint8Array) => createHash("md5").update(content).digest("hex");

  async function handle(request: Request): Promise<Response> {
    const body = request.method === "PUT" ? new Uint8Array(await request.arrayBuffer()) : null;
    return answer(request, body);
  }

  function answer(request: Request, body: Uint8Array | null): Response {
    const url = new URL(request.url);
    const writes = new Set(["PUT", "HEAD", "DELETE"]);
    if (request.method !== "GET" && !(options.isWritable === true && writes.has(request.method))) return xmlError(405, "MethodNotAllowed");
    if (!isSigned(request, url, options)) return xmlError(403, "SignatureDoesNotMatch");
    const bucketPath = `${basePath}/${encodeURIComponent(options.bucket)}`;
    if (url.pathname !== bucketPath && !url.pathname.startsWith(`${bucketPath}/`)) return xmlError(404, "NoSuchBucket");
    const key = decodeURIComponent(url.pathname.slice(bucketPath.length + 1));
    if (request.method !== "GET") return write(request, url, key, body);
    if (key === "") {
      calls.list += 1;
      const failure = failures.get("list");
      if (failure !== undefined) return xmlError(failure, "Injected");
      return list(url);
    }
    calls.get += 1;
    const failure = failures.get("get");
    if (failure !== undefined) return xmlError(failure, "Injected");
    const content = objects.get(key);
    if (content === undefined) return xmlError(404, "NoSuchKey");
    const etag = `"${etagOf(content)}"`;
    const ifMatch = request.headers.get("if-match");
    if (ifMatch !== null && ifMatch !== etag) return xmlError(412, "PreconditionFailed");
    const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.get("range") ?? "");
    if (range !== null) {
      const start = Number(range[1]);
      const part = content.slice(start, Math.min(Number(range[2]) + 1, content.byteLength));
      return new Response(part, { status: 206, headers: { etag, "content-length": String(part.byteLength) } });
    }
    return new Response(content.slice(), { status: 200, headers: { etag, "content-length": String(content.byteLength) } });
  }

  /** PutObject (one part, its body matching the signed hash), HeadObject and DeleteObject of one key. */
  function write(request: Request, url: URL, key: string, body: Uint8Array | null): Response {
    if (key === "" || url.search !== "") return xmlError(501, "NotImplemented");
    const operation = request.method === "PUT" ? "put" : request.method === "HEAD" ? "head" : "delete";
    calls[operation] += 1;
    const failure = failures.get(operation);
    if (failure !== undefined) return xmlError(failure, "Injected");
    if (operation === "delete") {
      objects.delete(key);
      return new Response(null, { status: 204 });
    }
    if (operation === "head") {
      const content = objects.get(key);
      if (content === undefined) return new Response(null, { status: 404 });
      return new Response(null, { status: 200, headers: { etag: `"${etagOf(content)}"`, "content-length": String(content.byteLength) } });
    }
    const content = body ?? new Uint8Array();
    if (createHash("sha256").update(content).digest("hex") !== request.headers.get("x-amz-content-sha256")) return xmlError(400, "XAmzContentSHA256Mismatch");
    objects.set(key, content);
    return new Response(null, { status: 200, headers: { etag: `"${etagOf(content)}"` } });
  }

  function list(url: URL): Response {
    if (url.searchParams.get("list-type") !== "2") return xmlError(400, "InvalidArgument");
    const prefix = url.searchParams.get("prefix") ?? "";
    const maxKeys = Math.min(1000, Number(url.searchParams.get("max-keys") ?? "1000"));
    const start = Number(url.searchParams.get("continuation-token") ?? "0");
    const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
    const page = keys.slice(start, start + maxKeys);
    const isTruncated = start + maxKeys < keys.length;
    const contents = page
      .map((key) => {
        const content = objects.get(key) ?? new Uint8Array();
        return `<Contents><Key>${escapeXml(key)}</Key><LastModified>${LAST_MODIFIED}</LastModified><ETag>&quot;${etagOf(content)}&quot;</ETag><Size>${String(content.byteLength)}</Size><StorageClass>STANDARD</StorageClass></Contents>`;
      })
      .join("");
    const next = isTruncated ? `<NextContinuationToken>${String(start + maxKeys)}</NextContinuationToken>` : "";
    const body = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${escapeXml(options.bucket)}</Name><Prefix>${escapeXml(prefix)}</Prefix><KeyCount>${String(page.length)}</KeyCount><MaxKeys>${String(maxKeys)}</MaxKeys><IsTruncated>${String(isTruncated)}</IsTruncated>${contents}${next}</ListBucketResult>`;
    return new Response(body, { status: 200, headers: { "content-type": "application/xml" } });
  }

  return {
    calls,
    handle,
    fetch: (input, init) => handle(new Request(input, init)),
    put(key, content) {
      objects.set(key, typeof content === "string" ? encoder.encode(content) : content);
    },
    remove(key) {
      objects.delete(key);
    },
    fail(operation, status) {
      if (status === null) failures.delete(operation);
      else failures.set(operation, status);
    },
  };
}

/** Recomputes the request's signature with the known key pair and compares it with the one it carries. */
function isSigned(request: Request, url: URL, options: FakeS3Options): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, SignedHeaders=([a-z0-9;-]+), Signature=([0-9a-f]{64})$/.exec(authorization);
  const amzDate = request.headers.get("x-amz-date");
  if (match === null || amzDate === null || match[1] !== options.accessKeyId) return false;
  const [, , , region = "", signed = ""] = match;
  const date = new Date(`${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`);
  const headers: Record<string, string> = {};
  for (const name of signed.split(";")) {
    if (name === "host" || name === "x-amz-date" || name === "x-amz-content-sha256") continue;
    headers[name] = request.headers.get(name) ?? "";
  }
  const expected = signRequest({
    method: request.method,
    url,
    headers,
    payloadSha256: request.headers.get("x-amz-content-sha256") ?? "",
    region,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    date,
  });
  return expected.authorization === authorization;
}

/** The path without its trailing slashes (a loop, not a regular expression: no backtracking on a long run of "/"). */
function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end -= 1;
  return path.slice(0, end);
}

function xmlError(status: number, code: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`, { status, headers: { "content-type": "application/xml" } });
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
