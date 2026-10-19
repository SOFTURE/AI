import { describe, expect, it } from "vitest";
import { z } from "zod";
import { coreMessages, requestJson, toQueryString, type HttpJsonFailure } from "@softure-ai/core";

const API_KEY = "sk_live_secret_123";
const URL_WITH_KEY = `https://api.example.com/v1/rates?api_key=${API_KEY}`;

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

function respondWith(body: string, status = 200): Response {
  return new Response(status === 204 ? null : body, { status, headers: { "content-type": "application/json" } });
}

async function requestWithStatus(status: number) {
  const { fetch } = createFakeFetch(() => respondWith('{"error":"no"}', status));
  return requestJson({ fetch, url: URL_WITH_KEY });
}

describe("requestJson: success", () => {
  it("returns the JSON body as unknown without a schema", async () => {
    const { fetch } = createFakeFetch(() => respondWith('{"rate":4.25,"currency":"PLN"}'));
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({ ok: true, value: { rate: 4.25, currency: "PLN" } });
  });

  it("returns the schema's output with a schema", async () => {
    const schema = z.object({ rate: z.coerce.number() });
    const { fetch } = createFakeFetch(() => respondWith('{"rate":"4.25","extra":true}'));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, schema });
    expect(result).toEqual({ ok: true, value: { rate: 4.25 } });
  });

  it("sends a GET that follows no redirects, asks for JSON and carries a timeout signal", async () => {
    const { fetch, requests } = createFakeFetch(() => respondWith("{}"));
    await requestJson({ fetch, url: new URL(URL_WITH_KEY), headers: { "X-Api-Key": API_KEY } });

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe(URL_WITH_KEY);
    expect(request?.init.method).toBe("GET");
    expect(request?.init.redirect).toBe("manual");
    expect(request?.init.signal).toBeInstanceOf(AbortSignal);
    const headers = new Headers(request?.init.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-api-key")).toBe(API_KEY);
  });

  it("keeps the caller's own Accept header in any letter case", async () => {
    const { fetch, requests } = createFakeFetch(() => respondWith("{}"));
    await requestJson({ fetch, url: URL_WITH_KEY, headers: [["accept", "application/vnd.api+json"]] });
    expect(new Headers(requests[0]?.init.headers).get("accept")).toBe("application/vnd.api+json");
  });
});

describe("requestJson: status classes", () => {
  it.each([301, 302, 307, 308])("refuses a %i redirect", async (status) => {
    expect(await requestWithStatus(status)).toEqual({ ok: false, error: "core.http_refused", status });
  });

  it("refuses an opaque redirect (a browser's answer to redirect: manual)", async () => {
    const opaque = Object.defineProperties(new Response(null, { status: 200 }), {
      type: { value: "opaqueredirect" },
      status: { value: 0 },
      ok: { value: false },
    });
    const { fetch } = createFakeFetch(() => opaque);
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({ ok: false, error: "core.http_refused", status: 0 });
  });

  it.each([401, 403])("refuses a %i", async (status) => {
    expect(await requestWithStatus(status)).toEqual({ ok: false, error: "core.http_refused", status });
  });

  it("reports a 429 as rate limited", async () => {
    expect(await requestWithStatus(429)).toEqual({ ok: false, error: "core.http_rate_limited", status: 429 });
  });

  it.each([500, 502, 503, 504])("reports a %i as unavailable", async (status) => {
    expect(await requestWithStatus(status)).toEqual({ ok: false, error: "core.http_unavailable", status });
  });

  it.each([400, 404, 410])("reports any other status (%i) as an unexpected answer", async (status) => {
    expect(await requestWithStatus(status)).toEqual({ ok: false, error: "core.http_unexpected_answer", status });
  });
});

describe("requestJson: failed requests", () => {
  it("cancels the body of a failed status so the connection is released", async () => {
    let isCancelled = false;
    const body = new ReadableStream({
      cancel() {
        isCancelled = true;
      },
    });
    const { fetch } = createFakeFetch(() => new Response(body, { status: 503 }));
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({ ok: false, error: "core.http_unavailable", status: 503 });
    expect(isCancelled).toBe(true);
  });

  it("does not leak an invalid header value through a thrown error", async () => {
    const { fetch, requests } = createFakeFetch(() => respondWith("{}"));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, headers: { Authorization: `Bearer ${API_KEY}\nX-Injected: 1` } });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: null });
    expect(requests).toHaveLength(0);
  });
});

