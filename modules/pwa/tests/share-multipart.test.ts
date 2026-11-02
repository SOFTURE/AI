// The streaming multipart reader behind the share route (#959).
import { getMultipartBoundary, MultipartError, readMultipart, readTextPart, type MultipartPart } from "@softure-ai/pwa";
import { describe, expect, it } from "vitest";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const BOUNDARY = "----share-boundary-1234";

function body(parts: readonly { name: string; fileName?: string; type?: string; value: string }[]): string {
  const sections = parts.map(({ name, fileName, type, value }) => {
    const disposition = `Content-Disposition: form-data; name="${name}"${fileName === undefined ? "" : `; filename="${fileName}"`}`;
    return `--${BOUNDARY}\r\n${disposition}\r\n${type === undefined ? "" : `Content-Type: ${type}\r\n`}\r\n${value}\r\n`;
  });
  return `${sections.join("")}--${BOUNDARY}--\r\n`;
}

/** A stream of `text` cut into chunks of `size` bytes. */
function streamOf(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = ENCODER.encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
}

async function readAll(part: MultipartPart): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of part.body) chunks.push(chunk);
  return DECODER.decode(Buffer.concat(chunks));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<{ name: string; fileName: string | null; contentType: string | null; value: string }[]> {
  const result = [];
  for await (const part of readMultipart(stream, BOUNDARY)) {
    result.push({ name: part.name, fileName: part.fileName, contentType: part.contentType, value: await readAll(part) });
  }
  return result;
}

const SAMPLE = body([
  { name: "title", value: "Café ☕ 日本" },
  { name: "text", value: "line one\r\nline two -- not a boundary\r\n--almost" },
  { name: "media", fileName: "photo.png", type: "image/png", value: "\u0000\u0001PNG\r\n\r\n--x" },
  { name: "empty", fileName: "", type: "text/plain", value: "" },
]);

const EXPECTED = [
  { name: "title", fileName: null, contentType: null, value: "Café ☕ 日本" },
  { name: "text", fileName: null, contentType: null, value: "line one\r\nline two -- not a boundary\r\n--almost" },
  { name: "media", fileName: "photo.png", contentType: "image/png", value: "\u0000\u0001PNG\r\n\r\n--x" },
  { name: "empty", fileName: "", contentType: "text/plain", value: "" },
];

describe("readMultipart", () => {
  it("reads every part whatever the chunk size, a boundary split across chunks included", async () => {
    for (const size of [1, 2, 3, 5, 7, 16, 31, 64, 4096]) {
      expect(await collect(streamOf(SAMPLE, size))).toEqual(EXPECTED);
    }
  });

  it("skips a part's unread body when the next part is asked for", async () => {
    const names = [];
    for await (const part of readMultipart(streamOf(SAMPLE, 3), BOUNDARY)) names.push(part.name);
    expect(names).toEqual(["title", "text", "media", "empty"]);
  });

  it("hands a part's bytes on before the rest of the body arrives", async () => {
    const head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="media"; filename="big.bin"\r\n\r\n${"a".repeat(1000)}`;
    let isTailSent = false;
    let release: () => void = () => undefined;
    const tailReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!isTailSent && controller.desiredSize !== null) {
          controller.enqueue(ENCODER.encode(head));
          isTailSent = true;
          return;
        }
        await tailReady;
        controller.enqueue(ENCODER.encode(`\r\n--${BOUNDARY}--\r\n`));
        controller.close();
      },
    });
    const parts = readMultipart(stream, BOUNDARY);
    const first = await parts.next();
    if (first.done === true) throw new Error("expected a part");
    const iterator = first.value.body[Symbol.asyncIterator]();
    const chunk = await iterator.next();
    expect(chunk.done).toBe(false);
    expect(DECODER.decode(chunk.value as Uint8Array)).toBe("a".repeat(1000 - (`\r\n--${BOUNDARY}`.length - 1)));
    release();
    const rest = await iterator.next();
    expect(DECODER.decode(rest.value as Uint8Array)).toBe("a".repeat(`\r\n--${BOUNDARY}`.length - 1));
    expect((await iterator.next()).done).toBe(true);
    expect((await parts.next()).done).toBe(true);
  });

  it("reads quoted names with escapes and ignores a preamble", async () => {
    const text = `preamble\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="a\\"b"; filename="x\\\\y.txt"\r\n\r\nv\r\n--${BOUNDARY}--`;
    expect(await collect(streamOf(text, 4))).toEqual([{ name: 'a"b', fileName: "x\\y.txt", contentType: null, value: "v" }]);
  });

  it.each([
    ["no boundary at all", "just text"],
    ["a body that ends inside a part", `--${BOUNDARY}\r\nContent-Disposition: form-data; name="a"\r\n\r\nvalue`],
    ["a body that ends inside the headers", `--${BOUNDARY}\r\nContent-Disposition: form-data; name="a"`],
    ["a part that is not form-data", `--${BOUNDARY}\r\nContent-Disposition: attachment; name="a"\r\n\r\nv\r\n--${BOUNDARY}--`],
    ["a part without a name", `--${BOUNDARY}\r\nContent-Disposition: form-data\r\n\r\nv\r\n--${BOUNDARY}--`],
    ["a header line without a colon", `--${BOUNDARY}\r\nbroken\r\n\r\nv\r\n--${BOUNDARY}--`],
    ["a boundary followed by garbage", `--${BOUNDARY}xx`],
    ["headers over the limit", `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${"a".repeat(9000)}"\r\n\r\nv\r\n--${BOUNDARY}--`],
  ])("refuses %s", async (_case, text) => {
    await expect(collect(streamOf(text, 7))).rejects.toBeInstanceOf(MultipartError);
  });

  it("cancels the stream when the reading stops early", async () => {
    let isCancelled = false;
    const bytes = ENCODER.encode(SAMPLE);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 80));
      },
      cancel() {
        isCancelled = true;
      },
    });
    const parts = readMultipart(stream, BOUNDARY);
    await parts.next();
    await parts.return(undefined);
    expect(isCancelled).toBe(true);
  });
});

describe("readTextPart", () => {
  it("reads a text value up to the limit and answers null over it", async () => {
    const parts = readMultipart(streamOf(body([{ name: "a", value: "12345" }, { name: "b", value: "123456" }]), 2), BOUNDARY);
    const values = [];
    for await (const part of parts) values.push(await readTextPart(part, 5));
    expect(values).toEqual(["12345", null]);
  });
});

describe("getMultipartBoundary", () => {
  it.each([
    ["multipart/form-data; boundary=abc", "abc"],
    ['Multipart/Form-Data; charset=utf-8; boundary="a b"', "a b"],
    ["multipart/form-data", null],
    ["multipart/form-data; boundary=", null],
    [`multipart/form-data; boundary=${"x".repeat(71)}`, null],
    ["application/x-www-form-urlencoded", null],
    [null, null],
  ])("%j has the boundary %j", (contentType, expected) => {
    expect(getMultipartBoundary(contentType)).toBe(expected);
  });
});
