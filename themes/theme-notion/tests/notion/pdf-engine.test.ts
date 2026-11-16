// The pdf.js engine (MR-344 of an adopting app, #1256) in Node: a generated multi-page PDF opens with its page count,
// a page that is not a PDF is refused, and the engine loads once. Drawing needs a canvas, which the browser tests and
// the visual gallery cover; here pdf.js parses the real bytes.
import { describe, expect, it } from "vitest";

import { loadPdfjsEngine } from "../../src/notion/pdf-engine.js";
import { buildFictionalPdf } from "./fictional-pdf.js";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("loadPdfjsEngine (MR-344)", () => {
  it("MR-344 opens a generated three-page PDF with its page count", async () => {
    const engine = await loadPdfjsEngine();
    const document = await engine.open(toArrayBuffer(buildFictionalPdf(3)));

    expect(document.pageCount).toBe(3);
    document.destroy();
  });

  it("MR-344 opens a one-page PDF", async () => {
    const engine = await loadPdfjsEngine();
    const document = await engine.open(toArrayBuffer(buildFictionalPdf(1)));

    expect(document.pageCount).toBe(1);
    document.destroy();
  });

  it("MR-344 refuses bytes that are not a PDF", async () => {
    const engine = await loadPdfjsEngine();

    await expect(engine.open(toArrayBuffer(new TextEncoder().encode("<html>not a pdf</html>")))).rejects.toThrow();
  });

  it("MR-344 refuses an empty file", async () => {
    const engine = await loadPdfjsEngine();

    await expect(engine.open(new ArrayBuffer(0))).rejects.toThrow();
  });

  it("MR-344 loads pdf.js once and leaves the caller's bytes usable", async () => {
    const bytes = toArrayBuffer(buildFictionalPdf(2));
    const [first, second] = await Promise.all([loadPdfjsEngine(), loadPdfjsEngine()]);

    expect(first).toBe(second);
    const document = await first.open(bytes);
    expect([document.pageCount, bytes.byteLength > 0]).toEqual([2, true]);
    document.destroy();
  });
});
