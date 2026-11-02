// The upload route, framework-free: `PUT` writes one chunk (`Content-Range: bytes a-b/total`, or no range when the
// file fits one chunk), `HEAD` answers what arrived in headers so a client can resume, `GET` answers the same as JSON
// or, to a browser, the upload page. The URL's signature is checked before any database read, and every dead URL
// (forged, expired, finalized for a `PUT`) gets the same `404`. With the security module enabled each request counts
// in the `files-upload` bucket, keyed by the session.
import { errorLogLabel, getModule } from "@softure-ai/core";
import { consumeRateLimit, subjectKey } from "@softure-ai/security/server";
import type { UploadStatus } from "../contract.js";
import type { FilesContext } from "./context.js";
import { getUpload, writeUploadChunk, type UploadChunkErrorCode } from "./uploads.js";
import { renderUploadPage } from "./upload-page.js";
import { verifyUploadPath } from "./upload-tokens.js";

/** The security bucket the upload route counts in; `FILES_RATE_LIMIT_BUCKETS` holds its default. */
export const FILES_UPLOAD_RATE_LIMIT_BUCKET = "files-upload";

const BASE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
} as const;
const ALLOWED_METHODS = "GET, HEAD, PUT";
const CONTENT_RANGE_PATTERN = /^bytes (\d{1,15})-(\d{1,15})\/(\d{1,15})$/;
const ERROR_STATUS: Readonly<Record<UploadChunkErrorCode, number>> = {
  "files.not_found": 404,
  "files.invalid_range": 416,
  "files.chunk_length_mismatch": 400,
};

/** Answers a request to an upload URL (`GET`, `HEAD` or `PUT`). */
export async function serveUpload(ctx: FilesContext, request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "PUT") {
    return new Response(null, { status: 405, headers: { ...BASE_HEADERS, allow: ALLOWED_METHODS } });
  }
  const verified = verifyUploadPath(ctx, new URL(request.url).pathname);
  if (!verified.ok) {
    if (verified.error !== "files.not_found") console.error(`@softure-ai/files: an upload URL could not be checked: ${verified.error}`);
    return answerError("files.not_found");
  }
  const uploadId = verified.value;
  const limited = await countRequest(ctx, uploadId);
  if (limited !== null) return limited;

  if (request.method === "PUT") return putChunk(ctx, uploadId, request);
  const status = await getUpload(ctx, uploadId);
  if (status === null) return answerError("files.not_found");
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: { ...BASE_HEADERS, ...describeInHeaders(status) } });
  if (acceptsHtml(request)) return renderUploadPage(ctx, status);
  return answerJson(status);
}

async function putChunk(ctx: FilesContext, uploadId: string, request: Request): Promise<Response> {
  const header = request.headers.get("content-range");
  const match = header === null ? null : CONTENT_RANGE_PATTERN.exec(header.trim());
  if (header !== null && match === null) return answerError("files.invalid_range");
  const range = match === null ? null : { start: Number(match[1]), end: Number(match[2]) };
  const declaredLength = request.headers.get("content-length");
  // A body that cannot fit its range is refused before a byte of it is read.
  if (range !== null && declaredLength !== null && Number(declaredLength) !== range.end - range.start + 1) return answerError("files.chunk_length_mismatch");
  try {
    const written = await writeUploadChunk(ctx, uploadId, {
      range,
      ...(match === null ? {} : { total: Number(match[3]) }),
      body: request.body ?? emptyBody(),
    });
    return written.ok ? answerJson(written.value) : answerError(written.error);
  } catch (error) {
    console.error(`@softure-ai/files: storing a chunk of upload ${uploadId} failed: ${errorLogLabel(error)}`);
    throw error;
  }
}

/** Counts the request in the security bucket when the app enabled that module; a `429` when over the limit. */
async function countRequest(ctx: FilesContext, uploadId: string): Promise<Response | null> {
  const security = getModule(ctx.config, "security");
  if (security === undefined) return null;
  const buckets = (security.options as { buckets?: Record<string, unknown> }).buckets;
  if (buckets?.[FILES_UPLOAD_RATE_LIMIT_BUCKET] === undefined) {
    throw new Error(
      `@softure-ai/files: the security module has no "${FILES_UPLOAD_RATE_LIMIT_BUCKET}" bucket; spread FILES_RATE_LIMIT_BUCKETS into security({ buckets })`,
    );
  }
  const counted = await consumeRateLimit(ctx, { bucket: FILES_UPLOAD_RATE_LIMIT_BUCKET, key: subjectKey(`upload:${uploadId}`) });
  if (counted.ok) return null;
  return new Response(null, { status: 429, headers: { ...BASE_HEADERS, "retry-after": String(counted.retryAfterSeconds) } });
}

/** What arrived, for `HEAD`: `upload-received` lists the byte ranges (`0-1023,2048-2559`), empty when none. */
function describeInHeaders(status: UploadStatus): Record<string, string> {
  return {
    "upload-state": status.state,
    "upload-size": String(status.size),
    "upload-chunk-size": String(status.chunkSize),
    "upload-received": status.received.map((range) => `${String(range.start)}-${String(range.end)}`).join(","),
    "upload-expires": status.expiresAt.toISOString(),
  };
}

function answerJson(status: UploadStatus): Response {
  return Response.json(
    { ...status, expiresAt: status.expiresAt.toISOString() },
    { status: 200, headers: { ...BASE_HEADERS, ...describeInHeaders(status) } },
  );
}

function answerError(code: UploadChunkErrorCode): Response {
  return Response.json({ error: code }, { status: ERROR_STATUS[code], headers: BASE_HEADERS });
}

function acceptsHtml(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

async function* emptyBody(): AsyncGenerator<Uint8Array> {
  // A PUT without a body: nothing to yield.
}
