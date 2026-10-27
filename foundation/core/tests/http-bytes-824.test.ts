// requestBytes: a binary body read with requestJson's rules (timeout, no redirect, status codes, no message quoting
// the URL) and a size cap enforced while the body streams in.
import { describe, expect, it } from "vitest";
import { coreMessages, requestBytes, type HttpBytesFailure } from "@softure-ai/core";

const API_KEY = "sk_live_secret_123";
const URL_WITH_KEY = `https://api.example.com/v1/invoices/7/pdf?api_key=${API_KEY}`;
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function createFakeFetch(answer: (request: RecordedRequest) => Promise<Response> | Response) {
  const requests: RecordedRequest[] = [];
  const fetch = (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const request = { url: input.toString(), init };
    requests.push(request);
    return Promise.resolve(answer(request));
  };
  return { fetch, requests };
}

/** A body streamed in chunks with no Content-Length, pulled only when read; records the reads and a cancel. */
function createChunkedBody(chunks: readonly Uint8Array[]): { body: ReadableStream<Uint8Array>; state: { cancelled: boolean; pulled: number } } {
  const state = { cancelled: false, pulled: 0 };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[state.pulled];
      state.pulled += 1;
      if (chunk === undefined) controller.close();
      else controller.enqueue(chunk);
    },
    cancel() {
      state.cancelled = true;
    },
  }, { highWaterMark: 0 });
  return { body, state };
}

const headerOf = (request: RecordedRequest | undefined, name: string) => new Headers(request?.init.headers).get(name);

describe("requestBytes: success", () => {
  it("answers the exact bytes and the content type of a GET", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response(PDF, { headers: { "content-type": "application/pdf" } }));
    const result = await requestBytes({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: true, value: { bytes: PDF, contentType: "application/pdf" } });
    if (result.ok) expect(result.value.bytes).toBeInstanceOf(Uint8Array);
    expect(requests[0]?.init).toMatchObject({ method: "GET", redirect: "manual", body: undefined });
    expect(headerOf(requests[0], "accept")).toBe("*/*");
  });

  it("sends the accept option, replacing an accept header", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response(PDF));
    const result = await requestBytes({ fetch, url: URL_WITH_KEY, accept: "application/pdf", headers: { Accept: "text/html", "x-trace": "t1" } });
    expect(result).toEqual({ ok: true, value: { bytes: PDF, contentType: null } });
    expect(headerOf(requests[0], "accept")).toBe("application/pdf");
    expect(headerOf(requests[0], "x-trace")).toBe("t1");
  });

  it("keeps the caller's accept header when the option is not given", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response(PDF));
    await requestBytes({ fetch, url: URL_WITH_KEY, headers: [["accept", "application/pdf"]] });
    expect(headerOf(requests[0], "accept")).toBe("application/pdf");
  });

  it("sends a JSON body and an idempotency key with a write", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response(PDF, { headers: { "content-type": "application/pdf" } }));
    const result = await requestBytes({ fetch, url: URL_WITH_KEY, method: "POST", body: { invoiceId: 7 }, idempotencyKey: "k-1" });
    expect(result.ok).toBe(true);
    expect(requests[0]?.init).toMatchObject({ method: "POST", body: '{"invoiceId":7}' });
    expect(headerOf(requests[0], "content-type")).toBe("application/json");
    expect(headerOf(requests[0], "idempotency-key")).toBe("k-1");
  });

  it("answers an empty body as an empty array", async () => {
    const { fetch } = createFakeFetch(() => new Response(null, { status: 200 }));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY })).toEqual({ ok: true, value: { bytes: new Uint8Array(0), contentType: null } });
  });

  it("accepts a body of exactly maxBytes", async () => {
    const { body } = createChunkedBody([PDF.slice(0, 4), PDF.slice(4)]);
    const { fetch } = createFakeFetch(() => new Response(body));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY, maxBytes: PDF.length })).toEqual({ ok: true, value: { bytes: PDF, contentType: null } });
  });
});

