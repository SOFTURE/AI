// The public link answer, framework-free: `GET` and `HEAD` with `Content-Length`, `Accept-Ranges`, single byte
// ranges (`206`, `416`), `Content-Disposition`, and `Cache-Control: private, no-store` so no CDN keeps a copy. Every
// dead link (forged, expired, revoked, deleted, missing from storage) gets the same `404`. A stored file is user
// content on the app's origin, so it is sent with `nosniff` and a sandboxing CSP: an HTML or SVG file never runs.
import { errorLogLabel } from "@softure-ai/core";
import type { ByteRange } from "../contract.js";
import type { FilesContext } from "./context.js";
import { findLiveRow } from "./files.js";
import { verifyFileLink } from "./links.js";
import { formatContentDisposition } from "./names.js";
import { getFilesOptions } from "./options.js";

const BASE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
} as const;
const ALLOWED_METHODS = "GET, HEAD";

const NOT_FOUND_BODY = "Not found\n";

/** The one answer for every link that does not lead to a live file. */
function notFound(): Response {
  return new Response(NOT_FOUND_BODY, {
    status: 404,
    headers: {
      ...BASE_HEADERS,
      "content-type": "text/plain; charset=utf-8",
      "content-length": String(NOT_FOUND_BODY.length),
    },
  });
}

/** Answers a request for a public link (`GET` or `HEAD`). */
export async function serveFileLink(ctx: FilesContext, request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { ...BASE_HEADERS, allow: ALLOWED_METHODS },
    });
  }
  const link = verifyFileLink(ctx, new URL(request.url).pathname);
  if (!link.ok) {
    if (link.error !== "files.not_found") console.error(`@softure-ai/files: a link could not be checked: ${link.error}`);
    return notFound();
  }
  const row = await findLiveRow(ctx, link.value.fileId);
  if (row?.linkGeneration !== link.value.generation) return notFound();

  const options = getFilesOptions(ctx.config);
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    "content-type": row.contentType,
    "accept-ranges": "bytes",
    "content-disposition": formatContentDisposition(options.links.disposition, link.value.name),
    "content-security-policy": "sandbox; default-src 'none'",
  };
  const range = parseRangeHeader(request.headers.get("range"), row.size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "content-range": `bytes */${String(row.size)}` },
    });
  }
  const status = range === null ? 200 : 206;
  headers["content-length"] = String(range === null ? row.size : range.end - range.start + 1);
  if (range !== null) headers["content-range"] = `bytes ${String(range.start)}-${String(range.end)}/${String(row.size)}`;
  if (request.method === "HEAD") return new Response(null, { status, headers });

  let body: ReadableStream<Uint8Array> | null;
  try {
    body = await options.storage.get(row.storageKey, range ?? undefined);
  } catch (error) {
    console.error(`@softure-ai/files: reading file ${row.id} from storage failed: ${errorLogLabel(error)}`);
    throw error;
  }
  if (body === null) {
    console.error(`@softure-ai/files: file ${row.id} has a row but no bytes in storage`);
    return notFound();
  }
  return new Response(body, { status, headers });
}

/**
 * The single byte range a `Range` header asks for in a file of `size` bytes (RFC 9110 §14): null to answer the whole
 * file (no header, a malformed one, another unit or several ranges, which a server may ignore), `"unsatisfiable"`
 * for a range that starts past the end.
 */
export function parseRangeHeader(value: string | null, size: number): ByteRange | "unsatisfiable" | null {
  const match = value === null ? null : /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (match === null) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;
  if (first === "") {
    const suffix = Number(last);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = Number(first);
  if (last !== "" && Number(last) < start) return null;
  if (start >= size) return "unsatisfiable";
  return {
    start,
    end: last === "" ? size - 1 : Math.min(Number(last), size - 1),
  };
}
