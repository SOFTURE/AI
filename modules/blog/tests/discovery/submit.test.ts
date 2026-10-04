// The submit after a publish, as an app's own publishing path calls it.
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";
import { blog } from "@softure-ai/blog";
import { submitBlogChanges, type IndexNowChange } from "@softure-ai/blog/server";
import { seo } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";
import { createConfig } from "../support.js";

const KEY = "5f0c8a2e7b1d4c39a6e8f2b7d0c4a913";
const CHANGE: IndexNowChange = { kind: "article", action: "added", statusBefore: null, statusAfter: "published", slug: "index-funds", previousSlug: null };

function createSeoConfig(): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "UTC",
    appOrigin: "https://app.example.com",
    modules: [seo({ canonical: { trailingSlash: true }, indexNow: { key: KEY } }), blog({ routes: { index: "/articles" } })],
  });
}

describe("submitBlogChanges", () => {
  it("is not configured without seo, and names the changed paths anyway", async () => {
    expect(await submitBlogChanges(createConfig(), [CHANGE], { commit: true })).toEqual({
      paths: ["/blog/index-funds", "/blog"],
      outcome: { kind: "not_configured", reason: "the seo module is not enabled; add seo({ indexNow: { key } }) to modules" },
    });
  });

  it("dry-runs without commit with canonical URLs: the seo origin and trailing-slash rule on the blog's routes", async () => {
    expect(await submitBlogChanges(createSeoConfig(), [CHANGE])).toEqual({
      paths: ["/articles/index-funds", "/articles"],
      outcome: { kind: "dry_run", endpoint: "https://api.indexnow.org/indexnow", urls: ["https://app.example.com/articles/index-funds/", "https://app.example.com/articles/"] },
    });
  });

  it("submits with commit and reports the engine's answer", async () => {
    const sent: string[] = [];
    const result = await submitBlogChanges(createSeoConfig(), [CHANGE], {
      commit: true,
      fetchImpl: (_url, init) => {
        sent.push(typeof init?.body === "string" ? init.body : "");
        return Promise.resolve(new Response(null, { status: 202 }));
      },
    });
    expect(result.outcome).toEqual({ kind: "submitted", status: 202, count: 2 });
    expect(sent).toHaveLength(1);
  });

  it("skips without a request when nothing public changed", async () => {
    const result = await submitBlogChanges(createSeoConfig(), [{ ...CHANGE, action: "unchanged", statusBefore: "published" }], {
      commit: true,
      fetchImpl: () => Promise.reject(new Error("test: no request expected")),
    });
    expect(result).toEqual({ paths: [], outcome: { kind: "skipped" } });
  });

  it("returns an unreachable engine as a failure, not a throw", async () => {
    const result = await submitBlogChanges(createSeoConfig(), [CHANGE], { commit: true, fetchImpl: () => Promise.reject(new Error("getaddrinfo ENOTFOUND")) });
    expect(result.outcome).toEqual({ kind: "failed", code: "seo.indexnow_unreachable", reason: "IndexNow could not be reached: getaddrinfo ENOTFOUND" });
  });
});
