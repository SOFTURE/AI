import type { JobRecord } from "../src/usage.js";

let nextId = 1;

/** A finished job of `seconds` on `labels`, started at 2026-11-17 10:00 UTC. */
export function makeJob(overrides: Partial<JobRecord> & { seconds?: number } = {}): JobRecord {
  const { seconds = 120, ...rest } = overrides;
  const id = nextId++;
  const start = Date.parse("2026-11-17T10:00:00Z");
  return {
    id,
    runId: 1000 + id,
    runAttempt: 1,
    name: "test",
    workflowName: "ci",
    workflowPath: ".github/workflows/ci.yml",
    startedAt: new Date(start).toISOString(),
    completedAt: new Date(start + seconds * 1000).toISOString(),
    runUpdatedAt: new Date(start + seconds * 1000).toISOString(),
    labels: ["ubuntu-latest"],
    runnerGroupName: "GitHub Actions",
    htmlUrl: `https://github.com/acme/app/actions/runs/${String(1000 + id)}/job/${String(id)}`,
    ...rest,
  };
}
