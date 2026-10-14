// The IndexNow submit as a `blog.indexnow` job: the enqueue after a committed publish and the
// worker's handler with its retry rules.
import { blog } from "@softure-ai/blog";
import type { IndexNowChange } from "@softure-ai/blog/server";
import { BLOG_INDEXNOW_QUEUE, createBlogIndexNowJobHandler, enqueueBlogIndexNow, hasBlogIndexNowQueue } from "@softure-ai/blog/jobs";
import { defineSoftureConfig } from "@softure-ai/core";
import { jobs } from "@softure-ai/jobs";
import { listJobs, runDueJobs } from "@softure-ai/jobs/testing";
import { seo } from "@softure-ai/seo";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createTestBlog, type TestBlog } from "./support.js";

const KEY = "5f0c8a2e7b1d4c39a6e8f2b7d0c4a913";
const ADDED: IndexNowChange = { kind: "article", action: "added", statusBefore: null, statusAfter: "published", slug: "index-funds", previousSlug: null };
const QUEUE_MODULE = jobs({ queues: { [BLOG_INDEXNOW_QUEUE]: { maxAttempts: 3, backoff: { baseSeconds: 10, maxSeconds: 60 } } } });

interface SentRequest {
  readonly url: string;
  readonly body: unknown;
}

function createFetch(responses: readonly (Response | Error)[], sent: SentRequest[]): typeof fetch {
  let index = 0;
  return (url, init) => {
    sent.push({ url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url, body: JSON.parse(typeof init?.body === "string" ? init.body : "null") });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next ?? new Response(null, { status: 200 }));
  };
}

describe("hasBlogIndexNowQueue", () => {
  it("is false without jobs, and without the blog's queue in jobs", () => {
    expect(hasBlogIndexNowQueue(createConfig())).toBe(false);
    expect(hasBlogIndexNowQueue(createConfig({}, [jobs({ queues: { "mail.send": {} } })]))).toBe(false);
  });

  it("is true when jobs defines blog.indexnow", () => {
    expect(hasBlogIndexNowQueue(createConfig({}, [QUEUE_MODULE]))).toBe(true);
  });
});

