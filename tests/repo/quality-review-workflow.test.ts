import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// The reusable quality review (issue #1212): on demand only, the API key and the write token never in one job, the
// report delivered through a pull request and never pushed to the base branch, the CLI pinned to the released package.

interface Step {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

interface Job {
  needs?: string;
  permissions?: Record<string, string>;
  steps?: Step[];
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: Record<string, string>;
}

interface Workflow {
  on: Record<string, { inputs?: Record<string, { default?: unknown }>; secrets?: Record<string, { required?: boolean }> } | null>;
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
}

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

const TEXT = read(".github/workflows/quality-review.yml");
const WORKFLOW = parse(TEXT) as Workflow;
const PACKAGE = JSON.parse(read("tools/quality-review/package.json")) as {
  version: string;
  files: string[];
  peerDependencies: Record<string, string>;
};
const inputs = WORKFLOW.on.workflow_call?.inputs ?? {};
const review = WORKFLOW.jobs.review;
const deliver = WORKFLOW.jobs.deliver;

describe("quality-review.yml", () => {
  it("runs only when called: no schedule, no push, no pull request trigger", () => {
    expect(Object.keys(WORKFLOW.on)).toEqual(["workflow_call"]);
  });

  it("needs ANTHROPIC_API_KEY as a secret and gives it to the review step only", () => {
    expect(WORKFLOW.on.workflow_call?.secrets?.ANTHROPIC_API_KEY?.required).toBe(true);
    const users = Object.entries(WORKFLOW.jobs).flatMap(([id, job]) =>
      (job.steps ?? []).filter((step) => JSON.stringify(step).includes("secrets.ANTHROPIC_API_KEY")).map((step) => `${id}:${step.name ?? ""}`),
    );
    expect(users).toEqual(["review:Review the repository"]);
    expect(TEXT).not.toMatch(/^\s+environment:/m);
  });

  it("reads only in the review job and writes only in the deliver job, which has no API key", () => {
    expect(WORKFLOW.permissions).toEqual({ contents: "read" });
    expect(review?.permissions).toEqual({ contents: "read" });
    expect(deliver?.permissions).toEqual({ contents: "write", "pull-requests": "write" });
    expect(deliver?.needs).toBe("review");
    expect(review?.steps?.find((step) => step.uses?.startsWith("actions/checkout@"))?.with?.["persist-credentials"]).toBe(false);
  });

  it("pushes only the report branch, refuses a report branch equal to the base, and opens or updates one pull request", () => {
    const run = deliver?.steps?.find((step) => step.name === "Commit the report and open or update the pull request")?.run ?? "";
    const pushes = run.split("\n").filter((line) => line.includes("git push"));
    expect(pushes.map((line) => line.trim())).toEqual(['git push --force origin "HEAD:refs/heads/$BRANCH"']);
    expect(run).toContain('gh pr list --repo "$GITHUB_REPOSITORY" --head "$BRANCH" --base "$BASE" --state open');
    expect(run).toContain("gh pr edit");
    expect(run).toContain("gh pr create");
    const base = deliver?.steps?.find((step) => step.name === "Resolve the base branch")?.run ?? "";
    expect(base).toContain('if [ "$base" = "$BRANCH" ]; then');
  });

  it("validates the report before it uploads it", () => {
    const run = review?.steps?.find((step) => step.name === "Review the repository")?.run ?? "";
    expect(run).toContain("softure-quality-review\" run --repo .");
    expect(run).toContain("softure-quality-review\" check");
  });

  it("defaults to the released CLI, the Agent SDK version the package names, a 10 USD cap and the default model", () => {
    expect(inputs["cli-version"]?.default).toBe(PACKAGE.version);
    expect(PACKAGE.peerDependencies["@anthropic-ai/claude-agent-sdk"]).toBe(`>=${String(inputs["agent-sdk-version"]?.default)}`);
    expect(inputs["max-budget-usd"]?.default).toBe("10");
    expect(inputs.model?.default).toBe("claude-opus-5-5");
  });

  it("installs the CLI and the SDK at exact versions outside the checkout", () => {
    const install = review?.steps?.find((step) => step.name === "Install the review CLI");
    expect(install?.run).toContain('"@softure-ai/quality-review@$CLI_VERSION" "@anthropic-ai/claude-agent-sdk@$SDK_VERSION"');
    expect(install?.["working-directory" as keyof Step]).toBe("${{ runner.temp }}");
  });
});

describe("the example caller", () => {
  const example = parse(read("tools/quality-review/examples/quality-review.yml")) as Workflow;
  const job = example.jobs["quality-review"];

  it("starts only by hand and calls the reusable workflow with the secret and the two write permissions", () => {
    expect(Object.keys(example.on)).toEqual(["workflow_dispatch"]);
    expect(example.permissions).toEqual({});
    expect(job?.uses).toBe("SOFTURE/AI/.github/workflows/quality-review.yml@master");
    expect(job?.permissions).toEqual({ contents: "write", "pull-requests": "write" });
    expect(job?.secrets).toEqual({ ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}" });
  });

  it("passes only inputs the reusable workflow has", () => {
    for (const key of Object.keys(job?.with ?? {})) expect(inputs, key).toHaveProperty(key);
  });
});

describe("the package", () => {
  it("ships the shared prompt and the example", () => {
    expect(PACKAGE.files).toEqual(expect.arrayContaining(["prompt", "examples"]));
    expect(read("tools/quality-review/prompt/quality-review.md")).toContain("<finding>{");
  });
});
