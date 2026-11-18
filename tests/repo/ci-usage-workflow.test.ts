import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// The reusable CI minutes report (issue #1360): one job without a checkout, the read token and the write token kept
// apart, the CLI pinned to the released package, and callers that run weekly and by hand only.

interface Step {
  name?: string;
  uses?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

interface Job {
  permissions?: Record<string, string>;
  steps?: Step[];
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: Record<string, string>;
}

interface Workflow {
  on: Record<string, { inputs?: Record<string, { default?: unknown }>; secrets?: Record<string, { required?: boolean }> } | null> & { schedule?: { cron: string }[] };
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
}

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

const WORKFLOW = parse(read(".github/workflows/ci-usage.yml")) as Workflow;
const PACKAGE = JSON.parse(read("tools/ci-usage/package.json")) as { version: string; files: string[] };
const inputs = WORKFLOW.on.workflow_call?.inputs ?? {};
const report = WORKFLOW.jobs.report;
const steps = report?.steps ?? [];

function getStep(name: string): Step | undefined {
  return steps.find((step) => step.name === name);
}

describe("ci-usage.yml", () => {
  it("runs only when called, as one job", () => {
    expect(Object.keys(WORKFLOW.on)).toEqual(["workflow_call"]);
    expect(Object.keys(WORKFLOW.jobs)).toEqual(["report"]);
    expect(WORKFLOW.permissions).toEqual({ contents: "read" });
    expect(report?.permissions).toEqual({ actions: "read", issues: "write" });
  });

  it("installs the CLI at the released version by default", () => {
    expect(inputs["cli-version"]?.default).toBe(PACKAGE.version);
    expect(getStep("Install the CLI")?.run).toContain('"@softure-ai/ci-usage@$CLI_VERSION"');
  });

  it("never checks out the caller's code", () => {
    expect(steps.some((step) => step.uses?.startsWith("actions/checkout") === true)).toBe(false);
  });

  it("reads with the optional token and writes the issue with the job's own", () => {
    expect(WORKFLOW.on.workflow_call?.secrets?.CI_USAGE_TOKEN?.required).toBe(false);
    expect(getStep("Report")?.env?.GITHUB_TOKEN).toBe("${{ secrets.CI_USAGE_TOKEN || github.token }}");
    expect(getStep("Publish the issue")?.env?.GITHUB_TOKEN).toBe("${{ github.token }}");
    expect(getStep("Publish the issue")?.if).toBe("inputs.publish");
  });

  it("keeps the report in the summary and the artifact, and the run cache between reports", () => {
    expect(getStep("Report")?.run).toContain('>> "$GITHUB_STEP_SUMMARY"');
    expect(steps.find((step) => step.uses?.startsWith("actions/upload-artifact") === true)?.with?.name).toBe("ci-usage-report");
    expect(steps.find((step) => step.uses?.startsWith("actions/cache") === true)?.with).toMatchObject({ "restore-keys": "ci-usage-" });
  });

  it("passes every input through by environment, never interpolated into a script", () => {
    for (const step of steps) expect(step.run ?? "", step.name).not.toMatch(/\$\{\{/);
  });

  it("ships the example with the package", () => {
    expect(PACKAGE.files).toContain("examples");
  });
});

describe.each([
  ["tools/ci-usage/examples/ci-usage.yml", "SOFTURE/AI/.github/workflows/ci-usage.yml@master"],
  [".github/workflows/ci-usage-self.yml", "./.github/workflows/ci-usage.yml"],
])("the caller %s", (path, uses) => {
  const caller = parse(read(path)) as Workflow;
  const job = caller.jobs["ci-usage"];

  it("runs weekly and by hand only", () => {
    expect(Object.keys(caller.on).sort()).toEqual(["schedule", "workflow_dispatch"]);
    expect(caller.on.schedule).toEqual([{ cron: "30 6 * * 1" }]);
  });

  it("calls the reusable workflow with exactly the permissions it needs", () => {
    expect(caller.permissions).toEqual({});
    expect(job?.uses).toBe(uses);
    expect(job?.permissions).toEqual({ contents: "read", actions: "read", issues: "write" });
    expect(job?.secrets).toEqual({ CI_USAGE_TOKEN: "${{ secrets.CI_USAGE_TOKEN }}" });
  });
});
