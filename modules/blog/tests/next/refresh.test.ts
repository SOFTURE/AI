// The cache refresh route over PGlite with the security module: the secret, the rate limit and the
// tag it expires. Next's request scope is replaced as in discovery.test.ts; `revalidateTag` is a spy.
import type { SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { BLOG_RATE_LIMIT_BUCKETS } from "@softure-ai/blog";
import { refreshBlogCache } from "@softure-ai/blog/next";
import { cloudflareIp, security } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestBlog, type TestBlog } from "../support.js";

const scope = vi.hoisted((): { config: SoftureConfig | undefined; db: Queryable | undefined } => ({ config: undefined, db: undefined }));
const revalidateTag = vi.hoisted(() => vi.fn());

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getSharedDatabase: () => Promise.resolve({ db: scope.db }),
}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(read: T) => read, revalidateTag }));

const SECRET = "a-test-refresh-secret-of-40-characters!!";
const ROUTE = "https://app.example.com/api/blog/refresh";

let test: TestBlog;
let errors: string[];

async function useBlog(buckets: Record<string, { limit: number; windowMinutes: number }> = BLOG_RATE_LIMIT_BUCKETS, withSecurity = true): Promise<void> {
  test = await createTestBlog({}, withSecurity ? [security({ clientIp: cloudflareIp(), buckets })] : []);
  scope.config = test.config;
  scope.db = test.ctx.db;
}

function post(headers: Record<string, string> = {}): Request {
  return new Request(ROUTE, { method: "POST", headers: { "cf-connecting-ip": "203.0.113.7", ...headers } });
}

beforeEach(() => {
  vi.stubEnv("BLOG_REFRESH_SECRET", SECRET);
  revalidateTag.mockClear();
  errors = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => void errors.push(line));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  scope.config = undefined;
  scope.db = undefined;
  await test.database.close();
});

describe("refreshBlogCache", () => {
  it("expires the blog's tag at once for the right secret and answers 204", async () => {
    await useBlog();
    const response = await refreshBlogCache(post({ authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("softure-blog", { expire: 0 });
  });

  it("answers 401 with a Bearer challenge for a missing, wrong or differently shaped secret, and refreshes nothing", async () => {
    await useBlog();
    for (const authorization of [undefined, `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, `Basic ${SECRET}`, SECRET]) {
      const response = await refreshBlogCache(post(authorization === undefined ? {} : { authorization }));
      expect(response.status, authorization).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("counts every request per address before the secret, answering 429 with retry-after over the bucket", async () => {
    await useBlog({ "blog-refresh": { limit: 2, windowMinutes: 15 } });
    expect((await refreshBlogCache(post({ authorization: "Bearer guess" }))).status).toBe(401);
    expect((await refreshBlogCache(post({ authorization: `Bearer ${SECRET}` }))).status).toBe(204);
    const limited = await refreshBlogCache(post({ authorization: `Bearer ${SECRET}` }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another address has its own count.
    expect((await refreshBlogCache(post({ authorization: `Bearer ${SECRET}`, "cf-connecting-ip": "203.0.113.8" }))).status).toBe(204);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("answers 400 for a client it cannot identify", async () => {
    await useBlog();
    const response = await refreshBlogCache(new Request(ROUTE, { method: "POST", headers: { authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers 503 and logs no secret when counting fails", async () => {
    await useBlog();
    scope.db = { insert: () => { throw new Error("connect ECONNREFUSED 127.0.0.1:5432"); } } as unknown as Queryable;
    const response = await refreshBlogCache(post({ authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(503);
    expect(errors).toEqual([expect.stringContaining("@softure-ai/blog: counting a cache refresh failed")]);
    expect(errors.join("\n")).not.toContain(SECRET);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("answers 500 with a log line naming the variable when the secret is missing or short", async () => {
    await useBlog();
    for (const value of ["", "   ", "short-secret"]) {
      vi.stubEnv("BLOG_REFRESH_SECRET", value);
      expect((await refreshBlogCache(post({ authorization: `Bearer ${value}` }))).status).toBe(500);
    }
    expect(errors).toEqual(Array(3).fill("@softure-ai/blog: the cache refresh route needs BLOG_REFRESH_SECRET of at least 32 characters"));
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("throws a named setup error without the security module or its bucket", async () => {
    await useBlog({}, false);
    await expect(refreshBlogCache(post({ authorization: `Bearer ${SECRET}` }))).rejects.toThrow("add security() to modules");
    await test.database.close();
    await useBlog({ other: { limit: 1, windowMinutes: 1 } });
    await expect(refreshBlogCache(post({ authorization: `Bearer ${SECRET}` }))).rejects.toThrow(
      'the security module has no "blog-refresh" bucket; spread BLOG_RATE_LIMIT_BUCKETS into security({ buckets })',
    );
  });
});
