import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { createTestClock, parseLinkHeader, requestJson, type HttpJsonFailure, type Ok } from "@softure-ai/core";

const URL_WITH_KEY = "https://api.example.com/v1/reports?api_key=sk_live_secret_123";
const NOW = new Date("2026-10-22T12:00:00Z");

function createFakeFetch(answer: () => Response) {
  let calls = 0;
  const fetch = (): Promise<Response> => {
    calls += 1;
    return Promise.resolve(answer());
  };
  return { fetch, getCalls: () => calls };
}

function respondWith(body: string | null, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

async function requestRetryAfter(status: number, retryAfter: string | null) {
  const headers: Record<string, string> = retryAfter === null ? {} : { "Retry-After": retryAfter };
  const { fetch } = createFakeFetch(() => respondWith('{"error":"busy"}', status, headers));
  return requestJson({ fetch, url: URL_WITH_KEY, clock: createTestClock(NOW) });
}

describe("requestJson: readHeaders", () => {
  it("returns the body and each requested header, looked up in any letter case", async () => {
    const { fetch } = createFakeFetch(() =>
      respondWith('{"rows":[1]}', 200, { "X-Next-ID": "abc", "X-RateLimit-Remaining": "7", "Set-Cookie": "s=secret" }),
    );
    const result = await requestJson({ fetch, url: URL_WITH_KEY, readHeaders: ["x-next-id", "X-RateLimit-Remaining"] });
    expect(result).toEqual({
      ok: true,
      value: { body: { rows: [1] }, headers: { "x-next-id": "abc", "X-RateLimit-Remaining": "7" } },
    });
  });

  it("gives null for a requested header the answer does not carry", async () => {
    const { fetch } = createFakeFetch(() => respondWith("{}", 200));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, readHeaders: ["link"] });
    expect(result).toEqual({ ok: true, value: { body: {}, headers: { link: null } } });
  });

  it("returns the schema's output as the body", async () => {
    const { fetch } = createFakeFetch(() => respondWith('{"rate":"4.25"}', 200, { etag: '"v1"' }));
    const result = await requestJson({
      fetch,
      url: URL_WITH_KEY,
      schema: z.object({ rate: z.coerce.number() }),
      readHeaders: ["etag"],
    });
    expect(result).toEqual({ ok: true, value: { body: { rate: 4.25 }, headers: { etag: '"v1"' } } });
  });

  it("returns an undefined body with the headers for a write answered with nothing", async () => {
    const { fetch } = createFakeFetch(() => respondWith(null, 204, { location: "/tasks/7" }));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, method: "POST", body: {}, readHeaders: ["location"] });
    expect(result).toEqual({ ok: true, value: { body: undefined, headers: { location: "/tasks/7" } } });
  });

  it("adds the requested headers to a failure that had a response", async () => {
    const { fetch } = createFakeFetch(() =>
      respondWith("{}", 429, { "retry-after": "30", "x-ratelimit-reset": "1700000000", authorization: "Bearer x" }),
    );
    const result = await requestJson({ fetch, url: URL_WITH_KEY, readHeaders: ["x-ratelimit-reset"] });
    expect(result).toEqual({
      ok: false,
      error: "core.http_rate_limited",
      status: 429,
      retryAfterSeconds: 30,
      headers: { "x-ratelimit-reset": "1700000000" },
    });
  });

  it("adds the headers to a failure found after the status (a body that is not JSON)", async () => {
    const { fetch } = createFakeFetch(() => new Response("<html>", { status: 200, headers: { "x-request-id": "r1" } }));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, readHeaders: ["x-request-id"] });
    expect(result).toEqual({
      ok: false,
      error: "core.http_unexpected_answer",
      status: 200,
      headers: { "x-request-id": "r1" },
    });
  });

  it("leaves headers out of a failure without a response", async () => {
    const fetch = () => Promise.reject(new TypeError("fetch failed"));
    const result = await requestJson({ fetch, url: URL_WITH_KEY, readHeaders: ["link"] });
    expect(result).toEqual({ ok: false, error: "core.http_unreachable", status: null });
  });

  it("leaves headers out of a failure when the option is not given", async () => {
    const { fetch } = createFakeFetch(() => respondWith("{}", 404, { link: "<https://a>; rel=next" }));
    const result = await requestJson({ fetch, url: URL_WITH_KEY });
    expect(result).toEqual({ ok: false, error: "core.http_unexpected_answer", status: 404 });
  });

  it.each(["", "x next", "x:y", "naïve"])("throws on the invalid header name %j before sending anything", async (name) => {
    const { fetch, getCalls } = createFakeFetch(() => respondWith("{}", 200));
    await expect(requestJson({ fetch, url: URL_WITH_KEY, readHeaders: [name] })).rejects.toThrow(RangeError);
    expect(getCalls()).toBe(0);
  });

  it("types the value as the body without the option and as body plus named headers with it", async () => {
    const { fetch } = createFakeFetch(() => respondWith("{}", 200));
    const schema = z.object({ id: z.string() });
    const plain = await requestJson({ fetch, url: URL_WITH_KEY, schema });
    expectTypeOf(plain).toEqualTypeOf<Ok<{ id: string }> | HttpJsonFailure>();

    const withHeaders = await requestJson({ fetch, url: URL_WITH_KEY, schema, readHeaders: ["link", "x-next-id"] });
    expectTypeOf(withHeaders).toEqualTypeOf<
      Ok<{ readonly body: { id: string }; readonly headers: Readonly<Record<"link" | "x-next-id", string | null>> }> | HttpJsonFailure
    >();

    const write = await requestJson({ fetch, url: URL_WITH_KEY, method: "PUT", body: {}, schema, readHeaders: ["etag"] });
    expectTypeOf(write).toEqualTypeOf<
      Ok<{ readonly body: { id: string } | undefined; readonly headers: Readonly<Record<"etag", string | null>> }> | HttpJsonFailure
    >();
  });
});