describe("the blog.indexnow job", () => {
  let test: TestBlog;
  let sent: SentRequest[];

  beforeEach(async () => {
    test = await createTestBlog({}, [seo({ indexNow: { key: KEY } }), QUEUE_MODULE]);
    sent = [];
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function runJobs(responses: readonly (Response | Error)[]) {
    const handlers = { [BLOG_INDEXNOW_QUEUE]: createBlogIndexNowJobHandler({ fetchImpl: createFetch(responses, sent) }) };
    return runDueJobs(test.ctx, { handlers, random: () => 0 });
  }

  it("enqueues the changed paths after a commit and reports them as queued", async () => {
    const result = await enqueueBlogIndexNow(test.ctx, [ADDED]);
    const [job] = await listJobs(test.database.db);
    expect(result).toEqual({ paths: ["/blog/index-funds", "/blog"], outcome: { kind: "queued", jobId: job?.id, count: 2, isDuplicate: false } });
    expect(job).toMatchObject({ queue: "blog.indexnow", status: "pending", payload: { paths: ["/blog/index-funds", "/blog"] } });
    expect(job?.dedupKey).toMatch(/^indexnow:[0-9a-f]{32}$/);
  });

  it("returns the pending job for the same paths instead of a second one", async () => {
    const first = await enqueueBlogIndexNow(test.ctx, [ADDED]);
    const second = await enqueueBlogIndexNow(test.ctx, [ADDED]);
    expect(second.outcome).toEqual({ kind: "queued", jobId: first.outcome.kind === "queued" ? first.outcome.jobId : "", count: 2, isDuplicate: true });
    expect(await listJobs(test.database.db)).toHaveLength(1);
  });

  it("writes no job when no public address changed", async () => {
    expect(await enqueueBlogIndexNow(test.ctx, [{ ...ADDED, action: "unchanged", statusBefore: "published" }])).toEqual({ paths: [], outcome: { kind: "skipped" } });
    expect(await listJobs(test.database.db)).toEqual([]);
  });

  it("writes no job when seo cannot submit", async () => {
    const config = defineSoftureConfig({ ...test.config, modules: [QUEUE_MODULE, blog()] });
    const result = await enqueueBlogIndexNow({ ...test.ctx, config }, [ADDED]);
    expect(result.outcome).toEqual({ kind: "not_configured", reason: "the seo module is not enabled; add seo({ indexNow: { key } }) to modules" });
    expect(await listJobs(test.database.db)).toEqual([]);
  });

  it("submits the canonical URLs and succeeds", async () => {
    await enqueueBlogIndexNow(test.ctx, [ADDED]);
    expect(await runJobs([new Response(null, { status: 202 })])).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(sent).toEqual([
      {
        url: "https://api.indexnow.org/indexnow",
        body: { host: "app.example.com", key: KEY, keyLocation: "https://app.example.com/indexnow-key.txt", urlList: ["https://app.example.com/blog/index-funds", "https://app.example.com/blog"] },
      },
    ]);
  });

  it("retries an unreachable engine and a 5xx with the backoff, then succeeds", async () => {
    await enqueueBlogIndexNow(test.ctx, [ADDED]);
    expect(await runJobs([new Error("getaddrinfo ENOTFOUND")])).toMatchObject({ retried: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ status: "pending", lastError: "blog.indexnow_unreachable", runAt: new Date(test.clock.now().getTime() + 10_000) });

    test.clock.advance(10_000);
    expect(await runJobs([new Response(null, { status: 503 })])).toMatchObject({ retried: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ status: "pending", lastError: "blog.indexnow_server_error" });

    test.clock.advance(20_000);
    expect(await runJobs([new Response(null, { status: 200 })])).toMatchObject({ succeeded: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ status: "succeeded", attempts: 3 });
  });

  it("retries a 429 after its Retry-After", async () => {
    await enqueueBlogIndexNow(test.ctx, [ADDED]);
    expect(await runJobs([new Response(null, { status: 429, headers: { "retry-after": "120" } })])).toMatchObject({ retried: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ lastError: "blog.indexnow_rate_limited", runAt: new Date(test.clock.now().getTime() + 120_000) });
  });

  it("retries a 429 without Retry-After with the backoff", async () => {
    await enqueueBlogIndexNow(test.ctx, [ADDED]);
    await runJobs([new Response(null, { status: 429 })]);
    expect((await listJobs(test.database.db))[0]).toMatchObject({ lastError: "blog.indexnow_rate_limited", runAt: new Date(test.clock.now().getTime() + 10_000) });
  });

  it.each([400, 403, 422])("fails at once on a %i, which a retry cannot fix", async (status) => {
    await enqueueBlogIndexNow(test.ctx, [ADDED]);
    expect(await runJobs([new Response(null, { status })])).toMatchObject({ failed: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ status: "failed", attempts: 1, lastError: "blog.indexnow_rejected" });
  });

  it("fails at once when seo is gone from the worker's config", async () => {
    await enqueueBlogIndexNow(test.ctx, [ADDED]);
    const config = defineSoftureConfig({ ...test.config, modules: [QUEUE_MODULE, blog()] });
    const handlers = { [BLOG_INDEXNOW_QUEUE]: createBlogIndexNowJobHandler({ fetchImpl: createFetch([], sent) }) };
    expect(await runDueJobs({ ...test.ctx, config }, { handlers })).toMatchObject({ failed: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ status: "failed", lastError: "blog.indexnow_not_configured" });
    expect(sent).toEqual([]);
  });

  it("fails a payload without paths before any request", async () => {
    const { enqueueJob } = await import("@softure-ai/jobs/server");
    await enqueueJob(test.ctx, { queue: BLOG_INDEXNOW_QUEUE, payload: { paths: [] } });
    expect(await runJobs([])).toMatchObject({ failed: 1 });
    expect((await listJobs(test.database.db))[0]).toMatchObject({ lastError: "jobs.invalid_payload" });
    expect(sent).toEqual([]);
  });
});
