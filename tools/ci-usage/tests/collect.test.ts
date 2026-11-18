import { describe, expect, it } from "vitest";
import { collectRepository, getSlices, parseRunCache, type RunCache } from "../src/collect.js";
import { createGithubClient, getNextLink } from "../src/github.js";
import { createFakeGithub, makeApiJob, makeRun } from "./fake-github.js";

const FROM = new Date("2026-11-16T00:00:00Z");
const TO = new Date("2026-11-18T00:00:00Z");
const EMPTY: RunCache = { version: 1, runs: {} };

const isRuns = (url: URL): boolean => url.pathname === "/repos/acme/app/actions/runs";
const isJobs = (runId: number) => (url: URL): boolean => url.pathname === `/repos/acme/app/actions/runs/${String(runId)}/jobs`;

describe("getSlices", () => {
  it("cuts a period into UTC days, the first and last shorter", () => {
    expect(getSlices(new Date("2026-11-16T12:00:00Z"), new Date("2026-11-18T06:00:00Z")).map((slice) => [slice.from.toISOString(), slice.to.toISOString()])).toEqual([
      ["2026-11-16T12:00:00.000Z", "2026-11-17T00:00:00.000Z"],
      ["2026-11-17T00:00:00.000Z", "2026-11-18T00:00:00.000Z"],
      ["2026-11-18T00:00:00.000Z", "2026-11-18T06:00:00.000Z"],
    ]);
  });

  it("returns nothing for an empty period", () => {
    expect(getSlices(TO, TO)).toEqual([]);
  });
});

describe("getNextLink", () => {
  it("finds the next page and nothing else", () => {
    expect(getNextLink('<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"')).toBe("https://api.github.com/x?page=2");
    expect(getNextLink('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull();
    expect(getNextLink(null)).toBeNull();
  });
});

describe("collectRepository", () => {
  it("reads each day's runs and every attempt's jobs, skipping skipped and running runs", async () => {
    const fake = createFakeGithub([
      { match: (url) => isRuns(url) && url.searchParams.get("created") === "2026-11-16T00:00:00Z..2026-11-16T23:59:59Z", body: { total_count: 2, workflow_runs: [makeRun(1), makeRun(2, { conclusion: "skipped" })] } },
      { match: (url) => isRuns(url) && url.searchParams.get("created") === "2026-11-17T00:00:00Z..2026-11-17T23:59:59Z", body: { total_count: 1, workflow_runs: [makeRun(3, { status: "in_progress" })] } },
      { match: isJobs(1), body: { total_count: 2, jobs: [makeApiJob(11, 1), makeApiJob(12, 1, { run_attempt: 2 })] } },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: TO, cache: EMPTY });

    expect(result.error).toBeNull();
    expect(result.partial).toEqual([]);
    expect(result.runs).toEqual({ counted: 1, fromCache: 0, running: 1, skipped: 1 });
    expect(result.jobs.map((job) => [job.id, job.runAttempt, job.workflowPath])).toEqual([
      [11, 1, ".github/workflows/ci.yml"],
      [12, 2, ".github/workflows/ci.yml"],
    ]);
    expect(fake.requests.find((request) => isJobs(1)(request.url))?.url.searchParams.get("filter")).toBe("all");
    expect(Object.keys(result.cache.runs)).toEqual(["1:1"]);
  });

  it("follows the Link header across pages", async () => {
    const fake = createFakeGithub([
      { match: (url) => isRuns(url) && url.searchParams.get("page") === "2", body: { total_count: 2, workflow_runs: [makeRun(2)] } },
      { match: isRuns, body: { total_count: 2, workflow_runs: [makeRun(1)] }, headers: { link: '<https://api.github.com/repos/acme/app/actions/runs?page=2>; rel="next"' } },
      { match: (url) => url.pathname.endsWith("/jobs"), body: { total_count: 0, jobs: [] } },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    expect(result.runs.counted).toBe(2);
  });

  it("splits a day of more than 1,000 runs into hours and says when an hour still overflows", async () => {
    const fake = createFakeGithub([
      { match: (url) => isRuns(url) && url.searchParams.get("created") === "2026-11-16T00:00:00Z..2026-11-16T23:59:59Z", body: { total_count: 1500, workflow_runs: [] } },
      { match: (url) => isRuns(url) && url.searchParams.get("created") === "2026-11-16T05:00:00Z..2026-11-16T05:59:59Z", body: { total_count: 1200, workflow_runs: [makeRun(5)] } },
      { match: isRuns, body: { total_count: 1, workflow_runs: [] } },
      { match: (url) => url.pathname.endsWith("/jobs"), body: { total_count: 0, jobs: [] } },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    expect(fake.requests.filter((request) => isRuns(request.url))).toHaveLength(25);
    expect(result.partial).toEqual(["1200 runs created between 2026-11-16T05:00Z and 2026-11-16T06:00Z: only 1000 counted"]);
    expect(result.runs.counted).toBe(1);
  });

  it("takes an unchanged run from the cache without a request", async () => {
    const cached: RunCache = { version: 1, runs: { "1:1": { updatedAt: "2026-11-17T10:10:00Z", jobs: [] } } };
    const fake = createFakeGithub([{ match: isRuns, body: { total_count: 1, workflow_runs: [makeRun(1)] } }]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: cached });
    expect(result.runs).toMatchObject({ counted: 1, fromCache: 1 });
    expect(fake.requests.some((request) => request.url.pathname.endsWith("/jobs"))).toBe(false);
  });

  it("stops at the reserve and says how many runs were not counted", async () => {
    let remaining = 52;
    const fake = createFakeGithub(
      [
        { match: isRuns, body: { total_count: 3, workflow_runs: [makeRun(1), makeRun(2), makeRun(3)] } },
        { match: (url) => url.pathname.endsWith("/jobs"), body: { total_count: 1, jobs: [makeApiJob(9, 1)] } },
      ],
      () => remaining--,
    );
    const client = createGithubClient({ token: "t", fetch: fake.fetch, reserve: 50 });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    // 52 left after the run list, 51 after the first jobs page, 50 (the reserve) after the second.
    expect(result.runs.counted).toBe(2);
    expect(result.partial).toHaveLength(1);
    expect(result.partial[0]).toMatch(/^stopped at the rate limit: 1 of 3 runs not counted/);
    expect(result.error).toBeNull();
  });

  it("reports a repository it cannot read as an error naming the request", async () => {
    const fake = createFakeGithub([{ match: isRuns, status: 404, body: { message: "Not Found" } }]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: TO, cache: EMPTY });
    expect(result.error).toBe("GET /repos/acme/app/actions/runs answered 404: Not Found");
  });

  it("keeps counting when one run's jobs cannot be read", async () => {
    const fake = createFakeGithub([
      { match: isRuns, body: { total_count: 2, workflow_runs: [makeRun(1), makeRun(2)] } },
      { match: isJobs(1), status: 500, body: { message: "boom" } },
      { match: isJobs(2), body: { total_count: 1, jobs: [makeApiJob(21, 2)] } },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    expect(result.partial).toEqual(["run 1 not counted: GET /repos/acme/app/actions/runs/1/jobs answered 500: boom"]);
    expect(result.jobs.map((job) => job.id)).toEqual([21]);
  });
});

describe("parseRunCache", () => {
  it("starts empty for no file, broken JSON or another shape", () => {
    expect(parseRunCache(null)).toEqual(EMPTY);
    expect(parseRunCache("{")).toEqual(EMPTY);
    expect(parseRunCache('{"version":2,"runs":{}}')).toEqual(EMPTY);
  });
});