describe("requestJson: retryAfterSeconds", () => {
  it.each([429, 500, 502, 503, 504])("reads delay-seconds on a %i", async (status) => {
    expect(await requestRetryAfter(status, "120")).toMatchObject({ ok: false, status, retryAfterSeconds: 120 });
  });

  it("reads an HTTP date against the clock, rounded up to whole seconds", async () => {
    expect(await requestRetryAfter(503, "Thu, 22 Oct 2026 12:01:30 GMT")).toMatchObject({ retryAfterSeconds: 90 });
    const clock = createTestClock(new Date("2026-10-22T12:00:00.400Z"));
    const { fetch } = createFakeFetch(() => respondWith("{}", 503, { "retry-after": "Thu, 22 Oct 2026 12:00:10 GMT" }));
    expect(await requestJson({ fetch, url: URL_WITH_KEY, clock })).toMatchObject({ retryAfterSeconds: 10 });
  });

  it("reads the obsolete RFC 850 and asctime date forms", async () => {
    expect(await requestRetryAfter(503, "Thursday, 22-Oct-26 12:00:05 GMT")).toMatchObject({ retryAfterSeconds: 5 });
    expect(await requestRetryAfter(503, "Thu Oct 22 12:00:05 2026")).toMatchObject({ retryAfterSeconds: 5 });
  });

  it("gives 0 for a date in the past and for 0 seconds", async () => {
    expect(await requestRetryAfter(429, "Thu, 22 Oct 2026 11:00:00 GMT")).toMatchObject({ retryAfterSeconds: 0 });
    expect(await requestRetryAfter(429, "0")).toMatchObject({ retryAfterSeconds: 0 });
  });

  it("caps the delay at one day", async () => {
    expect(await requestRetryAfter(429, "86401")).toMatchObject({ retryAfterSeconds: 86_400 });
    expect(await requestRetryAfter(429, "99999999999999999999999")).toMatchObject({ retryAfterSeconds: 86_400 });
    expect(await requestRetryAfter(503, "Fri, 01 Jan 2027 00:00:00 GMT")).toMatchObject({ retryAfterSeconds: 86_400 });
  });

  it.each([null, "", "soon", "-5", "1.5", "12 seconds", "0x10"])("gives null for the header %j", async (value) => {
    expect(await requestRetryAfter(429, value)).toEqual({
      ok: false,
      error: "core.http_rate_limited",
      status: 429,
      retryAfterSeconds: null,
    });
  });

  it("trims whitespace around the value", async () => {
    expect(await requestRetryAfter(429, "  15 ")).toMatchObject({ retryAfterSeconds: 15 });
  });

  it.each([302, 401, 404, 409])("does not add it to a %i", async (status) => {
    const result = await requestRetryAfter(status, "30");
    expect(result).not.toHaveProperty("retryAfterSeconds");
  });

  it("narrows the field by the failure code", async () => {
    const result = await requestRetryAfter(429, "1");
    if (!result.ok && (result.error === "core.http_rate_limited" || result.error === "core.http_unavailable")) {
      expectTypeOf(result.retryAfterSeconds).toEqualTypeOf<number | null>();
    }
    if (!result.ok && result.error === "core.http_refused") {
      expectTypeOf(result).not.toHaveProperty("retryAfterSeconds");
    }
  });
});

