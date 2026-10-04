// The IndexNow submit: a dry run by default, no network in tests (fetch is always injected).
import { INDEXNOW_ENDPOINT, submitToIndexNow } from "@softure-ai/seo/server";
import { describe, expect, it, vi } from "vitest";

const KEY = "0123456789abcdef0123456789abcdef";
const SITE = { key: KEY, siteOrigin: "https://example.com", keyPath: "/indexnow-key.txt" };

function respondWith(status: number) {
  return vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status })));
}

describe("submitToIndexNow", () => {
  it("is a dry run by default: returns the request and sends nothing", async () => {
    const fetchImpl = respondWith(200);
    const result = await submitToIndexNow(["/blog/a", "https://example.com/blog"], { ...SITE, fetchImpl });
    expect(result).toEqual({
      kind: "dry_run",
      endpoint: "https://api.indexnow.org/indexnow",
      body: {
        host: "example.com",
        key: KEY,
        keyLocation: "https://example.com/indexnow-key.txt",
        urlList: ["https://example.com/blog/a", "https://example.com/blog"],
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("with commit, sends one JSON POST with host, key, key location and full URLs", async () => {
    const fetchImpl = respondWith(202);
    const result = await submitToIndexNow(["/blog/a", "/blog"], { ...SITE, commit: true, fetchImpl });
    expect(result).toEqual({ kind: "submitted", status: 202, count: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json; charset=utf-8" });
    expect(JSON.parse(init?.body as string)).toEqual({
      host: "example.com",
      key: KEY,
      keyLocation: "https://example.com/indexnow-key.txt",
      urlList: ["https://example.com/blog/a", "https://example.com/blog"],
    });
  });

  it("counts 200 as submitted too", async () => {
    expect(await submitToIndexNow(["/"], { ...SITE, commit: true, fetchImpl: respondWith(200) })).toEqual({ kind: "submitted", status: 200, count: 1 });
  });

  it("makes no request for an empty list", async () => {
    const fetchImpl = respondWith(200);
    expect(await submitToIndexNow([], { ...SITE, commit: true, fetchImpl })).toEqual({ kind: "skipped" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a refusal as a value with the status, not a throw", async () => {
    expect(await submitToIndexNow(["/blog"], { ...SITE, commit: true, fetchImpl: respondWith(422) })).toEqual({
      kind: "failed",
      code: "seo.indexnow_rejected",
      reason: "IndexNow answered 422 for 1 URLs",
    });
  });

  it("returns a network failure as a value with its cause", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new Error("ECONNREFUSED")));
    expect(await submitToIndexNow(["/blog"], { ...SITE, commit: true, fetchImpl })).toEqual({
      kind: "failed",
      code: "seo.indexnow_unreachable",
      reason: "IndexNow could not be reached: ECONNREFUSED",
    });
  });

  it("refuses a URL on another host before any request", async () => {
    const fetchImpl = respondWith(200);
    for (const url of ["https://other.example/x", "//other.example/x", "http://example.com/x"]) {
      expect(await submitToIndexNow([url], { ...SITE, commit: true, fetchImpl })).toEqual({
        kind: "failed",
        code: "seo.indexnow_foreign_url",
        reason: `"${url}" is not a URL on example.com`,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses more than 10,000 URLs, the protocol's ceiling, and accepts exactly 10,000", async () => {
    const paths = Array.from({ length: 10_001 }, (_, index) => `/p/${String(index)}`);
    expect(await submitToIndexNow(paths, SITE)).toEqual({
      kind: "failed",
      code: "seo.indexnow_too_many_urls",
      reason: "IndexNow takes at most 10000 URLs per request, got 10001",
    });
    expect((await submitToIndexNow(paths.slice(1), SITE)).kind).toBe("dry_run");
  });

  it("refuses a key outside the protocol's format", async () => {
    for (const key of ["short", "has space 123", "x".repeat(129)]) {
      expect(await submitToIndexNow(["/"], { ...SITE, key })).toEqual({
        kind: "failed",
        code: "seo.indexnow_invalid_key",
        reason: "the IndexNow key must be 8 to 128 letters, digits or dashes",
      });
    }
  });
});
