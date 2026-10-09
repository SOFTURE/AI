// Issue #318 on /next: featured articles and the static-page read over a published PGlite blog. Next's
// request scope is replaced as in discovery.test.ts: the config and the database are the test's.
import type { SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { getFeaturedArticles, getStaticPublishedArticles } from "@softure-ai/blog/next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestBlog } from "../support.js";
import { createPublishedBlog } from "./support.js";

const scope = vi.hoisted((): { config: SoftureConfig | undefined; db: Queryable | undefined } => ({ config: undefined, db: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getConfiguredDatabase: () => (scope.db === undefined ? Promise.reject(new Error("database down")) : Promise.resolve({ db: scope.db })),
}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(read: T) => read }));

let test: TestBlog;

beforeEach(async () => {
  test = await createPublishedBlog();
  scope.config = test.config;
  scope.db = test.ctx.db;
});
afterEach(async () => {
  scope.config = undefined;
  scope.db = undefined;
  await test.database.close();
});

describe("getFeaturedArticles (#318, 6)", () => {
  it("answers published articles, the pillar first, at most limit", async () => {
    const featured = await getFeaturedArticles(test.config, { limit: 2 });
    expect(featured.map((article) => [article.slug, article.isPillar])).toEqual([
      ["index-funds", true],
      [expect.any(String), false],
    ]);
    expect((await getFeaturedArticles(test.config, { limit: 10 })).every((article) => article.kind === "article")).toBe(true);
  });
});

describe("getStaticPublishedArticles (#318, 3)", () => {
  it("answers the published articles, nothing during next build, and nothing when the read fails", async () => {
    expect((await getStaticPublishedArticles(test.config, { phase: undefined })).length).toBe(4);
    expect(await getStaticPublishedArticles(test.config, { phase: "phase-production-build" })).toEqual([]);
    scope.db = undefined;
    const logged: string[] = [];
    expect(await getStaticPublishedArticles(test.config, { phase: undefined, onError: (message) => logged.push(message) })).toEqual([]);
    expect(logged).toEqual(["@softure-ai/blog: reading published articles for a static page failed: database down"]);
  });
});
