import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// How the workflows spend runner minutes. A branch pushed with a pull request open must not run the same suite
// twice (push and pull request have different refs, so `concurrency` cannot fold them), a superseded run is
// cancelled, and a reusable workflow that hangs fails within minutes instead of holding a runner for six hours.

const WORKFLOWS_DIR = join(REPO_ROOT, ".github/workflows");

interface Step {
  name?: string;
  if?: string;
  uses?: string;
  with?: Record<string, unknown>;
  run?: string;
  env?: Record<string, string>;
  "timeout-minutes"?: number;
}

interface Job {
  "timeout-minutes"?: number;
  steps?: Step[];
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

  // apt fetched ffmpeg from the runner's Ubuntu mirror, which at times served it at a few KB/s and held the render
  // job until its timeout (#672).
  it("installs ffmpeg for the render job from pinned, checksummed builds, not apt, within its own timeout", () => {
    const render = readWorkflow("ci.yml").jobs.render;
    const install = render?.steps?.find((step) => step.name === "Install ffmpeg");
    expect(install?.run).toBeDefined();
    expect(install?.run).not.toMatch(/apt(-get)?\b/);
    expect(install?.run).toContain("sha256sum -c");
    expect(install?.run).toContain("$GITHUB_PATH");
    expect(install?.env?.FFMPEG_RELEASE).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/[^/]+$/);
    expect(install?.env?.FFMPEG_RELEASE).not.toMatch(/\/latest$/);
    expect(install?.env?.FFMPEG_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(install?.env?.FFPROBE_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(install?.["timeout-minutes"]).toBeLessThan(render?.["timeout-minutes"] ?? 0);
  });

  // The README's container recipe for a footage worker is the file CI builds and renders in, so a copied recipe works.
  it("renders the footage films in the worker image built from the README's recipe, the build within its own timeout", () => {
    const job = readWorkflow("ci.yml").jobs["footage-image"];
    const build = job?.steps?.find((step) => step.name === "Build the footage worker image");
    expect(build?.run).toContain("-f tools/marketing-kit/docker/footage-worker.Dockerfile");
    expect(build?.["timeout-minutes"]).toBeLessThan(job?.["timeout-minutes"] ?? 0);
    expect(job?.steps?.find((step) => step.name === "Render the fixture footage film in the image")?.run).toContain('-t "the fixture footage film"');
    expect(readFileSync(join(REPO_ROOT, "tools/marketing-kit/README.md"), "utf8")).toContain("docker/footage-worker.Dockerfile");
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

// `npx playwright install --with-deps chromium` ran apt against the runner's Ubuntu mirror within a 5-minute step, and
// a slow mirror failed the theme-notion visual job before any test ran (#820). The browser now comes from a cache
// keyed on the Playwright version, and apt gets a step timeout long enough to wait out a slow mirror.
const CHROMIUM_ACTION = "./.github/actions/playwright-chromium";

describe.each([
  ["themes.yml", "visual"],
  ["e2e.yml", "e2e"],
  ["e2e.yml", "stripe-sandbox"],
])("%s → %s installs Chromium", (name, jobId) => {
  const job = readWorkflow(name).jobs[jobId];
  const install = job?.steps?.find((step) => step.name === "Install Chromium");

  it("through the shared cached action", () => {
    expect(install?.uses).toBe(CHROMIUM_ACTION);
    expect(install?.run).toBeUndefined();
  });

  it("within a step timeout that waits out a slow mirror and still ends before the job's", () => {
    expect(install?.["timeout-minutes"]).toBeGreaterThanOrEqual(15);
    if (job?.["timeout-minutes"] !== undefined) {
      expect(install?.["timeout-minutes"]).toBeLessThan(job["timeout-minutes"]);
    }
  });
});

describe("the playwright-chromium action", () => {
  interface CompositeAction {
    runs: { using: string; steps: Step[] };
  }
  const action = parse(
    readFileSync(join(REPO_ROOT, ".github/actions/playwright-chromium/action.yml"), "utf8"),
  ) as CompositeAction;
  const steps = action.runs.steps;
  const cache = steps.find((step) => step.uses?.startsWith("actions/cache@"));

  it("caches Playwright's browsers keyed on the installed playwright-core version", () => {
    expect(action.runs.using).toBe("composite");
    expect(cache?.with?.path).toBe("~/.cache/ms-playwright");
    expect(cache?.with?.key).toContain("steps.version.outputs.playwright");
    const version = steps.find((step) => step.with === undefined && step.run?.includes("playwright-core/package.json"));
    expect(version?.run).toContain("$GITHUB_OUTPUT");
  });

  it("downloads the browser only on a cache miss and installs the system packages on its own", () => {
    const browser = steps.find((step) => step.run?.includes("npx playwright install chromium"));
    expect(browser?.run).not.toContain("--with-deps");
    expect(browser?.if).toContain("cache-hit != 'true'");
    expect(steps.some((step) => step.run?.includes("npx playwright install-deps chromium"))).toBe(true);
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
