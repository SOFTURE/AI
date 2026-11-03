// Sends a browser `File` (any `Blob`) to an upload session: reads what arrived from the session's `HEAD`, then `PUT`s
// only the missing chunks, in order, with `Content-Range`. The session decides the chunk size; the route refuses any
// other alignment. Every expected failure is a value, never a throw.
//
// `sendUpload` is self-contained on purpose: it references nothing outside its own body, so the package's upload
// page inlines its source (`sendUpload.toString()`) and runs the very same loop without a bundler or a second copy.
// Keep every helper inside the function and import types only.
import type { Err, Ok } from "@softure-ai/core";

/** Why a send stopped: the session is gone, the route refused it, the network failed, or the caller aborted. */
export type SendUploadErrorCode = "files.upload_expired" | "files.upload_rejected" | "files.network" | "files.upload_aborted";

/** Bytes the session holds so far out of the file's size. */
export interface UploadProgress {
  readonly sentBytes: number;
  readonly totalBytes: number;
}

export interface SendUploadOptions {
  /** The session's signed upload URL, as `createUpload` returned it. */
  readonly uploadUrl: string;
  /** Aborts between chunks and the chunk in flight; the send answers `files.upload_aborted`. */
  readonly signal?: AbortSignal;
  /** Called once with what already arrived, then after every chunk. */
  readonly onProgress?: (progress: UploadProgress) => void;
  /** The `fetch` to use; the global one by default. */
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

export type SendUploadResult = Ok<UploadProgress> | Err<SendUploadErrorCode>;

/**
 * Sends the chunks of `file` the session does not hold yet. Resuming is calling it again: a chunk that arrived is
 * never sent twice. `404` answers `files.upload_expired`, another `4xx` (or a file whose size is not the session's)
 * `files.upload_rejected`, a failed request, `429` or `5xx` `files.network`.
 */
export async function sendUpload(file: Blob, options: SendUploadOptions): Promise<SendUploadResult> {
  const { uploadUrl, signal, onProgress } = options;
  const request = options.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
  const fail = (error: SendUploadErrorCode): Err<SendUploadErrorCode> => ({ ok: false, error });
  const failForStatus = (status: number): Err<SendUploadErrorCode> => {
    if (status === 404) return fail("files.upload_expired");
    return fail(status === 429 || status >= 500 ? "files.network" : "files.upload_rejected");
  };
  const isAborted = (): boolean => signal?.aborted === true;
  const call = async (init: RequestInit): Promise<Response | SendUploadErrorCode> => {
    if (isAborted()) return "files.upload_aborted";
    try {
      return await request(uploadUrl, { ...init, signal: signal ?? null });
    } catch {
      // A thrown fetch is the network or the abort; both are expected and answered as a code.
      return isAborted() ? "files.upload_aborted" : "files.network";
    }
  };

  const head = await call({ method: "HEAD" });
  if (typeof head === "string") return fail(head);
  if (!head.ok) return failForStatus(head.status);
  const totalBytes = Number(head.headers.get("upload-size"));
  const chunkSize = Number(head.headers.get("upload-chunk-size"));
  if (!Number.isSafeInteger(totalBytes) || !Number.isSafeInteger(chunkSize) || chunkSize <= 0 || totalBytes !== file.size) {
    return fail("files.upload_rejected");
  }
  const received: { start: number; end: number }[] = [];
  for (const part of (head.headers.get("upload-received") ?? "").split(",")) {
    const match = /^(\d+)-(\d+)$/.exec(part.trim());
    if (match !== null) received.push({ start: Number(match[1]), end: Number(match[2]) });
  }
  const missing: { start: number; end: number }[] = [];
  for (let start = 0; start < totalBytes; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalBytes) - 1;
    if (!received.some((range) => range.start <= start && range.end >= end)) missing.push({ start, end });
  }

  let sentBytes = totalBytes - missing.reduce((sum, chunk) => sum + chunk.end - chunk.start + 1, 0);
  onProgress?.({ sentBytes, totalBytes });
  for (const chunk of missing) {
    const answer = await call({
      method: "PUT",
      headers: { "content-range": `bytes ${String(chunk.start)}-${String(chunk.end)}/${String(totalBytes)}` },
      body: file.slice(chunk.start, chunk.end + 1),
    });
    if (typeof answer === "string") return fail(answer);
    if (!answer.ok) return failForStatus(answer.status);
    sentBytes += chunk.end - chunk.start + 1;
    onProgress?.({ sentBytes, totalBytes });
  }
  return { ok: true, value: { sentBytes, totalBytes } };
}
