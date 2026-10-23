import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// Where the reusable workflows run (issue #670). A caller picks the runner with one `runs-on` input, a JSON string
// (`'"ubuntu-latest"'` or `'["self-hosted","linux"]'`), so every job reads that input instead of a label of its own,
// and checks its shape first.

const WORKFLOWS_DIR = join(REPO_ROOT, ".github/workflows");
const RUNS_ON = "${{ fromJSON(inputs.runs-on) }}";
const DEFAULT_RUNS_ON = '"ubuntu-latest"';

interface Step {
  name?: string;
  env?: Record<string, unknown>;
  run?: string;
}

interface Job {
  "runs-on"?: unknown;
  steps?: Step[];
}

interface Workflow {
  on: Record<string, { inputs?: Record<string, { type?: string; default?: unknown; required?: boolean }> } | null>;
  jobs: Record<string, Job>;
}

function readWorkflow(name: string): Workflow {
  return parse(readFileSync(join(WORKFLOWS_DIR, name), "utf8")) as Workflow;
}

const REUSABLE = readdirSync(WORKFLOWS_DIR).filter((name) => {
  const workflow = readWorkflow(name);
  return Object.keys(workflow.on).length === 1 && "workflow_call" in workflow.on;
});

function getCheckStep(name: string, jobId: string): Step | undefined {
  return readWorkflow(name).jobs[jobId]?.steps?.[0];
}

const FIRST_CHECK = getCheckStep("deploy-release-checks.yml", "static");

function runCheck(value: string): { status: number | null; output: string } {
  const result = spawnSync("bash", ["-e", "-c", FIRST_CHECK?.run ?? "exit 99"], {
    env: { PATH: process.env.PATH, RUNS_ON: value },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("the reusable workflows", () => {
  it("include the nine the issue lists", () => {
    expect(REUSABLE).toEqual(
      expect.arrayContaining([
        "blog-links.yml",
        "deploy-app.yml",
        "deploy-cancel-run.yml",
        "deploy-cut-release.yml",
        "deploy-integration.yml",
        "deploy-release-checks.yml",
        "deploy-release-image.yml",
        "deploy-release-notes.yml",
        "deploy-report.yml",
      ]),
    );
  });
});

describe.each(REUSABLE)("reusable %s", (name) => {
  const workflow = readWorkflow(name);

  it("takes an optional runs-on input, a JSON string that defaults to ubuntu-latest", () => {
    const input = workflow.on.workflow_call?.inputs?.["runs-on"];
    expect(input?.type).toBe("string");
    expect(input?.required ?? false).toBe(false);
    expect(input?.default).toBe(DEFAULT_RUNS_ON);
  });

  it("runs every job on the runs-on input, never on a runner of its own", () => {
    for (const [id, job] of Object.entries(workflow.jobs)) {
      expect(job["runs-on"], `${name} → ${id}`).toBe(RUNS_ON);
    }
  });

  it("checks the runner first in every job, with the one shared step", () => {
    for (const id of Object.keys(workflow.jobs)) {
      expect(getCheckStep(name, id), `${name} → ${id}`).toEqual(FIRST_CHECK);
    }
  });
});

describe("the runner check", () => {
  it("reads the input from the environment, never interpolated into the script", () => {
    expect(FIRST_CHECK?.name).toBe("Check the runner");
    expect(FIRST_CHECK?.env).toEqual({ RUNS_ON: "${{ inputs.runs-on }}" });
    expect(FIRST_CHECK?.run).not.toContain("${{");
  });

  it.each([
    DEFAULT_RUNS_ON,
    '["self-hosted","linux"]',
    '[ "self-hosted", "linux", "x64" ]',
    '["ubuntu-24.04"]',
    ' "my-runner_1" \n',
  ])("accepts %j", (value) => {
    expect(runCheck(value)).toEqual({ status: 0, output: "" });
  });

  it.each([
    "",
    "ubuntu-latest",
    '"ubuntu-latest',
    '""',
    "[]",
    '[""]',
    "[1]",
    '["linux",]',
    '["linux" "x64"]',
    '{"group":"runners"}',
    '"a\\"b"',
    "null",
  ])("refuses %j, naming runs-on", (value) => {
    const result = runCheck(value);
    expect(result.status).toBe(1);
    expect(result.output).toContain("::error::Input runs-on is not valid");
  });
});
