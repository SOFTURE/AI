// requestText: a text page (HTML) read with requestBytes' rules (timeout, status codes, size cap, no message quoting
// the URL), redirects followed only on request, the final URL answered and 404/410 optionally read as no page.
import { describe, expect, it } from "vitest";
import { createTestClock, requestText, type HttpTextFailure } from "@softure-ai/core";

const URL_WITH_KEY = "https://www.example.com/listing/42?token=secret_123";
const PAGE = '<html><script>window.__ID__ = "abc";</script></html>';

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

/** A response whose `url` reads as the final URL after redirects, as a real `fetch` sets it. */
function createRedirectedResponse(body: string, url: string): Response {
  const response = new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function createChunkedBody(chunks: readonly Uint8Array[]): { body: ReadableStream<Uint8Array>; state: { cancelled: boolean } } {
  const state = { cancelled: false };
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
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

describe("requestText: success", () => {
  it("answers the text, the URL, the status and the content type of a GET", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({
      ok: true,
      value: { text: PAGE, url: URL_WITH_KEY, status: 200, contentType: "text/html; charset=utf-8" },
    });
    expect(requests[0]?.init).toMatchObject({ method: "GET", redirect: "manual" });
    expect(headerOf(requests[0], "accept")).toBe("text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8");
  });

  it("sends the accept option, replacing an accept header", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response("a,b"));
    await requestText({ fetch, url: URL_WITH_KEY, accept: "text/csv", headers: { Accept: "text/html", "x-trace": "t1" } });
    expect(headerOf(requests[0], "accept")).toBe("text/csv");
    expect(headerOf(requests[0], "x-trace")).toBe("t1");
  });

  it("keeps the caller's accept header when the option is not given", async () => {
    const { fetch, requests } = createFakeFetch(() => new Response("x"));
    await requestText({ fetch, url: URL_WITH_KEY, headers: [["accept", "text/plain"]] });
    expect(headerOf(requests[0], "accept")).toBe("text/plain");
  });

  it("decodes the body with the charset of the content type", async () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);
    const { fetch } = createFakeFetch(() => new Response(latin1, { headers: { "content-type": 'text/html; charset="ISO-8859-1"' } }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result.ok && result.value.text).toBe("café");
  });

  it("falls back to UTF-8 for an unknown charset and strips a byte order mark", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("café")]);
    const { fetch } = createFakeFetch(() => new Response(bytes, { headers: { "content-type": "text/html; charset=no-such-charset" } }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result.ok && result.value.text).toBe("café");
  });

  it("answers an empty body as an empty text with a null content type", async () => {
    const { fetch } = createFakeFetch(() => new Response(null, { status: 200 }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: true, value: { text: "", url: URL_WITH_KEY, status: 200, contentType: null } });
  });

  it("accepts a URL object and answers it as a string", async () => {
    const { fetch } = createFakeFetch(() => new Response(PAGE));
    const result = await requestText({ fetch, url: new URL(URL_WITH_KEY) });
    expect(result.ok && result.value.url).toBe(URL_WITH_KEY);
  });
});

describe("requestText: redirects", () => {
  it("refuses a redirect by default", async () => {
    const { fetch } = createFakeFetch(() => new Response(null, { status: 301, headers: { location: "https://elsewhere.example/" } }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_refused", status: 301 });
  });

  it("follows redirects on request and answers the final URL", async () => {
    const finalUrl = "https://www.example.com/listing/42-renamed";
    const { fetch, requests } = createFakeFetch(() => createRedirectedResponse(PAGE, finalUrl));
    const result = await requestText({ fetch, url: URL_WITH_KEY, followRedirects: true });
    expect(requests[0]?.init.redirect).toBe("follow");
    expect(result).toEqual({
      ok: true,
      value: { text: PAGE, url: finalUrl, status: 200, contentType: "text/html; charset=utf-8" },
    });
  });

  it("reads a redirect loop (fetch throws) as unreachable", async () => {
    const fetch = (): Promise<Response> => Promise.reject(new TypeError(`fetch failed: redirect count exceeded ${URL_WITH_KEY}`));
    const result = await requestText({ fetch, url: URL_WITH_KEY, followRedirects: true });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: null });
    expect(JSON.stringify(result)).not.toContain("secret_123");
  });
});

