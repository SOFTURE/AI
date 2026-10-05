// The cache refresh request a publish sends to the running app: when it is sent, to which address,
// with what header, and what each answer of the app becomes.
import { requestBlogRefresh, type IndexNowChange } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { createConfig } from "../support.js";

const SECRET = "a-test-refresh-secret-of-40-characters!!";
const ENV = { BLOG_REFRESH_SECRET: SECRET };
const CHANGED: IndexNowChange = { kind: "article", action: "changed", statusBefore: "published", statusAfter: "published", slug: "index-funds", previousSlug: null };
const UNCHANGED: IndexNowChange = { ...CHANGED, action: "unchanged" };

interface SentRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function answerWith(answer: Response | Error): { fetchImpl: typeof fetch; sent: SentRequest[] } {
  const sent: SentRequest[] = [];
  const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: url instanceof Request ? url.url : url.toString(), init });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }) as typeof fetch;
  return { fetchImpl, sent };
}

describe("requestBlogRefresh", () => {
  const config = createConfig({ revalidateSeconds: 120 });

  it("posts the secret as a Bearer header to the refresh route on appOrigin, without following redirects", async () => {
    const { fetchImpl, sent } = answerWith(new Response(null, { status: 204 }));
    expect(await requestBlogRefresh(config, [CHANGED], { commit: true, env: ENV, fetchImpl })).toEqual({ kind: "refreshed", url: "https://app.example.com/api/blog/refresh" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://app.example.com/api/blog/refresh");
    expect(sent[0]?.init).toMatchObject({ method: "POST", headers: { authorization: `Bearer ${SECRET}` }, redirect: "manual" });
    expect(sent[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("calls the origin --app-url gives instead of appOrigin", async () => {
    const { fetchImpl, sent } = answerWith(new Response(null, { status: 200 }));
    expect(await requestBlogRefresh(config, [CHANGED], { commit: true, env: ENV, fetchImpl, appUrl: "http://web:3000" })).toEqual({ kind: "refreshed", url: "http://web:3000/api/blog/refresh" });
    expect(sent.map((request) => request.url)).toEqual(["http://web:3000/api/blog/refresh"]);
  });

  it("sends nothing when no text changed, without a secret, or on a dry run", async () => {
    const { fetchImpl, sent } = answerWith(new Response(null, { status: 204 }));
    expect(await requestBlogRefresh(config, [UNCHANGED], { commit: true, env: ENV, fetchImpl })).toEqual({ kind: "skipped" });
    expect(await requestBlogRefresh(config, [], { commit: true, env: ENV, fetchImpl })).toEqual({ kind: "skipped" });
    expect(await requestBlogRefresh(config, [CHANGED], { commit: true, env: { BLOG_REFRESH_SECRET: "  " }, fetchImpl })).toEqual({ kind: "not_configured", revalidateSeconds: 120 });
    expect(await requestBlogRefresh(config, [CHANGED], { commit: true, env: {}, fetchImpl })).toEqual({ kind: "not_configured", revalidateSeconds: 120 });
    expect(await requestBlogRefresh(config, [CHANGED], { env: ENV, fetchImpl })).toEqual({ kind: "dry_run", url: "https://app.example.com/api/blog/refresh" });
    expect(sent).toEqual([]);
  });

  it("refuses a secret shorter than 32 characters, on a commit and on a dry run, and sends nothing", async () => {
    const { fetchImpl, sent } = answerWith(new Response(null, { status: 204 }));
    for (const commit of [true, false]) {
      expect(await requestBlogRefresh(config, [CHANGED], { commit, env: { BLOG_REFRESH_SECRET: "x".repeat(31) }, fetchImpl })).toEqual({
        kind: "failed",
        code: "blog.refresh_invalid_secret",
        reason: "BLOG_REFRESH_SECRET must be at least 32 characters",
        revalidateSeconds: 120,
      });
    }
    expect(sent).toEqual([]);
  });

  it("turns each refusal of the app into a failure naming the status and what to fix", async () => {
    const cases: [number, string][] = [
      [401, "https://app.example.com/api/blog/refresh answered 401 (the app has another BLOG_REFRESH_SECRET)"],
      [404, "https://app.example.com/api/blog/refresh answered 404 (mount refreshBlogCache at that path)"],
      [429, "https://app.example.com/api/blog/refresh answered 429 (too many refreshes from this address)"],
      [308, "https://app.example.com/api/blog/refresh answered 308 (a redirect; pass the final origin with --app-url)"],
      [500, "https://app.example.com/api/blog/refresh answered 500"],
    ];
    for (const [status, reason] of cases) {
      const { fetchImpl } = answerWith(new Response(null, { status }));
      expect(await requestBlogRefresh(config, [CHANGED], { commit: true, env: ENV, fetchImpl })).toEqual({ kind: "failed", code: "blog.refresh_rejected", reason, revalidateSeconds: 120 });
    }
  });

  it("reports an unreachable app without throwing", async () => {
    const { fetchImpl } = answerWith(new TypeError("fetch failed"));
    expect(await requestBlogRefresh(config, [CHANGED], { commit: true, env: ENV, fetchImpl })).toEqual({
      kind: "failed",
      code: "blog.refresh_unreachable",
      reason: "https://app.example.com/api/blog/refresh could not be reached: fetch failed",
      revalidateSeconds: 120,
    });
  });
});