describe("parseLinkHeader", () => {
  it("reads next, prev, first and last", () => {
    const value =
      '<https://api.example.com/items?page=3>; rel="next", <https://api.example.com/items?page=1>; rel="prev", ' +
      '<https://api.example.com/items?page=1>; rel="first", <https://api.example.com/items?page=9>; rel="last"';
    expect(parseLinkHeader(value)).toEqual({
      next: "https://api.example.com/items?page=3",
      prev: "https://api.example.com/items?page=1",
      first: "https://api.example.com/items?page=1",
      last: "https://api.example.com/items?page=9",
    });
  });

  it("reads an unquoted rel, other parameters, several rels in one link and any letter case", () => {
    expect(parseLinkHeader('<https://a/2>;rel=next;title="Next page"')).toEqual({ next: "https://a/2" });
    expect(parseLinkHeader('<https://a/1>; type="text/html"; rel="first prev"')).toEqual({
      first: "https://a/1",
      prev: "https://a/1",
    });
    expect(parseLinkHeader("<https://a/5>; REL=Last")).toEqual({ last: "https://a/5" });
  });

  it("reads previous as prev", () => {
    expect(parseLinkHeader('<https://a/1>; rel="previous"')).toEqual({ prev: "https://a/1" });
  });

  it("keeps a comma inside a URL", () => {
    expect(parseLinkHeader('<https://a/items?ids=1,2,3>; rel="next", <https://a/items?ids=0>; rel="first"')).toEqual({
      next: "https://a/items?ids=1,2,3",
      first: "https://a/items?ids=0",
    });
  });

  it("keeps the first link of a relation and ignores other relations", () => {
    expect(parseLinkHeader('<https://a/2>; rel="next", <https://a/3>; rel="next", <https://a/x>; rel="alternate"')).toEqual({
      next: "https://a/2",
    });
  });

  it("returns the URL as written, relative ones included", () => {
    expect(parseLinkHeader('</items?page=2>; rel="next"')).toEqual({ next: "/items?page=2" });
  });

  it("reads a long hostile value in linear time", () => {
    const started = performance.now();
    expect(parseLinkHeader("<=".repeat(200_000))).toEqual({});
    expect(parseLinkHeader(`${"<a>; rel=x, ".repeat(50_000)}<https://a/2>; rel=next`)).toEqual({ next: "https://a/2" });
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it.each([null, "", "garbage", "https://a/2; rel=next", '<https://a/2>; title="next"', '<>; rel="next"'])(
    "returns no links for %j",
    (value) => {
      expect(parseLinkHeader(value)).toEqual({});
    },
  );
});