describe("requestText: not found", () => {
  it.each([404, 410])("fails %i as an unexpected answer by default", async (status) => {
    const { fetch } = createFakeFetch(() => new Response("gone", { status }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_unexpected_answer", status });
  });

  it.each([404, 410])("answers %i as null with notFoundAsNull and cancels the body", async (status) => {
    const { body, state } = createChunkedBody([new TextEncoder().encode("gone")]);
    const { fetch } = createFakeFetch(() => new Response(body, { status }));
    const result = await requestText({ fetch, url: URL_WITH_KEY, notFoundAsNull: true });
    expect(result).toEqual({ ok: true, value: null });
    expect(state.cancelled).toBe(true);
  });

  it("still fails another 4xx with notFoundAsNull", async () => {
    const { fetch } = createFakeFetch(() => new Response("bad", { status: 400 }));
    const result = await requestText({ fetch, url: URL_WITH_KEY, notFoundAsNull: true });
    expect(result).toEqual({ ok: false, error: "core.http_unexpected_answer", status: 400 });
  });

  it("answers a found page with notFoundAsNull as usual", async () => {
    const { fetch } = createFakeFetch(() => new Response(PAGE));
    const result = await requestText({ fetch, url: URL_WITH_KEY, notFoundAsNull: true });
    expect(result.ok && result.value?.text).toBe(PAGE);
  });
});

describe("requestText: failures", () => {
  it.each<[number, HttpTextFailure["error"]]>([
    [401, "core.http_refused"],
    [403, "core.http_refused"],
    [409, "core.http_conflict"],
    [418, "core.http_unexpected_answer"],
  ])("maps %i to %s", async (status, error) => {
    const { fetch } = createFakeFetch(() => new Response("no", { status }));
    expect(await requestText({ fetch, url: URL_WITH_KEY })).toEqual({ ok: false, error, status });
  });

  it("reads Retry-After seconds on a 429", async () => {
    const { fetch } = createFakeFetch(() => new Response("slow down", { status: 429, headers: { "retry-after": "120" } }));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_rate_limited", status: 429, retryAfterSeconds: 120 });
  });

  it("measures a Retry-After date on a 503 with the clock", async () => {
    const clock = createTestClock(new Date("2026-10-27T12:00:00Z"));
    const { fetch } = createFakeFetch(() =>
      new Response("down", { status: 503, headers: { "retry-after": "Tue, 27 Oct 2026 12:01:30 GMT" } }),
    );
    const result = await requestText({ fetch, url: URL_WITH_KEY, clock });
    expect(result).toEqual({ ok: false, error: "core.http_unavailable", status: 503, retryAfterSeconds: 90 });
  });

  it("reads a network error as unreachable without quoting the URL", async () => {
    const fetch = (): Promise<Response> => Promise.reject(new TypeError(`getaddrinfo ENOTFOUND ${URL_WITH_KEY}`));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: null });
    expect(JSON.stringify(result)).not.toContain("secret_123");
  });

  it("gives up after timeoutMs", async () => {
    const fetch = (_input: string | URL, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason as Error);
        });
      });
    const result = await requestText({ fetch, url: URL_WITH_KEY, timeoutMs: 10 });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: null });
  });

  it("reads a body that breaks off as unreachable with the status", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error(`socket closed ${URL_WITH_KEY}`));
      },
    });
    const { fetch } = createFakeFetch(() => new Response(body));
    const result = await requestText({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: 200 });
  });
});

describe("requestText: size cap", () => {
  it("refuses a Content-Length above maxBytes without reading the body", async () => {
    const { body, state } = createChunkedBody([new TextEncoder().encode(PAGE)]);
    const { fetch } = createFakeFetch(() => new Response(body, { headers: { "content-length": "1000" } }));
    const result = await requestText({ fetch, url: URL_WITH_KEY, maxBytes: 999 });
    expect(result).toEqual({ ok: false, error: "core.http_too_large", status: 200 });
    expect(state.cancelled).toBe(true);
  });

  it("refuses a streamed body that grows past maxBytes and cancels the rest", async () => {
    const chunk = new Uint8Array(6).fill(0x61);
    const { body, state } = createChunkedBody([chunk, chunk, chunk]);
    const { fetch } = createFakeFetch(() => new Response(body));
    const result = await requestText({ fetch, url: URL_WITH_KEY, maxBytes: 10 });
    expect(result).toEqual({ ok: false, error: "core.http_too_large", status: 200 });
    expect(state.cancelled).toBe(true);
  });

  it("accepts a body of exactly maxBytes", async () => {
    const { fetch } = createFakeFetch(() => new Response("abcde"));
    const result = await requestText({ fetch, url: URL_WITH_KEY, maxBytes: 5 });
    expect(result.ok && result.value.text).toBe("abcde");
  });

  it.each([0, -1, 1.5, Number.NaN])("throws for maxBytes %s before sending", async (maxBytes) => {
    const { fetch, requests } = createFakeFetch(() => new Response(PAGE));
    await expect(requestText({ fetch, url: URL_WITH_KEY, maxBytes })).rejects.toThrow(RangeError);
    expect(requests).toHaveLength(0);
  });
});
