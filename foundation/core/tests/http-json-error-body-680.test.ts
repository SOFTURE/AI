import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { requestJson, type HttpJsonErrorBodyFailure, type HttpJsonFailure } from "@softure-ai/core";

const TOKEN_URL = "https://auth.example.com/oauth/token";
const oauthErrorSchema = z.object({ error: z.string() });
const tokenSchema = z.object({ access_token: z.string() });

function createFakeFetch(answer: (init: RequestInit) => Response) {
  return (_input: string | URL, init: RequestInit = {}): Promise<Response> => Promise.resolve(answer(init));
}

function respondWith(body: string | null, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

/** A response whose body records whether it was read or cancelled. */
function trackedResponse(body: string, status: number) {
  const tracker = { pulled: false, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        tracker.pulled = true;
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
      cancel() {
        tracker.cancelled = true;
      },
    },
    // Pull only when read, so `pulled` tells a read from a cancel.
    { highWaterMark: 0 },
  );
  return { response: new Response(stream, { status }), tracker };
}

describe("requestJson: errorSchema on a 4xx, 429 or 5xx answer", () => {
  it.each([
    [400, "core.http_unexpected_answer"],
    [401, "core.http_refused"],
    [403, "core.http_refused"],
    [404, "core.http_unexpected_answer"],
    [409, "core.http_conflict"],
    [412, "core.http_conflict"],
  ] as const)("a %i carries the schema's output as errorBody (%s)", async (status, code) => {
    const fetch = createFakeFetch(() => respondWith('{"error":"invalid_grant","error_description":"x"}', status));
    const result = await requestJson({
      fetch,
      url: TOKEN_URL,
      method: "POST",
      form: new URLSearchParams({ grant_type: "refresh_token" }),
      schema: tokenSchema,
      errorSchema: oauthErrorSchema,
    });
    expect(result).toEqual({ ok: false, error: code, status, errorBody: { error: "invalid_grant" } });
  });

  it("keeps retryAfterSeconds on a 429 and a 503", async () => {
    for (const [status, code] of [
      [429, "core.http_rate_limited"],
      [503, "core.http_unavailable"],
    ] as const) {
      const fetch = createFakeFetch(() => respondWith('{"error":"slow_down"}', status, { "retry-after": "7" }));
      expect(await requestJson({ fetch, url: TOKEN_URL, errorSchema: oauthErrorSchema })).toEqual({
        ok: false,
        error: code,
        status,
        retryAfterSeconds: 7,
        errorBody: { error: "slow_down" },
      });
    }
  });

  it("keeps the headers read with readHeaders", async () => {
    const fetch = createFakeFetch(() => respondWith('{"error":"invalid_client"}', 401, { "x-request-id": "req_1" }));
    expect(
      await requestJson({ fetch, url: TOKEN_URL, errorSchema: oauthErrorSchema, readHeaders: ["X-Request-Id"] }),
    ).toEqual({
      ok: false,
      error: "core.http_refused",
      status: 401,
      headers: { "X-Request-Id": "req_1" },
      errorBody: { error: "invalid_client" },
    });
  });

  it("reads a Stripe-shaped error from a JSON write and drops what the schema does not name", async () => {
    const stripeErrorSchema = z.object({ error: z.object({ type: z.string(), code: z.string().optional() }) });
    const fetch = createFakeFetch(() =>
      respondWith('{"error":{"type":"invalid_request_error","code":"resource_missing","message":"secret"}}', 400),
    );
    const result = await requestJson({ fetch, url: TOKEN_URL, method: "POST", body: {}, errorSchema: stripeErrorSchema });
    expect(result).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 400,
      errorBody: { error: { type: "invalid_request_error", code: "resource_missing" } },
    });
  });

  it.each([
    ["an empty body", ""],
    ["a body that is not JSON", "<html>Bad Request</html>"],
    ["a body that fails the schema", '{"error":42}'],
  ])("gives errorBody null for %s", async (_name, body) => {
    const fetch = createFakeFetch(() => respondWith(body, 400));
    expect(await requestJson({ fetch, url: TOKEN_URL, errorSchema: oauthErrorSchema })).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 400,
      errorBody: null,
    });
  });

  it("never surfaces the schema's issues or the raw body", async () => {
    const fetch = createFakeFetch(() => respondWith('{"error":"sk_live_secret_value_in_body"}', 400));
    const result = await requestJson({ fetch, url: TOKEN_URL, errorSchema: z.object({ error: z.number() }) });
    expect(JSON.stringify(result)).not.toContain("sk_live");
    expect(result).toEqual({ ok: false, error: "core.http_unexpected_answer", status: 400, errorBody: null });
  });
});

