// Reading a small request body with a hard cap, for public routes anyone can call (FIRE_TRACKER
// `src/lib/read-small-body.ts`). Without the cap, `request.text()` loads whatever the edge lets
// through into the memory of the app.
import { err, ok, type Err, type Ok } from "@softure-ai/core";

export interface ReadSmallBodyOptions {
  /** The largest body accepted, in bytes. */
  readonly maxBytes: number;
}

export type ReadSmallBodyResult = Ok<string> | Err<"security.body_too_large" | "security.body_unreadable">;

/**
 * The body as UTF-8 text, or an error when it is larger than `maxBytes` or cannot be read (the
 * client dropped the connection, or the body was already read). An empty request gives `""`.
 *
 * The stream is counted, not only the header: behind a proxy the body may arrive in chunks without
 * a `Content-Length`, and a header that understates the size must not let a larger body through.
 */
export async function readSmallBody(request: Request, options: ReadSmallBodyOptions): Promise<ReadSmallBodyResult> {
  const { maxBytes } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(`readSmallBody: maxBytes must be a whole number of bytes, got ${String(maxBytes)}`);
  }

  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return err("security.body_too_large");
  }
  if (request.body === null) {
    return ok("");
  }
  if (request.bodyUsed) {
    return err("security.body_unreadable");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      received += value.byteLength;
      if (received > maxBytes) {
        // Cancelling only stops the transfer; a failure to cancel changes nothing for the caller.
        await reader.cancel().catch(() => undefined);
        return err("security.body_too_large");
      }
      chunks.push(value);
    }
  } catch {
    // The client went away mid-body. Nothing about it is worth more than the code.
    return err("security.body_unreadable");
  }

  return ok(new TextDecoder().decode(concatChunks(chunks, received)));
}

function concatChunks(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
