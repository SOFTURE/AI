import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  uses?: string;
  env?: Record<string, unknown>;
  run?: string;
  "working-directory"?: string;
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

// A self-hosted runner keeps one work directory per repository between jobs, and a sparse checkout an earlier job left
// there outlives the next full checkout (issue #687), so every job that checks out empties the workspace first.
const EMPTY_WORKSPACE = getJobSteps("deploy-release-checks.yml", "static")[1];

function getJobSteps(name: string, jobId: string): Step[] {
  return readWorkflow(name).jobs[jobId]?.steps ?? [];
}

function isCheckout(step: Step): boolean {
  return step.uses?.startsWith("actions/checkout@") ?? false;
}

function runEmptyWorkspace(env: Record<string, string>): { status: number | null; output: string } {
  const result = spawnSync("bash", ["-e", "-c", EMPTY_WORKSPACE?.run ?? "exit 99"], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

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

  it("empties the workspace right after the runner check in every job that checks out (issue #687)", () => {
    for (const id of Object.keys(workflow.jobs)) {
      const steps = getJobSteps(name, id);
      if (!steps.some(isCheckout)) continue;
      expect(steps[1], `${name} → ${id}`).toEqual(EMPTY_WORKSPACE);
    }
  });
});

describe("the workspace step (issue #687)", () => {
  let root = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "empty-workspace-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("runs outside the workspace, with nothing interpolated into the script", () => {
    expect(EMPTY_WORKSPACE?.name).toBe("Empty the workspace");
    expect(EMPTY_WORKSPACE?.["working-directory"]).toBe("${{ runner.temp }}");
    expect(EMPTY_WORKSPACE?.run).not.toContain("${{");
  });

  it("removes files, dot files and folders, a git folder included, and keeps the workspace", () => {
    const workspace = join(root, "app");
    mkdirSync(join(workspace, ".git/info"), { recursive: true });
    writeFileSync(join(workspace, ".git/info/sparse-checkout"), "/package.json\n");
    writeFileSync(join(workspace, "package.json"), "{}");
    writeFileSync(join(workspace, ".eslintcache"), "");
    mkdirSync(join(workspace, ".softure-ai-deploy/nested"), { recursive: true });

    expect(runEmptyWorkspace({ GITHUB_WORKSPACE: workspace })).toEqual({ status: 0, output: "" });
    expect(readdirSync(workspace)).toEqual([]);
  });

  it("passes on an empty workspace, as on a hosted runner", () => {
    const workspace = join(root, "app");
    mkdirSync(workspace);
    expect(runEmptyWorkspace({ GITHUB_WORKSPACE: workspace })).toEqual({ status: 0, output: "" });
    expect(existsSync(workspace)).toBe(true);
  });

  it("fails, naming the workspace, when an entry cannot be removed", () => {
    const workspace = join(root, "app");
    mkdirSync(workspace);
    writeFileSync(join(workspace, "owned-by-root"), "");
    const bin = join(root, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "rm"), "#!/bin/sh\necho \"rm: Permission denied\" >&2\nexit 1\n");
    chmodSync(join(bin, "rm"), 0o755);

    const result = spawnSync("bash", ["-e", "-c", EMPTY_WORKSPACE?.run ?? "exit 99"], {
      env: { PATH: `${bin}:${process.env.PATH ?? ""}`, GITHUB_WORKSPACE: workspace },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`::error::The workspace ${workspace} could not be emptied`);
    expect(readdirSync(workspace)).toEqual(["owned-by-root"]);
  });

  it("refuses an unset workspace and removes nothing", () => {
    const result = runEmptyWorkspace({});
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("GITHUB_WORKSPACE");
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
