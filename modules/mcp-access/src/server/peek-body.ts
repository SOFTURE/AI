// Reading a request's JSON body from a clone before the MCP SDK consumes the original. The clone is counted while it
// streams, so a chunked body without a Content-Length is never buffered whole. `readSmallBody` from
// `@softure-ai/security` would await the cancel of the clone, and the cancel of one branch of a teed stream only
// settles once the other branch is cancelled too: the SDK reads the original after this returns, so that wait never ends.

/**
 * The parsed JSON body of a clone of `request`, or `undefined` when it is over `maxBytes`, unreadable or not JSON.
 * The original request keeps its body.
 */
export async function peekJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > maxBytes) return undefined;
  const clone = request.clone();
  if (clone.body === null) return undefined;
  const reader = clone.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        // Not awaited: see the note above. Cancelling stops the clone from queueing what the SDK reads.
        reader.cancel().catch(() => undefined);
        return undefined;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    // The client went away mid-body, or the body is not UTF-8 JSON: the SDK answers that itself.
    return undefined;
  }
}
