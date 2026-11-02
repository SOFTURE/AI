// A streaming `multipart/form-data` reader (RFC 7578). `Request.formData()` holds the whole body in memory; this reads
// one part after another from the request's stream and hands each part's body on as it arrives, holding back only the
// bytes that could start the next boundary. Unread part bodies are skipped when the next part is asked for.

export type MultipartErrorCode = "pwa.share_malformed";

/** A body that breaks the multipart format; the share route answers 400. */
export class MultipartError extends Error {
  readonly code: MultipartErrorCode = "pwa.share_malformed";

  constructor(detail: string) {
    super(`@softure-ai/pwa: malformed multipart body: ${detail}`);
  }
}

export interface MultipartPart {
  /** The form field name. */
  readonly name: string;
  /** The file name the client sent; null for a text field. */
  readonly fileName: string | null;
  /** The part's `Content-Type`; null when it has none. */
  readonly contentType: string | null;
  /** The part's bytes as they arrive. Read it before asking for the next part, or it is skipped. */
  readonly body: AsyncIterable<Uint8Array>;
}

export interface ReadMultipartOptions {
  /** The longest preamble or header block of one part, in bytes: 8 KiB by default. */
  readonly maxHeaderBytes?: number;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const CRLF = ENCODER.encode("\r\n");
const HEADER_END = ENCODER.encode("\r\n\r\n");
const CLOSE = ENCODER.encode("--");

/** The boundary of a `multipart/form-data` content type, or null for any other type. */
export function getMultipartBoundary(contentType: string | null): string | null {
  if (contentType === null) return null;
  const [type = "", ...parameters] = contentType.split(";");
  if (type.trim().toLowerCase() !== "multipart/form-data") return null;
  for (const parameter of parameters) {
    const separator = parameter.indexOf("=");
    if (separator === -1 || parameter.slice(0, separator).trim().toLowerCase() !== "boundary") continue;
    const value = parameter.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1");
    return value.length > 0 && value.length <= 70 ? value : null;
  }
  return null;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  const last = haystack.length - needle.length;
  outer: for (let start = from; start <= last; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return start;
  }
  return -1;
}

function startsWithBytes(haystack: Uint8Array, prefix: Uint8Array): boolean {
  return haystack.length >= prefix.length && indexOfBytes(haystack.subarray(0, prefix.length), prefix) === 0;
}

/** A buffer over a stream reader: reads a chunk when asked and gives bytes out from the front. */
class ByteBuffer {
  private bytes = new Uint8Array(0);
  private isDone = false;

  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}

  get view(): Uint8Array {
    return this.bytes;
  }

  /** Reads one more chunk; false once the stream has ended. */
  async fill(): Promise<boolean> {
    if (this.isDone) return false;
    const { done, value } = await this.reader.read();
    if (done) {
      this.isDone = true;
      return false;
    }
    const joined = new Uint8Array(this.bytes.length + value.length);
    joined.set(this.bytes);
    joined.set(value, this.bytes.length);
    this.bytes = joined;
    return true;
  }

  /** Reads until at least `length` bytes are buffered; false when the stream ends first. */
  async ensure(length: number): Promise<boolean> {
    while (this.bytes.length < length) {
      if (!(await this.fill())) return false;
    }
    return true;
  }

  take(length: number): Uint8Array {
    const taken = this.bytes.slice(0, length);
    this.bytes = this.bytes.subarray(length);
    return taken;
  }
}

