import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// How the workflows spend runner minutes. A branch pushed with a pull request open must not run the same suite
// twice (push and pull request have different refs, so `concurrency` cannot fold them), a superseded run is
// cancelled, and a reusable workflow that hangs fails within minutes instead of holding a runner for six hours.

const WORKFLOWS_DIR = join(REPO_ROOT, ".github/workflows");

interface Job {
  "timeout-minutes"?: number;
  steps?: { uses?: string; with?: Record<string, unknown> }[];
}

interface Workflow {
  on: Record<string, { branches?: string[]; "paths-ignore"?: string[]; paths?: string[] } | null>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  jobs: Record<string, Job>;
}

function readWorkflow(name: string): Workflow {
  return parse(readFileSync(join(WORKFLOWS_DIR, name), "utf8")) as Workflow;
}

const REUSABLE = readdirSync(WORKFLOWS_DIR).filter((name) => {
  const workflow = readWorkflow(name);
  return Object.keys(workflow.on).length === 1 && "workflow_call" in workflow.on;
});

describe.each(["ci.yml", "e2e.yml"])("%s", (name) => {
  const workflow = readWorkflow(name);

  it("runs on pull requests, on master and on demand, not on every pushed branch", () => {
    expect(Object.keys(workflow.on).sort()).toEqual(["pull_request", "push", "workflow_dispatch"]);
    expect(workflow.on.push?.branches).toEqual(["master"]);
  });

  it("folds runs of one pull request together and cancels the superseded one", () => {
    expect(workflow.concurrency?.group).toContain("github.event.pull_request.number || github.ref");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(true);
  });
});

describe("ci.yml", () => {
  it("has no paths filter: its repository tests guard the Markdown too", () => {
    const workflow = readWorkflow("ci.yml");
    for (const trigger of Object.values(workflow.on)) {
      expect(trigger?.["paths-ignore"]).toBeUndefined();
      expect(trigger?.paths).toBeUndefined();
    }
  });
});

describe("e2e.yml", () => {
  const workflow = readWorkflow("e2e.yml");

  it("skips documents-only changes the same way on push and pull request", () => {
    expect(workflow.on.push?.["paths-ignore"]).toContain("docs/**");
    expect(workflow.on.pull_request?.["paths-ignore"]).toEqual(workflow.on.push?.["paths-ignore"]);
  });

  it("never ignores the example app, whose blog content is Markdown", () => {
    for (const pattern of workflow.on.push?.["paths-ignore"] ?? []) {
      expect(pattern).not.toMatch(/^examples\b|^\*\*\/\*\.md$/);
    }
  });
});

describe("release.yml", () => {
  it("dry-runs on pull requests only when the release machinery changes", () => {
    const paths = readWorkflow("release.yml").on.pull_request?.paths ?? [];
    expect(paths).toContain("scripts/release/**");
    expect(paths).toContain("**/package.json");
    expect(paths).toContain(".github/workflows/release.yml");
  });
});

describe.each(REUSABLE)("reusable %s", (name) => {
  it("gives every job a timeout", () => {
    for (const [id, job] of Object.entries(readWorkflow(name).jobs)) {
      expect(job["timeout-minutes"], `${name} → ${id}`).toBeGreaterThan(0);
    }
  });
});

describe("the reusable workflows", () => {
  it("include blog-links.yml and deploy-app.yml", () => {
    expect(REUSABLE).toEqual(expect.arrayContaining(["blog-links.yml", "deploy-app.yml"]));
  });

  it.each(["blog-links.yml", "deploy-app.yml"])("%s lets the caller skip heavy folders at checkout", (name) => {
    const checkouts = Object.values(readWorkflow(name).jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkouts.some((step) => step.with?.["sparse-checkout"] === "${{ inputs.sparse-checkout }}")).toBe(true);
  });
});
