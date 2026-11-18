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

  it("stops at the reserve between batches and says how many runs were not counted", async () => {
    let remaining = 52;
    const runs = Array.from({ length: 10 }, (_, index) => makeRun(index + 1));
    const fake = createFakeGithub(
      [
        { match: isRuns, body: { total_count: 10, workflow_runs: runs } },
        { match: (url) => url.pathname.endsWith("/jobs"), body: { total_count: 1, jobs: [makeApiJob(9, 1)] } },
      ],
      () => remaining--,
    );
    const client = createGithubClient({ token: "t", fetch: fake.fetch, reserve: 50 });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    // 52 left after the run list; the first batch of 8 is already in flight and brings it to 44, under the reserve.
    expect(result.runs.counted).toBe(8);
    expect(result.partial).toEqual([expect.stringMatching(/^stopped at the rate limit: 2 of 10 runs not counted/)]);
    expect(Object.keys(result.cache.runs)).toHaveLength(8);
    expect(result.error).toBeNull();
  });

  it("reads the jobs of up to 8 runs at the same time, oldest first", async () => {
    const runs = Array.from({ length: 10 }, (_, index) => makeRun(index + 1));
    const fake = createFakeGithub([
      { match: isRuns, body: { total_count: 10, workflow_runs: runs } },
      { match: (url) => url.pathname.endsWith("/jobs"), body: { total_count: 0, jobs: [] } },
    ]);
    let inFlight = 0;
    let most = 0;
    const fetch: typeof fake.fetch = async (url, init) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return fake.fetch(url, init);
    };
    const client = createGithubClient({ token: "t", fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    expect(most).toBe(8);
    expect(result.runs.counted).toBe(10);
    expect(fake.requests.filter((request) => request.url.pathname.endsWith("/jobs")).map((request) => request.url.pathname.split("/")[6])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("stops at the time budget before the next batch, keeping cached runs before it", async () => {
    const runs = Array.from({ length: 10 }, (_, index) => makeRun(index + 1));
    const cached: RunCache = { version: 1, runs: { "1:1": { updatedAt: "2026-11-17T10:10:00Z", jobs: [] } } };
    const fake = createFakeGithub([
      { match: isRuns, body: { total_count: 10, workflow_runs: runs } },
      { match: (url) => url.pathname.endsWith("/jobs"), body: { total_count: 0, jobs: [] } },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const times = [new Date("2026-11-17T06:00:00Z"), new Date("2026-11-17T06:11:00Z")];
    const result = await collectRepository({
      client,
      repository: "acme/app",
      from: FROM,
      to: new Date("2026-11-17T00:00:00Z"),
      cache: cached,
      deadline: new Date("2026-11-17T06:10:00Z"),
      now: () => times.shift() ?? new Date("2026-11-17T07:00:00Z"),
    });
    // Run 1 from the cache, runs 2 to 9 in the first batch, run 10 waits for a batch the budget no longer allows.
    expect(result.runs).toMatchObject({ counted: 9, fromCache: 1 });
    expect(result.partial).toEqual(["stopped at the time budget: 1 of 10 runs not counted"]);
    expect(fake.requests.filter((request) => request.url.pathname.endsWith("/jobs"))).toHaveLength(8);
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

describe("collectRepository on the API's real shapes", () => {
  it("reads a job and a run that leave out the keys they have no value for yet", async () => {
    // Shapes of SOFTURE/AI's run 44312373806 while it ran (2026-11-18): no conclusion, a job without completed_at.
    const fake = createFakeGithub([
      { match: isRuns, body: { total_count: 2, workflow_runs: [makeRun(1, { conclusion: undefined, status: "in_progress" }), makeRun(2, { conclusion: "cancelled" })] } },
      {
        match: isJobs(2),
        body: {
          total_count: 1,
          jobs: [
            {
              id: 134829549419,
              run_id: 2,
              name: "validate and pack",
              workflow_name: "release",
              status: "in_progress",
              runner_name: "GitHub Actions 1000040131",
              runner_group_name: "GitHub Actions",
              labels: ["ubuntu-latest"],
              created_at: "2026-11-18T13:18:30Z",
              started_at: "2026-11-18T13:18:33Z",
              html_url: "https://github.com/SOFTURE/AI/actions/runs/44312373806/job/134829549419",
            },
          ],
        },
      },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await collectRepository({ client, repository: "acme/app", from: FROM, to: new Date("2026-11-17T00:00:00Z"), cache: EMPTY });
    expect(result.error).toBeNull();
    expect(result.runs).toMatchObject({ counted: 1, running: 1 });
    expect(result.jobs[0]).toMatchObject({ startedAt: "2026-11-18T13:18:33Z", completedAt: null, runAttempt: 1 });
  });
});

describe("getNextLink on hostile input", () => {
  it("returns quickly on a long header of repeated brackets", () => {
    const started = Date.now();
    expect(getNextLink(`<${"<=".repeat(100_000)}`)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