describe("requestJson: errorSchema where no error body is read", () => {
  it("does not read a redirect's body", async () => {
    const { response, tracker } = trackedResponse('{"error":"moved"}', 302);
    const fetch = createFakeFetch(() => response);
    expect(await requestJson({ fetch, url: TOKEN_URL, errorSchema: oauthErrorSchema })).toEqual({
      ok: false,
      error: "core.http_refused",
      status: 302,
      errorBody: null,
    });
    expect(tracker.pulled).toBe(false);
  });

  it("gives errorBody null when the service is unreachable", async () => {
    const fetch = () => Promise.reject(new TypeError("fetch failed"));
    expect(await requestJson({ fetch, url: TOKEN_URL, errorSchema: oauthErrorSchema })).toEqual({
      ok: false,
      error: "core.http_unreachable",
      status: null,
      errorBody: null,
    });
  });

  it("keeps the status's code and gives errorBody null when the error body breaks off", async () => {
    const broken = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("stream aborted"));
        },
      }),
      { status: 400 },
    );
    const fetch = createFakeFetch(() => broken);
    expect(await requestJson({ fetch, url: TOKEN_URL, errorSchema: oauthErrorSchema })).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 400,
      errorBody: null,
    });
  });

  it("bounds the error body read by the call's timeout", async () => {
    // A body that never ends, cut off by the request's signal as a real fetch does.
    const fetch = createFakeFetch(
      (init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init.signal?.addEventListener("abort", () => {
                controller.error(new DOMException("The operation timed out.", "TimeoutError"));
              });
            },
          }),
          { status: 500 },
        ),
    );
    expect(await requestJson({ fetch, url: TOKEN_URL, timeoutMs: 5, errorSchema: oauthErrorSchema })).toEqual({
      ok: false,
      error: "core.http_unavailable",
      status: 500,
      retryAfterSeconds: null,
      errorBody: null,
    });
  });

  it("gives errorBody null when a 2xx body fails the schema", async () => {
    const fetch = createFakeFetch(() => respondWith('{"error":"looks like an error"}', 200));
    expect(await requestJson({ fetch, url: TOKEN_URL, schema: tokenSchema, errorSchema: oauthErrorSchema })).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 200,
      errorBody: null,
    });
  });

  it("returns a success unchanged", async () => {
    const fetch = createFakeFetch(() => respondWith('{"access_token":"t"}', 200));
    expect(await requestJson({ fetch, url: TOKEN_URL, schema: tokenSchema, errorSchema: oauthErrorSchema })).toEqual({
      ok: true,
      value: { access_token: "t" },
    });
  });
});

describe("requestJson: without errorSchema", () => {
  it("cancels the error body and adds no errorBody", async () => {
    const { response, tracker } = trackedResponse('{"error":"invalid_grant"}', 400);
    const fetch = createFakeFetch(() => response);
    const result = await requestJson({ fetch, url: TOKEN_URL });
    expect(result).toEqual({ ok: false, error: "core.http_unexpected_answer", status: 400 });
    expect(result).not.toHaveProperty("errorBody");
    expect(tracker.pulled).toBe(false);
    expect(tracker.cancelled).toBe(true);
  });

  it("adds no errorBody to other failures", async () => {
    const fetch = () => Promise.reject(new TypeError("fetch failed"));
    expect(await requestJson({ fetch, url: TOKEN_URL })).not.toHaveProperty("errorBody");
  });
});

describe("requestJson: errorSchema types", () => {
  const fetch = createFakeFetch(() => respondWith("{}", 200));

  it("types errorBody as the schema's output or null", () => {
    expectTypeOf(requestJson({ fetch, url: TOKEN_URL, schema: tokenSchema, errorSchema: oauthErrorSchema }))
      .resolves.extract<{ ok: false }>()
      .toEqualTypeOf<HttpJsonErrorBodyFailure<{ error: string }>>();
    expectTypeOf(requestJson({ fetch, url: TOKEN_URL, method: "POST", body: {}, errorSchema: oauthErrorSchema }))
      .resolves.extract<{ ok: false }>()
      .toEqualTypeOf<HttpJsonErrorBodyFailure<{ error: string }>>();
    expectTypeOf(requestJson({ fetch, url: TOKEN_URL, readHeaders: ["etag"], errorSchema: oauthErrorSchema }))
      .resolves.extract<{ ok: false }>()
      .toHaveProperty("errorBody")
      .toEqualTypeOf<{ error: string } | null>();
  });

  it("keeps HttpJsonFailure for calls without errorSchema", () => {
    expectTypeOf(requestJson({ fetch, url: TOKEN_URL, schema: tokenSchema }))
      .resolves.extract<{ ok: false }>()
      .toEqualTypeOf<HttpJsonFailure>();
    expectTypeOf(requestJson({ fetch, url: TOKEN_URL, method: "DELETE" }))
      .resolves.extract<{ ok: false }>()
      .toEqualTypeOf<HttpJsonFailure>();
    expectTypeOf(requestJson({ fetch, url: TOKEN_URL, readHeaders: ["etag"] }))
      .resolves.extract<{ ok: false }>()
      .toEqualTypeOf<HttpJsonFailure>();
  });
});
