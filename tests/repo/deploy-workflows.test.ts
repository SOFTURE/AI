import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// The reusable deploy workflows (DP-2) run in other repositories against a live server, so their shape is guarded
// here as well as by actionlint in CI: what triggers them, what each job may do, and how values reach scripts.

const WORKFLOWS_DIR = join(REPO_ROOT, ".github/workflows");
const EXAMPLE_CALLER = join(REPO_ROOT, "tools/deploy/examples/deploy.yml");
const CALLER_PREFIX = "SOFTURE/AI/.github/workflows/";

interface WorkflowInput {
  required?: boolean;
  default?: unknown;
}

interface Step {
  run?: string;
  uses?: string;
}

interface Job {
  permissions?: unknown;
  steps?: Step[];
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: Record<string, unknown> | "inherit";
}

interface Workflow {
  on: Record<string, unknown>;
  permissions?: unknown;
  jobs: Record<string, Job>;
}

interface WorkflowCall {
  inputs?: Record<string, WorkflowInput>;
  secrets?: Record<string, { required?: boolean }>;
}

function readYaml(path: string): Workflow {
  return parse(readFileSync(path, "utf8")) as Workflow;
}

function listDeployWorkflows(): string[] {
  return readdirSync(WORKFLOWS_DIR).filter((name) => /^deploy-.+\.yml$/.test(name));
}

function getWorkflowCall(workflow: Workflow): WorkflowCall {
  return (workflow.on.workflow_call ?? {});
}

const DEPLOY_WORKFLOWS = listDeployWorkflows();

describe("the reusable deploy workflows", () => {
  it("exist", () => {
    expect(DEPLOY_WORKFLOWS).toContain("deploy-app.yml");
  });

  describe.each(DEPLOY_WORKFLOWS)("%s", (name) => {
    const workflow = readYaml(join(WORKFLOWS_DIR, name));
    const jobs = Object.entries(workflow.jobs);

    it("is triggered only by workflow_call", () => {
      expect(Object.keys(workflow.on)).toEqual(["workflow_call"]);
    });

    it("sets permissions at the top and on every job", () => {
      expect(workflow.permissions).toBeDefined();
      for (const [, job] of jobs) expect(job.permissions).toBeDefined();
    });

    it("gives packages: write to the build job only", () => {
      const writers = jobs.filter(([, job]) => JSON.stringify(job.permissions ?? {}).includes('"packages":"write"'));
      expect(writers.map(([id]) => id)).toEqual(["build"]);
    });

    it("never interpolates inputs, secrets or event data into a script", () => {
      for (const [, job] of jobs) {
        for (const step of job.steps ?? []) {
          expect(step.run ?? "").not.toMatch(/\$\{\{\s*(inputs|secrets|github\.event)\b/);
        }
      }
    });

    it("checks the server's host key and never learns it on first use", () => {
      const scripts = jobs.flatMap(([, job]) => (job.steps ?? []).map((step) => step.run ?? "")).join("\n");
      expect(scripts).toContain("-o StrictHostKeyChecking=yes");
      expect(scripts).not.toMatch(/StrictHostKeyChecking=(no|accept-new)/);
      expect(scripts).not.toContain("ssh-keyscan");
    });
  });

  it("default to the CLI version of @softure-ai/deploy", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "tools/deploy/package.json"), "utf8")) as { version: string };
    const inputs = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"))).inputs ?? {};
    expect(inputs["deploy-cli-version"]?.default).toBe(pkg.version);
  });
});

describe("the example caller workflow", () => {
  const caller = readYaml(EXAMPLE_CALLER);
  const callingJobs = Object.values(caller.jobs).filter((job) => job.uses !== undefined);

  it("calls the deploy workflow with one uses: line", () => {
    expect(callingJobs).toHaveLength(1);
    expect(callingJobs[0]?.uses).toMatch(/^SOFTURE\/AI\/\.github\/workflows\/deploy-app\.yml@deploy-workflows-v1$/);
  });

  it("grants the called jobs what they need and nothing to write code", () => {
    expect(caller.permissions).toEqual({ contents: "read", packages: "write" });
  });

  const job = callingJobs[0] as Job;
  const target = (job.uses ?? "").slice(CALLER_PREFIX.length).replace(/@.*$/, "");
  const called = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, target)));

  it("passes only declared inputs and every required one", () => {
    const declared = called.inputs ?? {};
    const passed = Object.keys(job.with ?? {});
    for (const key of passed) expect(Object.keys(declared)).toContain(key);
    const required = Object.entries(declared).filter(([, input]) => input.required === true);
    for (const [key] of required) expect(passed).toContain(key);
  });

  it("passes secrets explicitly: only declared ones and every required one", () => {
    expect(job.secrets).not.toBe("inherit");
    const declared = called.secrets ?? {};
    const passed = Object.keys(job.secrets as Record<string, unknown>);
    expect(passed.sort()).toEqual(Object.keys(declared).sort());
  });
});