describe("requestBytes: the size cap", () => {
  it("refuses a Content-Length above maxBytes without reading the body", async () => {
    const { body, state } = createChunkedBody([PDF]);
    const { fetch } = createFakeFetch(() => new Response(body, { headers: { "content-length": "9" } }));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY, maxBytes: 8 })).toEqual({ ok: false, error: "core.http_too_large", status: 200 });
    expect(state.pulled).toBe(0);
    expect(state.cancelled).toBe(true);
  });

  it("stops reading a streamed body as soon as it passes maxBytes", async () => {
    const chunk = new Uint8Array(4);
    const { body, state } = createChunkedBody([chunk, chunk, chunk, chunk, chunk]);
    const { fetch } = createFakeFetch(() => new Response(body));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY, maxBytes: 6 })).toEqual({ ok: false, error: "core.http_too_large", status: 200 });
    expect(state.pulled).toBe(2);
    expect(state.cancelled).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("throws for maxBytes %s before sending", async (maxBytes) => {
    const { fetch, requests } = createFakeFetch(() => new Response(PDF));
    await expect(requestBytes({ fetch, url: URL_WITH_KEY, maxBytes })).rejects.toThrow(RangeError);
    expect(requests).toEqual([]);
  });

  it("has English copy for the too large code", () => {
    expect(coreMessages.en.errors.http_too_large).toBe("The service sent a file that is too large.");
  });
});

describe("requestBytes: failures", () => {
  it.each<[number, HttpBytesFailure]>([
    [302, { ok: false, error: "core.http_refused", status: 302 }],
    [401, { ok: false, error: "core.http_refused", status: 401 }],
    [403, { ok: false, error: "core.http_refused", status: 403 }],
    [404, { ok: false, error: "core.http_unexpected_answer", status: 404 }],
    [409, { ok: false, error: "core.http_conflict", status: 409 }],
    [412, { ok: false, error: "core.http_conflict", status: 412 }],
    [503, { ok: false, error: "core.http_unavailable", status: 503, retryAfterSeconds: null }],
  ])("maps %i like requestJson and cancels the body", async (status, expected) => {
    const { body, state } = createChunkedBody([PDF]);
    const { fetch } = createFakeFetch(() => new Response(body, { status }));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY })).toEqual(expected);
    expect(state.cancelled).toBe(true);
  });

  it("reads Retry-After from a 429", async () => {
    const { fetch } = createFakeFetch(() => new Response(null, { status: 429, headers: { "retry-after": "30" } }));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY })).toEqual({ ok: false, error: "core.http_rate_limited", status: 429, retryAfterSeconds: 30 });
  });

  it("answers a network error as unreachable without quoting the URL", async () => {
    const fetch = () => Promise.reject(new Error(`connect failed for ${URL_WITH_KEY}`));
    const result = await requestBytes({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: null });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("answers a body that breaks off as unreachable", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error(`reset ${URL_WITH_KEY}`));
      },
    });
    const { fetch } = createFakeFetch(() => new Response(body));
    expect(await requestBytes({ fetch, url: URL_WITH_KEY })).toEqual({ ok: false, error: "core.http_unreachable", status: 200 });
  });

  it("gives up after timeoutMs", async () => {
    const fetch = (_input: string | URL, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => void reject(new Error("aborted")));
      });
    expect(await requestBytes({ fetch, url: URL_WITH_KEY, timeoutMs: 5 })).toEqual({ ok: false, error: "core.http_unreachable", status: null });
  });

  it("throws for a GET with a body, before sending", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response(PDF));
    // @ts-expect-error a GET carries no body
    await expect(requestBytes({ fetch, url: URL_WITH_KEY, body: { a: 1 } })).rejects.toThrow(TypeError);
    expect(requests).toEqual([]);
  });
});