/** Reads a quoted or bare parameter value of a header; `\"` and `\\` unescaped. */
function readParameter(header: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([^;\\s]*))`, "i");
  const match = pattern.exec(header);
  if (match === null) return null;
  return match[1] === undefined ? (match[2] ?? "") : match[1].replace(/\\(.)/g, "$1");
}

function parseHeaders(block: string): { name: string; fileName: string | null; contentType: string | null } {
  let disposition: string | null = null;
  let contentType: string | null = null;
  for (const line of block.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) throw new MultipartError("a part header has no colon");
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "content-disposition") disposition = value;
    if (field === "content-type") contentType = value;
  }
  if (disposition === null || !/^form-data\s*(;|$)/i.test(disposition)) throw new MultipartError("a part is not form-data");
  const name = readParameter(disposition.replace(/^form-data/i, ""), "name");
  if (name === null) throw new MultipartError("a part has no name");
  return { name, fileName: readParameter(disposition.replace(/^form-data/i, ""), "filename"), contentType };
}

/**
 * The parts of a `multipart/form-data` body, in order. A broken body throws `MultipartError` from the iteration. The
 * stream is released when the iteration ends, and cancelled when it is left early (`return()`).
 */
export async function* readMultipart(
  stream: ReadableStream<Uint8Array>,
  boundary: string,
  { maxHeaderBytes = 8192 }: ReadMultipartOptions = {},
): AsyncGenerator<MultipartPart, void, undefined> {
  const reader = stream.getReader();
  const buffer = new ByteBuffer(reader);
  const opening = ENCODER.encode(`--${boundary}`);
  const delimiter = ENCODER.encode(`\r\n--${boundary}`);
  let isComplete = false;

  /** After a boundary: `--` ends the body, CRLF starts a part. True when another part follows. */
  async function readAfterBoundary(): Promise<boolean> {
    if (!(await buffer.ensure(2))) throw new MultipartError("the body ends after a boundary");
    if (startsWithBytes(buffer.view, CLOSE)) {
      buffer.take(2);
      isComplete = true;
      return false;
    }
    if (!startsWithBytes(buffer.view, CRLF)) throw new MultipartError("a boundary is not followed by a line break");
    buffer.take(2);
    return true;
  }

  try {
    // The preamble, then the first boundary.
    for (;;) {
      const at = indexOfBytes(buffer.view, opening);
      if (at !== -1) {
        buffer.take(at + opening.length);
        break;
      }
      if (buffer.view.length > maxHeaderBytes) throw new MultipartError("no boundary within the first bytes");
      if (!(await buffer.fill())) throw new MultipartError("no boundary");
    }
    let hasPart = await readAfterBoundary();

    while (hasPart) {
      let headerEnd = indexOfBytes(buffer.view, HEADER_END);
      while (headerEnd === -1) {
        if (buffer.view.length > maxHeaderBytes) throw new MultipartError("a part's headers are too long");
        if (!(await buffer.fill())) throw new MultipartError("the body ends inside a part's headers");
        headerEnd = indexOfBytes(buffer.view, HEADER_END);
      }
      if (headerEnd > maxHeaderBytes) throw new MultipartError("a part's headers are too long");
      const headers = parseHeaders(DECODER.decode(buffer.take(headerEnd)));
      buffer.take(HEADER_END.length);

      let isPartEnded = false;
      /** The next chunk of this part's body, or null at its end (the boundary after it is read too). */
      const readChunk = async (): Promise<Uint8Array | null> => {
        while (!isPartEnded) {
          const at = indexOfBytes(buffer.view, delimiter);
          if (at !== -1) {
            const chunk = buffer.take(at);
            buffer.take(delimiter.length);
            isPartEnded = true;
            hasPart = await readAfterBoundary();
            if (chunk.length > 0) return chunk;
            return null;
          }
          const safe = buffer.view.length - (delimiter.length - 1);
          if (safe > 0) return buffer.take(safe);
          if (!(await buffer.fill())) throw new MultipartError("the body ends inside a part");
        }
        return null;
      };
      const body: AsyncIterable<Uint8Array> = {
        async *[Symbol.asyncIterator]() {
          for (let chunk = await readChunk(); chunk !== null; chunk = await readChunk()) yield chunk;
        },
      };

      yield { ...headers, body };
      // The part's unread bytes are skipped.
      while (!isPartEnded) await readChunk();
    }
  } finally {
    if (isComplete) reader.releaseLock();
    else await reader.cancel().catch(() => undefined);
  }
}

/** A text part's value as UTF-8, or null when it is longer than `maxBytes`. */
export async function readTextPart(part: MultipartPart, maxBytes: number): Promise<string | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of part.body) {
    size += chunk.length;
    if (size > maxBytes) return null;
    chunks.push(chunk);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return DECODER.decode(joined);
}