describe("requestJson: unexpected answers", () => {
  it("reports a body that is not JSON", async () => {
    const { fetch } = createFakeFetch(() => respondWith("<html>maintenance</html>"));
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 200,
    });
  });

  it("reports an empty body", async () => {
    const { fetch } = createFakeFetch(() => respondWith("", 204));
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 204,
    });
  });

  it("reports a body that fails the schema", async () => {
    const { fetch } = createFakeFetch(() => respondWith('{"rate":"not a number"}'));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, schema: z.object({ rate: z.number() }) });
    expect(result).toEqual({ ok: false, error: "core.http_unexpected_answer", status: 200 });
  });
});

describe("requestJson: unreachable", () => {
  it("reports a network error without its message", async () => {
    const fetch = () => Promise.reject(new TypeError(`fetch failed for ${URL_WITH_KEY}`));
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({
      ok: false,
      error: "core.http_unreachable",
      status: null,
    });
  });

  it("reports a timeout", async () => {
    const fetch = (_input: string | URL, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
        });
      });
    expect(await requestJson({ fetch, url: URL_WITH_KEY, timeoutMs: 5 })).toEqual({
      ok: false,
      error: "core.http_unreachable",
      status: null,
    });
  });

  it("reports a body that breaks off while it is read", async () => {
    const broken = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error(`stream aborted for ${URL_WITH_KEY}`));
        },
      }),
      { status: 200 },
    );
    const { fetch } = createFakeFetch(() => broken);
    expect(await requestJson({ fetch, url: URL_WITH_KEY })).toEqual({
      ok: false,
      error: "core.http_unreachable",
      status: 200,
    });
  });
});

describe("requestJson: no secret in a failure", () => {
  it("never puts the URL, the key or the error text into any failure", async () => {
    const answers: (() => Promise<Response>)[] = [
      () => Promise.reject(new TypeError(`fetch failed for ${URL_WITH_KEY}`)),
      ...[302, 401, 429, 500, 404].map((status) => () => Promise.resolve(respondWith(URL_WITH_KEY, status))),
      () => Promise.resolve(respondWith(`not json ${URL_WITH_KEY}`)),
      () => Promise.resolve(respondWith(JSON.stringify({ rate: URL_WITH_KEY }))),
    ];
    const failures: HttpJsonFailure[] = [];
    for (const answer of answers) {
      const result = await requestJson({
        fetch: answer,
        url: URL_WITH_KEY,
        headers: { Authorization: `Bearer ${API_KEY}` },
        schema: z.object({ rate: z.number() }),
      });
      if (!result.ok) {
        failures.push(result);
      }
    }

    expect(failures).toHaveLength(answers.length);
    for (const failure of failures) {
      const text = JSON.stringify(failure);
      expect(text).not.toContain(API_KEY);
      expect(text).not.toContain("api.example.com");
      expect(Object.keys(failure).sort()).toEqual(["error", "ok", "status"]);
    }
  });
});

describe("coreMessages for the HTTP codes", () => {
  it("has English copy for every failure code", () => {
    const errors = coreMessages.en.errors;
    expect(errors.http_unreachable).toBe("The service could not be reached. Please try again later.");
    expect(errors.http_refused).toBe("The service refused the request.");
    expect(errors.http_rate_limited).toBe("The service is receiving too many requests. Please try again later.");
    expect(errors.http_unavailable).toBe("The service is unavailable right now. Please try again later.");
    expect(errors.http_unexpected_answer).toBe("The service sent an answer that could not be read.");
  });
});

describe("toQueryString", () => {
  it("encodes strings, numbers and booleans in insertion order", () => {
    expect(toQueryString({ q: "rates & more/€", page: 2, exact: true, empty: "" })).toBe(
      "q=rates+%26+more%2F%E2%82%AC&page=2&exact=true&empty=",
    );
  });

  it("skips null and undefined", () => {
    expect(toQueryString({ from: "2026-10-01", to: undefined, cursor: null })).toBe("from=2026-10-01");
  });

  it("returns an empty string for nothing to encode", () => {
    expect(toQueryString({})).toBe("");
    expect(toQueryString({ a: undefined })).toBe("");
  });
});
