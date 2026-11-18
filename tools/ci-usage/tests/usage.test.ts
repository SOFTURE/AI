import { describe, expect, it } from "vitest";
import { DEFAULT_PRICES } from "../src/prices.js";
import { getJobMinutes, getPercentile, summarizeUsage } from "../src/usage.js";
import { makeJob } from "./fixtures.js";

const OPTIONS = { prices: DEFAULT_PRICES, ubicloudPremium: false };

describe("getJobMinutes", () => {
  it.each([
    [0, 0],
    [1, 1],
    [60, 1],
    [61, 2],
    [3599, 60],
  ])("bills %i seconds as %i minutes", (seconds, minutes) => {
    expect(getJobMinutes(makeJob({ seconds }))).toBe(minutes);
  });

  it("bills nothing for a job that never started", () => {
    expect(getJobMinutes(makeJob({ startedAt: null, completedAt: null }))).toBe(0);
  });

  it("bills a started job without an end up to the run's last update", () => {
    expect(getJobMinutes(makeJob({ completedAt: null, runUpdatedAt: "2026-11-17T10:05:30Z" }))).toBe(6);
  });
});

describe("getPercentile", () => {
  it("takes the nearest rank and 0 for no values", () => {
    expect(getPercentile([], 50)).toBe(0);
    expect(getPercentile([1, 2, 3, 4], 50)).toBe(2);
    expect(getPercentile([1, 2, 3, 4], 95)).toBe(4);
  });
});

describe("summarizeUsage", () => {
  it("sums minutes and cost per provider, workflow and job, most first", () => {
    const jobs = [
      makeJob({ seconds: 600, name: "test", runId: 1 }),
      makeJob({ seconds: 90, name: "test", runId: 1, runAttempt: 2 }),
      makeJob({ seconds: 300, name: "build", runId: 2, labels: ["ubicloud-standard-4"], runnerGroupName: "Default" }),
      makeJob({ seconds: 60, name: "films", workflowName: "e2e", workflowPath: ".github/workflows/e2e.yml", runId: 3, labels: ["macos-latest"] }),
    ];
    const usage = summarizeUsage("acme/app", jobs, OPTIONS);

    expect(usage).toMatchObject({ repository: "acme/app", runs: 3, jobs: 4, minutes: 18, unpricedMinutes: 0 });
    expect(usage.usd).toBeCloseTo(12 * 0.006 + 5 * 0.0025 + 1 * 0.062, 4);
    expect(usage.byProvider["github-hosted"]).toEqual({ minutes: 13, usd: 0.134, unpricedMinutes: 0 });
    expect(usage.byProvider.ubicloud).toEqual({ minutes: 5, usd: 0.0125, unpricedMinutes: 0 });
    expect(usage.byWorkflow.map((workflow) => [workflow.path, workflow.minutes, workflow.runs, workflow.share])).toEqual([
      [".github/workflows/ci.yml", 17, 2, 0.944],
      [".github/workflows/e2e.yml", 1, 1, 0.056],
    ]);
    expect(usage.byWorkflow[0]?.byJob.map((job) => [job.name, job.runner, job.count, job.minutes, job.p50Minutes, job.p95Minutes])).toEqual([
      ["test", "ubuntu-latest", 2, 12, 2, 10],
      ["build", "ubicloud-standard-4", 1, 5, 5, 5],
    ]);
    expect(usage.longestJobs[0]).toMatchObject({ job: "test", minutes: 10 });
  });

  it("marks the cost unknown when minutes ran on a runner without a price", () => {
    const usage = summarizeUsage("acme/app", [makeJob({ seconds: 120, labels: ["self-hosted"], runnerGroupName: "Default" }), makeJob({ seconds: 60 })], OPTIONS);
    expect(usage).toMatchObject({ minutes: 3, usd: null, unpricedMinutes: 2 });
    expect(usage.byProvider["github-hosted"]).toEqual({ minutes: 1, usd: 0.006, unpricedMinutes: 0 });
  });

  it("reports an empty period with zeros", () => {
    expect(summarizeUsage("acme/app", [], OPTIONS)).toMatchObject({ runs: 0, jobs: 0, minutes: 0, usd: 0, byWorkflow: [], longestJobs: [] });
  });

  it("leaves a skipped job out of the longest jobs but counts it as a job", () => {
    const usage = summarizeUsage("acme/app", [makeJob({ startedAt: null, completedAt: null })], OPTIONS);
    expect(usage).toMatchObject({ jobs: 1, minutes: 0, longestJobs: [] });
  });
});
