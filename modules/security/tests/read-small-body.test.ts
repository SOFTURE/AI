// The size-capped body reader: by the declared length, by the bytes actually streamed, and when
// the stream breaks.
import { readSmallBody } from "@softure-ai/security";
import { describe, expect, it } from "vitest";

const URL_ = "http://localhost/beacon";

function streamOf(chunks: readonly string[], failAfter?: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (failAfter !== undefined && index === failAfter) {
        controller.error(new Error("connection reset"));
        return;
      }
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(chunk));
      }
    },
  });
}

function streamedRequest(body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
  return new Request(URL_, { method: "POST", body, headers, duplex: "half" } as RequestInit);
}

describe("readSmallBody", () => {
  it("returns a body of exactly maxBytes", async () => {
    const request = new Request(URL_, { method: "POST", body: "k=assumptions" });
    expect(await readSmallBody(request, { maxBytes: 13 })).toEqual({ ok: true, value: "k=assumptions" });
  });

  it("counts bytes, not characters", async () => {
    // Two euro signs: two characters, six bytes in UTF-8.
    const request = new Request(URL_, { method: "POST", body: "\u20ac\u20ac" });
    expect(await readSmallBody(request, { maxBytes: 6 })).toEqual({ ok: true, value: "\u20ac\u20ac" });
    expect(await readSmallBody(new Request(URL_, { method: "POST", body: "\u20ac\u20ac" }), { maxBytes: 5 })).toEqual({
      ok: false,
      error: "security.body_too_large",
    });
  });

  it("returns an empty string for a request without a body", async () => {
    expect(await readSmallBody(new Request(URL_), { maxBytes: 10 })).toEqual({ ok: true, value: "" });
  });

  it("rejects by Content-Length before reading anything", async () => {
    const body = streamOf(["never read"]);
    const request = streamedRequest(body, { "content-length": "11" });
    expect(await readSmallBody(request, { maxBytes: 10 })).toEqual({ ok: false, error: "security.body_too_large" });
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects a streamed body past the cap even when no length is declared", async () => {
    const request = streamedRequest(streamOf(["12345", "67890", "1"]));
    expect(await readSmallBody(request, { maxBytes: 10 })).toEqual({ ok: false, error: "security.body_too_large" });
  });

  it("rejects a body larger than an understated Content-Length", async () => {
    const request = streamedRequest(streamOf(["12345", "67890", "1"]), { "content-length": "3" });
    expect(await readSmallBody(request, { maxBytes: 10 })).toEqual({ ok: false, error: "security.body_too_large" });
  });

  it("reads a body that arrives in chunks", async () => {
    const request = streamedRequest(streamOf(["k=", "assump", "tions"]));
    expect(await readSmallBody(request, { maxBytes: 64 })).toEqual({ ok: true, value: "k=assumptions" });
  });

  it("returns body_unreadable when the stream fails mid-body", async () => {
    const request = streamedRequest(streamOf(["k=", "x"], 1));
    expect(await readSmallBody(request, { maxBytes: 64 })).toEqual({ ok: false, error: "security.body_unreadable" });
  });

  it("returns body_unreadable when the body was already read", async () => {
    const request = new Request(URL_, { method: "POST", body: "once" });
    await request.text();
    expect(await readSmallBody(request, { maxBytes: 64 })).toEqual({ ok: false, error: "security.body_unreadable" });
  });

  it("returns body_unreadable when another reader holds the body", async () => {
    const request = new Request(URL_, { method: "POST", body: "locked" });
    request.body?.getReader();
    expect(await readSmallBody(request, { maxBytes: 64 })).toEqual({ ok: false, error: "security.body_unreadable" });
  });

  it("returns body_unreadable for bytes that are not UTF-8 instead of replacing them", async () => {
    const request = new Request(URL_, { method: "POST", body: new Uint8Array([0xff, 0xfe, 0x41]) });
    expect(await readSmallBody(request, { maxBytes: 64 })).toEqual({ ok: false, error: "security.body_unreadable" });
  });

  it.each([-1, 1.5, Number.NaN])("throws on maxBytes %s", async (maxBytes) => {
    await expect(readSmallBody(new Request(URL_), { maxBytes })).rejects.toThrow("readSmallBody: maxBytes must be a whole number of bytes");
  });
});
