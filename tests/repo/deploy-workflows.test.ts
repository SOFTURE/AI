import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

// The reusable deploy workflows (DP-2) run in other repositories against a live server, so their shape is guarded
// here as well as by actionlint in CI: what triggers them, what each job may do, and how values reach scripts.

const WORKFLOWS_DIR = join(REPO_ROOT, ".github/workflows");
const EXAMPLE_CALLER = join(REPO_ROOT, "tools/deploy/examples/deploy.yml");
const EXAMPLE_RELEASE_CALLER = join(REPO_ROOT, "tools/deploy/examples/release.yml");
const EXAMPLE_INTEGRATION_CALLER = join(REPO_ROOT, "tools/deploy/examples/integration.yml");
const EXAMPLE_CHECKS_CALLER = join(REPO_ROOT, "tools/deploy/examples/checks.yml");
const EXAMPLE_NOTES_CALLER = join(REPO_ROOT, "tools/deploy/examples/release-notes.yml");
const EXAMPLE_ENVIRONMENTS_CALLER = join(REPO_ROOT, "tools/deploy/examples/deploy-environments.yml");
const ACTION_FILE = join(REPO_ROOT, ".github/actions/deploy/action.yml");
const CALLER_PREFIX = "SOFTURE/AI/.github/workflows/";

interface WorkflowInput {
  required?: boolean;
  default?: unknown;
}

interface Step {
  id?: string;
  shell?: string;
  name?: string;
  if?: string;
  "working-directory"?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
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

// Every job of a reusable workflow opens with the runner check (issue #670), and every one that checks out then empties
// the workspace (issue #687); workflow-runners.test.ts covers both, so the tests here read the steps after them.
function readYaml(path: string): Workflow {
  const workflow = parse(readFileSync(path, "utf8")) as Workflow;
  for (const job of Object.values(workflow.jobs)) {
    if (job.steps?.[0]?.name === "Check the runner") job.steps = job.steps.slice(1);
    if (job.steps?.[0]?.name === "Empty the workspace") job.steps = job.steps.slice(1);
  }
  return workflow;
}

interface Action {
  inputs: Record<string, { required?: boolean; default?: string }>;
  outputs: Record<string, { value?: string }>;
  runs: { using: string; steps: Step[] };
}

function readAction(): Action {
  return parse(readFileSync(ACTION_FILE, "utf8")) as Action;
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
    expect(DEPLOY_WORKFLOWS).toContain("deploy-cut-release.yml");
    expect(DEPLOY_WORKFLOWS).toContain("deploy-release-checks.yml");
    expect(DEPLOY_WORKFLOWS).toContain("deploy-release-image.yml");
    expect(DEPLOY_WORKFLOWS).toContain("deploy-release-notes.yml");
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

    it("gives packages: write to the build job only, when there is one", () => {
      const writers = jobs.filter(([, job]) => JSON.stringify(job.permissions ?? {}).includes('"packages":"write"'));
      const hasBuild = jobs.some(([id]) => id === "build");
      expect(writers.map(([id]) => id)).toEqual(hasBuild ? ["build"] : []);
    });

    it("gives contents: write only to the jobs that write a release or a note (report, cut, record)", () => {
      const writers = jobs.filter(([, job]) => JSON.stringify(job.permissions ?? {}).includes('"contents":"write"'));
      const releaseWriters: Record<string, string[]> = {
        "deploy-report.yml": ["report"],
        "deploy-cut-release.yml": ["cut"],
        "deploy-integration.yml": ["record"],
        "deploy-release-notes.yml": ["notes"],
      };
      expect(writers.map(([id]) => id)).toEqual(releaseWriters[name] ?? []);
    });

    it("never interpolates inputs, secrets or event data into a script", () => {
      for (const [, job] of jobs) {
        for (const step of job.steps ?? []) {
          expect(step.run ?? "").not.toMatch(/\$\{\{\s*(inputs|secrets|github\.event)\b/);
        }
      }
    });

    it("checks the server's host key whenever it uses SSH, and never learns it on first use", () => {
      const scripts = jobs.flatMap(([, job]) => (job.steps ?? []).map((step) => step.run ?? "")).join("\n");
      if (/\bssh -/.test(scripts)) expect(scripts).toContain("-o StrictHostKeyChecking=yes");
      expect(scripts).not.toMatch(/StrictHostKeyChecking=(no|accept-new)/);
      expect(scripts).not.toContain("ssh-keyscan");
    });
  });

  it("default to the CLI version of @softure-ai/deploy", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "tools/deploy/package.json"), "utf8")) as { version: string };
    for (const name of ["deploy-app.yml", "deploy-report.yml", "deploy-integration.yml"]) {
      const inputs = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, name))).inputs ?? {};
      expect(inputs["deploy-cli-version"]?.default, name).toBe(pkg.version);
    }
  });
});

describe("the deploy action (issue #468)", () => {
  const action = readAction();
  const steps = action.runs.steps;
  const scripts = steps.map((step) => step.run ?? "").join("\n");

  it("is a composite action whose script steps all run in bash", () => {
    expect(action.runs.using).toBe("composite");
    for (const step of steps.filter((candidate) => candidate.run !== undefined)) expect(step.shell, step.name).toBe("bash");
  });

  it("never interpolates an input, a step output or event data into a script, and reads no secrets context", () => {
    for (const step of steps) expect(step.run ?? "", step.name).not.toMatch(/\$\{\{/);
    expect(readFileSync(ACTION_FILE, "utf8")).not.toMatch(/\$\{\{[^}]*(?<![\w.-])secrets\b(?!-)/);
  });

  it("checks the server's host key and never learns it on first use", () => {
    expect(scripts).toContain("-o StrictHostKeyChecking=yes");
    expect(scripts).not.toMatch(/StrictHostKeyChecking=(no|accept-new)/);
    expect(scripts).not.toContain("ssh-keyscan");
  });

  it("reads the release first and every value of the app from it, never an input of its own for those", () => {
    expect(steps[0]?.id).toBe("release");
    expect(steps[0]?.env).toEqual({
      RELEASE: "${{ inputs.release }}",
      ENVIRONMENT_INPUT: "${{ inputs.environment }}",
      APP_URL_INPUT: "${{ inputs.app-url }}",
      PREFLIGHT: "${{ inputs.preflight }}",
      SEND: "${{ inputs.send }}",
      VERIFY: "${{ inputs.verify }}",
      REPORT: "${{ inputs.report }}",
    });
    expect(action.inputs.release?.required).toBe(true);
  });

  it("checks out only the server files the check job anchored, at the tag, into its own folder, without credentials", () => {
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@") === true);
    expect(checkout?.if).toBe("inputs.send == 'true' || inputs.preflight == 'true'");
    expect(checkout?.with).toEqual({
      ref: "${{ steps.release.outputs.tag }}",
      path: ".softure-ai-release",
      "persist-credentials": false,
      "sparse-checkout": "${{ steps.release.outputs.server-files }}",
      "sparse-checkout-cone-mode": false,
    });
  });

  it("packs the release before it sends it, and sends the archive in the one SSH call", () => {
    const packIndex = steps.findIndex((step) => step.name === "Pack the release");
    const sendIndex = steps.findIndex((step) => step.name === "Send the release to the server");
    expect(packIndex).toBeGreaterThan(0);
    expect(sendIndex).toBeGreaterThan(packIndex);
    const send = steps[sendIndex]?.run ?? "";
    expect(send.match(/\bssh\b -i/g)).toHaveLength(1);
    expect(send).toMatch(/"\$REMOTE_COMMAND \$TAG" < release\.tar\.gz \| tee "\$output"$/m);
    expect(send).toContain("grep -qx 'result|ok' \"$output\"");
    for (const name of ["Render .env.prod", "Pack the release", "Send the release to the server"]) {
      expect(steps.find((step) => step.name === name)?.["working-directory"], name).toBe(".softure-ai-release");
    }
  });

  it("passes the registry token only when the release says so", () => {
    const pack = steps.find((step) => step.name === "Pack the release");
    expect(pack?.env?.REGISTRY_TOKEN).toBe("${{ steps.release.outputs.registry-token == 'true' && github.token || '' }}");
  });

  it("renders app-secrets and app-vars from its inputs and compares the release's build-args", () => {
    const render = steps.find((step) => step.name === "Render .env.prod");
    expect(render?.env).toMatchObject({
      APP_SECRETS: "${{ inputs.app-secrets }}",
      SECRETS_FROM_ENVIRONMENT: "${{ inputs.secrets-context }}",
      APP_VARS: "${{ inputs.app-vars }}",
      BUILD_ARGS: "${{ steps.release.outputs.build-args }}",
    });
    expect(action.inputs["secrets-context"]?.default).toBe("true");
  });

  it("keeps the server's step and result lines after the send, whatever happened, as its output", () => {
    const sendIndex = steps.findIndex((step) => step.name === "Send the release to the server");
    const keep = steps.find((step) => step.name === "Keep the server's step lines");
    expect(steps.indexOf(keep as Step)).toBeGreaterThan(sendIndex);
    expect(keep?.if).toBe("always() && inputs.send == 'true'");
    expect(keep?.run).toContain("grep -E '^(step|result)\\|' \"$RUNNER_TEMP/deploy-output.txt\"");
    expect(action.outputs["server-lines"]?.value).toBe("${{ steps.server-lines.outputs.lines }}");
  });

  it("waits for the health route, then verifies the routes with the config file checked out alone", () => {
    const waitIndex = steps.findIndex((step) => step.name === "Wait for the health route");
    const verifyIndex = steps.findIndex((step) => step.name === "Verify the routes in deploy.json");
    expect(steps[waitIndex]?.if).toBe("inputs.verify == 'true'");
    expect(verifyIndex).toBeGreaterThan(waitIndex);
    const configCheckout = steps.slice(waitIndex).find((step) => step.uses?.startsWith("actions/checkout@") === true);
    expect(configCheckout?.with).toEqual({
      ref: "${{ steps.release.outputs.tag }}",
      path: ".softure-ai-release",
      "persist-credentials": false,
      "sparse-checkout": "/${{ steps.release.outputs.deploy-config }}",
      "sparse-checkout-cone-mode": false,
    });
    expect(steps[verifyIndex]?.if).toBe("inputs.verify == 'true' && steps.release.outputs.deploy-config != ''");
  });

  it("runs softure-deploy verify from the pinned CLI, or the tag's on the test path, adding --origin only when set", () => {
    const verify = steps.find((step) => step.name === "Verify the routes in deploy.json");
    expect(verify?.run).toContain('softure-deploy verify "$APP_URL" --config="$DEPLOY_CONFIG"');
    expect(verify?.run).toContain("--package=@softure-ai/deploy@$DEPLOY_CLI_VERSION");
    expect(verify?.env).toMatchObject({ ORIGIN_ADDRESS: "${{ inputs.origin-address }}", DEPLOY_CLI: "${{ inputs.deploy-cli }}" });
    const binDir = mkdtempSync(join(tmpdir(), "deploy-verify-"));
    try {
      // Stand-ins print the arguments they would have run the CLI with, one per line.
      writeFileSync(join(binDir, "npx"), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
      writeFileSync(join(binDir, "node"), '#!/bin/sh\nprintf "node:%s\\n" "$@"\n', { mode: 0o755 });
      const run = (env: Record<string, string>) =>
        spawnSync("bash", ["-e", "-c", verify?.run ?? ""], {
          encoding: "utf8",
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            APP_URL: "https://example.com",
            DEPLOY_CONFIG: "deploy.json",
            DEPLOY_CLI_VERSION: "0.1.3",
            ORIGIN_ADDRESS: "",
            DEPLOY_CLI: "",
            ...env,
          },
        });
      const base = ["--yes", "--package=@softure-ai/deploy@0.1.3", "softure-deploy", "verify", "https://example.com", "--config=deploy.json"];
      expect(run({}).stdout.split("\n")).toEqual([...base, ""]);
      expect(run({ ORIGIN_ADDRESS: "203.0.113.7" }).stdout.split("\n")).toEqual([...base, "--origin=203.0.113.7", ""]);
      const malformed = run({ ORIGIN_ADDRESS: "https://203.0.113.7/" });
      expect(malformed.status).toBe(1);
      expect(malformed.stdout).toBe("::error::Input origin-address is not valid: an IP address or host with an optional :port\n");
      expect(run({ DEPLOY_CLI: "/cli/main.js" }).stdout.split("\n")).toEqual([
        "node:/cli/main.js",
        "node:verify",
        "node:https://example.com",
        "node:--config=deploy.json",
        "",
      ]);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("writes the same deploy-report.json as deploy-app.yml's summary job, and uploads it as deploy-report", () => {
    const report = steps.find((step) => step.name === "Write deploy-report.json");
    const summary = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml")).jobs.summary?.steps?.[0];
    expect(report?.if).toBe("always() && inputs.report == 'true'");
    expect(report?.run).toBe(summary?.run);
    expect(report?.env?.DEPLOY_RESULT).toBe("${{ inputs.send != 'true' && 'skipped' || steps.send.outcome == 'success' && 'success' || 'failure' }}");
    const upload = steps[steps.indexOf(report as Step) + 1];
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@/);
    expect(upload?.with).toMatchObject({ name: "deploy-report", overwrite: true });
  });

  it("removes the key, .env.prod and the archive, whatever happened", () => {
    const cleanup = steps.at(-1);
    expect(cleanup?.if).toBe("always()");
    expect(cleanup?.run).toContain(".softure-ai-release/release.tar.gz");
    expect(cleanup?.run).toContain(".softure-ai-release/.env.prod");
    expect(cleanup?.run).toContain('"$RUNNER_TEMP/deploy_key"');
  });

  describe("the release step", () => {
    const script = steps[0]?.run ?? "";
    const RELEASE = {
      tag: "v1",
      "app-url": "https://example.com",
      image: "ghcr.io/acme/app",
      environment: "production",
      "compose-file": "docker/prod/docker-compose.yml",
      "server-script": "docker/server/deploy.sh",
      "deploy-config": "deploy.json",
      "remote-command": "deploy",
      "ssh-port": "22",
      "health-path": "/api/health",
      "verify-timeout-seconds": "300",
      "deploy-cli-version": "0.3.0",
      "node-version": "22",
      "build-args": "A=1\nB=2",
      "secret-min-lengths": "",
      "registry-token": "true",
      "server-files": "/docker/prod/\n/docker/server/deploy.sh\n/deploy.json\n",
    };

    function readRelease(env: Record<string, string>): { status: number | null; stdout: string; outputs: Record<string, string> } {
      const outputDir = mkdtempSync(join(tmpdir(), "deploy-release-"));
      try {
        const output = join(outputDir, "output");
        writeFileSync(output, "");
        const result = spawnSync("bash", ["-e", "-c", script], {
          encoding: "utf8",
          env: { PATH: process.env.PATH ?? "", GITHUB_OUTPUT: output, ENVIRONMENT_INPUT: "", APP_URL_INPUT: "", ...env },
        });
        const outputs: Record<string, string> = {};
        const text = readFileSync(output, "utf8");
        for (const match of text.matchAll(/^([a-z-]+)<<(\S+)\n([\s\S]*?)\n\2$/gm)) outputs[match[1] ?? ""] = match[3] ?? "";
        for (const match of text.matchAll(/^([a-z-]+)=(.*)$/gm)) outputs[match[1] ?? ""] = match[2] ?? "";
        return { status: result.status, stdout: result.stdout, outputs };
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    }

    it("writes every value as an output, multi-line ones whole", () => {
      const result = readRelease({ RELEASE: JSON.stringify(RELEASE) });
      expect(result.status, result.stdout).toBe(0);
      expect(result.outputs).toMatchObject({ ...RELEASE, "report-environment": "production" });
    });

    it("takes another environment's app-url and name from its inputs", () => {
      const result = readRelease({ RELEASE: JSON.stringify(RELEASE), APP_URL_INPUT: "https://dev.example.com", ENVIRONMENT_INPUT: "dev" });
      expect(result.status, result.stdout).toBe(0);
      expect(result.outputs).toMatchObject({ "app-url": "https://dev.example.com", "report-environment": "dev" });
      const bad = readRelease({ RELEASE: JSON.stringify(RELEASE), APP_URL_INPUT: "https://dev.example.com/path" });
      expect(bad.status).toBe(1);
      expect(bad.stdout).toBe("::error::Input app-url is not valid: https://<host>[:port] with no path\n");
    });

    it("refuses anything but deploy-app.yml's release output, naming what is missing", () => {
      expect(readRelease({ RELEASE: "" }).stdout).toBe("::error::release is not deploy-app.yml's release output (a JSON object).\n");
      const partial: Record<string, string> = { ...RELEASE };
      delete partial.tag;
      delete partial["server-files"];
      const result = readRelease({ RELEASE: JSON.stringify(partial) });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("::error::release has no text tag server-files; pass deploy-app.yml's release output unchanged.\n");
    });
  });
});

describe("the deploy and verify jobs of deploy-app.yml run the deploy action of the workflow's own commit", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const SELF_CHECKOUT = {
    repository: "${{ job.workflow_repository }}",
    ref: "${{ job.workflow_sha }}",
    path: ".softure-ai-deploy",
    "persist-credentials": false,
    "sparse-checkout": "/.github/actions/deploy/",
    "sparse-checkout-cone-mode": false,
  };

  it("checks out the action at job.workflow_sha after every root checkout and before the action runs", () => {
    for (const id of ["deploy", "verify"]) {
      const steps = workflow.jobs[id]?.steps ?? [];
      const self = steps.findIndex((step) => step.with?.path === ".softure-ai-deploy");
      expect(steps[self]?.with, id).toEqual(SELF_CHECKOUT);
      const rootCheckouts = steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => step.uses?.startsWith("actions/checkout@") === true && step.with?.path === undefined);
      // A checkout at the workspace root deletes .softure-ai-deploy, so none may follow the self-checkout.
      for (const { index } of rootCheckouts) expect(index, id).toBeLessThan(self);
      const firstActionCall = steps.findIndex((step) => step.uses === "./.softure-ai-deploy/.github/actions/deploy");
      expect(firstActionCall, id).toBeGreaterThan(self);
    }
  });

  it("ships init's server script by default", () => {
    expect(inputs["server-script"]?.default).toBe("docker/server/deploy.sh");
  });

  it("sends from the deploy job, which may read packages for the registry token, and keeps the server lines", () => {
    const deployJob = workflow.jobs.deploy as Job & { outputs?: Record<string, string>; if?: string };
    expect(deployJob.permissions).toEqual({ contents: "read", packages: "read" });
    expect(deployJob.if).toBe("inputs.deploy");
    expect(deployJob.outputs).toEqual({ "server-lines": "${{ steps.send.outputs.server-lines }}" });
    const send = deployJob.steps?.find((step) => step.id === "send");
    expect(send?.uses).toBe("./.softure-ai-deploy/.github/actions/deploy");
    expect(send?.with).toMatchObject({
      release: "${{ needs.check.outputs.release }}",
      send: true,
      verify: false,
      report: false,
      "app-vars": "${{ inputs.app-vars }}",
    });
    expect(inputs["registry-token"]).toMatchObject({ type: "boolean", default: true });
    expect(inputs["app-vars"]).toMatchObject({ type: "string", default: "{}" });
  });

  it("verifies from the verify job, after the deploy, with only the origin address and verify-env", () => {
    const verifyJob = workflow.jobs.verify as Job & { needs?: unknown; if?: string };
    expect(verifyJob.needs).toEqual(["check", "deploy"]);
    expect(verifyJob.permissions).toEqual({ contents: "read" });
    expect(verifyJob.steps?.[1]?.with).toEqual({
      release: "${{ needs.check.outputs.release }}",
      send: false,
      verify: true,
      report: false,
      "origin-address": "${{ inputs.origin-address-var != '' && fromJSON(inputs.app-vars)[inputs.origin-address-var] || secrets.origin-address }}",
      "verify-env": "${{ secrets.verify-env }}",
    });
    expect(inputs["deploy-config"]?.default).toBe("deploy.json");
  });
});

describe("the summary job of deploy-app.yml (DF-10)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const summary = workflow.jobs.summary as Job & { needs?: unknown; if?: string };

  it("runs after every job whatever their results, with no permissions, unless deploy is off", () => {
    expect(summary.needs).toEqual(["check", "build", "deploy", "verify"]);
    expect(summary.if).toBe("${{ always() && inputs.deploy }}");
    expect(summary.permissions).toEqual({});
  });

  it("writes a summary release-report reads, and uploads it as deploy-report, replacing an earlier attempt's", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-summary-"));
    try {
      const result = spawnSync("bash", ["-e", "-c", summary.steps?.[0]?.run ?? ""], {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          RUNNER_TEMP: outputDir,
          TAG: "v1",
          DEPLOY_ENVIRONMENT: "production",
          IMAGE: "ghcr.io/acme/app:v1",
          DIGEST: "sha256:abc",
          RUN_URL: "https://github.com/acme/app/actions/runs/1/attempts/2",
          CHECK_RESULT: "success",
          BUILD_RESULT: "success",
          DEPLOY_RESULT: "failure",
          VERIFY_RESULT: "skipped",
          SERVER_LINES: "step|backup|ok|db-1.dump\nresult|failed|switch|the stack did not become healthy\n",
        },
      });
      expect(result.status, result.stderr).toBe(0);
      const json = JSON.parse(readFileSync(join(outputDir, "deploy-report/deploy-report.json"), "utf8")) as Record<string, unknown>;
      expect(json).toMatchObject({
        version: 1,
        tag: "v1",
        jobs: [
          { name: "check", result: "success" },
          { name: "build", result: "success" },
          { name: "deploy", result: "failure" },
          { name: "verify", result: "skipped" },
        ],
        serverLines: ["step|backup|ok|db-1.dump", "result|failed|switch|the stack did not become healthy"],
      });
      expect(json.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
    const upload = summary.steps?.[1];
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@/);
    expect(upload?.with).toMatchObject({ name: "deploy-report", overwrite: true });
  });
});

describe("the release guards of deploy-app.yml (DF-11)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const checkSteps = workflow.jobs.check?.steps ?? [];
  const guardIndex = checkSteps.findIndex((step) => step.name === "Refuse a tag off the release branch");
  const build = (workflow.jobs.build?.steps ?? []).find((step) => step.uses?.startsWith("docker/build-push-action@") === true);

  it("refuses a stray tag in the check job, after the inputs and before anything is built", () => {
    expect(checkSteps[0]?.name).toBe("Validate inputs");
    expect(guardIndex).toBe(2);
    expect(workflow.jobs.check?.permissions).toEqual({ contents: "read" });
    expect(inputs["release-branch"]).toMatchObject({ type: "string", default: "" });
    expect(checkSteps[guardIndex]?.env).toMatchObject({
      TAG: "${{ inputs.tag }}",
      RELEASE_BRANCH: "${{ inputs.release-branch }}",
      DEFAULT_BRANCH: "${{ github.event.repository.default_branch }}",
    });
  });

  it("fetches every branch and tag as commits only, without credentials", () => {
    expect(checkSteps[1]?.with).toEqual({
      ref: "${{ inputs.tag }}",
      "persist-credentials": false,
      "fetch-depth": 0,
      filter: "tree:0",
      "sparse-checkout": "/${{ inputs.compose-file }}",
      "sparse-checkout-cone-mode": false,
    });
  });

  it("passes build-args to the image build", () => {
    expect(inputs["build-args"]).toMatchObject({ type: "string", default: "" });
    expect(build?.with?.["build-args"]).toBe("${{ inputs.build-args }}");
  });
});

describe("the example caller workflow (issue #486)", () => {
  const caller = readYaml(EXAMPLE_CALLER);
  const action = readAction();
  const build = caller.jobs.build as Job;
  const deployJob = caller.jobs.deploy as Job & { environment?: string; needs?: unknown };
  const reportJob = caller.jobs.report as Job & { needs?: unknown; if?: string };
  const step = deployJob.steps?.[0] as (Step & { env?: Record<string, string> }) | undefined;
  const calledDeploy = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-app.yml")));
  const calledReport = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-report.yml")));

  it("builds through deploy-app.yml, deploys with the action, then reports, each at master", () => {
    expect(Object.keys(caller.jobs)).toEqual(["build", "deploy", "report"]);
    expect(build.uses).toBe(`${CALLER_PREFIX}deploy-app.yml@master`);
    expect(step?.uses).toBe("SOFTURE/AI/.github/actions/deploy@master");
    expect(reportJob.uses).toBe(`${CALLER_PREFIX}deploy-report.yml@master`);
  });

  it("grants packages: write to the build, read to the deploy job, contents: write to the report job only", () => {
    expect(caller.permissions).toEqual({ contents: "read", packages: "write" });
    expect(build.permissions).toBeUndefined();
    expect(deployJob.permissions).toEqual({ contents: "read", packages: "read" });
    expect(reportJob.permissions).toEqual({ contents: "write" });
  });

  it("builds with deploy off, only declared inputs, every required one, and no secrets", () => {
    expect(build.with?.deploy).toBe(false);
    expect(build.secrets).toBeUndefined();
    const passed = Object.keys(build.with ?? {});
    for (const key of passed) expect(Object.keys(calledDeploy.inputs ?? {})).toContain(key);
    for (const [key, input] of Object.entries(calledDeploy.inputs ?? {})) if (input.required === true) expect(passed).toContain(key);
  });

  it("deploys from the production environment, the app's secrets by name", () => {
    expect(deployJob.environment).toBe("production");
    expect(deployJob.needs).toBe("build");
    expect(step?.with).toMatchObject({
      release: "${{ needs.build.outputs.release }}",
      image: "${{ needs.build.outputs.image }}",
      digest: "${{ needs.build.outputs.digest }}",
      "ssh-private-key": "${{ secrets.DEPLOY_SSH_KEY }}",
      "app-vars": "${{ toJSON(vars) }}",
    });
    expect(step?.with?.["app-secrets"]).toBeUndefined();
    const env = step?.env ?? {};
    expect(Object.keys(env).length).toBeGreaterThan(0);
    for (const [name, value] of Object.entries(env)) expect(value).toBe(`\${{ secrets.${name} }}`);
    expect(String(step?.with?.["secret-names"]).split(/\s+/).sort()).toEqual(Object.keys(env).sort());
    for (const key of Object.keys(step?.with ?? {})) expect(Object.keys(action.inputs)).toContain(key);
  });

  it("reports after the deploy whatever its result, once the build succeeded, on the same tag", () => {
    expect(reportJob.needs).toEqual(["build", "deploy"]);
    expect(reportJob.if).toBe("${{ always() && needs.build.result == 'success' }}");
    expect(reportJob.with?.tag).toBe(build.with?.tag);
    for (const key of Object.keys(reportJob.with ?? {})) expect(Object.keys(calledReport.inputs ?? {})).toContain(key);
    expect(reportJob.secrets).toBeUndefined();
  });
});

describe("deploy-report.yml (DF-10)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-report.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const job = workflow.jobs.report as Job & { "continue-on-error"?: string; concurrency?: { group?: string; "cancel-in-progress"?: boolean } };
  const steps = job.steps ?? [];
  const validate = steps[0]?.run ?? "";

  function runValidate(env: Record<string, string>): { status: number | null; stdout: string } {
    const result = spawnSync("bash", ["-e", "-c", validate], {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", TAG: "v1.2.3", LOCALE: "en", DEPLOY_CLI_VERSION: "0.1.3", E2E: "false", REPOSITORY: "acme/app", ...env },
    });
    return { status: result.status, stdout: result.stdout };
  }

  it("has one job, which never turns a production run red and edits one release at a time", () => {
    expect(Object.keys(workflow.jobs)).toEqual(["report"]);
    expect(job["continue-on-error"]).toBe("${{ !inputs.e2e }}");
    expect(job.concurrency).toEqual({
      group: "deploy-report-${{ github.repository }}-${{ inputs.tag }}${{ inputs.e2e && format('-e2e-{0}', github.run_id) || '' }}",
      "cancel-in-progress": false,
    });
  });

  it("validates its inputs first and refuses e2e outside SOFTURE/AI", () => {
    expect(runValidate({}).status).toBe(0);
    expect(runValidate({ TAG: "v1;rm" }).stdout).toContain("Input tag is not valid");
    expect(runValidate({ LOCALE: "de" }).stdout).toContain("Input locale is not valid");
    expect(runValidate({ DEPLOY_CLI_VERSION: "latest" }).stdout).toContain("Input deploy-cli-version is not valid");
    const refused = runValidate({ E2E: "true" });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain("Input e2e is not valid: false outside SOFTURE/AI");
    expect(runValidate({ E2E: "true", REPOSITORY: "SOFTURE/AI" }).status).toBe(0);
    expect(inputs.e2e).toMatchObject({ type: "boolean", default: false });
  });

  it("reads the summary deploy-app.yml uploaded in the same run", () => {
    const download = steps.find((step) => step.uses?.startsWith("actions/download-artifact@") === true);
    expect(download?.with?.name).toBe("deploy-report");
    const write = steps.find((step) => step.name === "Write the report");
    expect(write?.run).toContain('"--summary=$RUNNER_TEMP/deploy-report/deploy-report.json"');
    expect(write?.run).toContain("--package=@softure-ai/deploy@$DEPLOY_CLI_VERSION");
  });

  it("edits the release only off the test path, and the token reaches the two gh steps only", () => {
    const update = steps.find((step) => step.name === "Update the release");
    expect(update?.if).toBe("steps.body.outputs.found == 'true' && !inputs.e2e");
    expect(update?.run).toContain('gh release edit "$TAG" --repo "$GITHUB_REPOSITORY"');
    const withToken = steps.filter((step) => step.env?.GH_TOKEN !== undefined).map((step) => step.name);
    expect(withToken).toEqual(["Read the release body", "Update the release"]);
  });

  it("runs every test-only step under inputs.e2e", () => {
    const testOnly = steps.filter((step) =>
      /\.softure-ai-cli|upload-artifact/.test(`${step.uses ?? ""} ${step["working-directory"] ?? ""} ${JSON.stringify(step.with ?? {})}`),
    );
    expect(testOnly).toHaveLength(3);
    for (const step of testOnly) expect(step.if ?? "", step.name ?? step.uses).toMatch(/\binputs\.e2e\b/);
  });
});

describe("the end-to-end test path of deploy-app.yml (DF-3)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const checkScript = workflow.jobs.check?.steps?.[0]?.run ?? "";
  const buildSteps = workflow.jobs.build?.steps ?? [];
  const deploySteps = workflow.jobs.deploy?.steps ?? [];

  function runCheck(env: Record<string, string>): { status: number | null; stdout: string } {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-check-"));
    try {
      const result = spawnSync("bash", ["-e", "-c", checkScript], {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          GITHUB_OUTPUT: join(outputDir, "output"),
          TAG: "v1.2.3",
          APP_URL: "https://example.com",
          IMAGE: "",
          BUILD_CONTEXT: ".",
          DOCKERFILE: "Dockerfile",
          COMPOSE_FILE: "docker/prod/docker-compose.yml",
          SERVER_SCRIPT: "docker/server/deploy.sh",
          DEPLOY_ENVIRONMENT: "",
          REMOTE_COMMAND: "deploy",
          SSH_PORT: "22",
          HEALTH_PATH: "/api/health",
          VERIFY_TIMEOUT: "300",
          DEPLOY_CONFIG: "deploy.json",
          DEPLOY_CLI_VERSION: "0.1.3",
          PASSED_SECRETS: "ssh-host ssh-user ssh-private-key ssh-known-hosts app-secrets",
          ...env,
        },
      });
      return { status: result.status, stdout: result.stdout };
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }

  it("checks the origin address and refuses it when deploy-config is empty (DF-13)", () => {
    expect(workflow.jobs.check?.steps?.[0]?.env).toMatchObject({ ORIGIN_ADDRESS: "${{ secrets.origin-address }}" });
    for (const address of ["203.0.113.7", "203.0.113.7:8443", "origin.example.com", "[2001:db8::7]:443", "2001:db8::7"]) {
      expect(runCheck({ REPOSITORY: "acme/app", ORIGIN_ADDRESS: address }).status, address).toBe(0);
    }
    const malformed = runCheck({ REPOSITORY: "acme/app", ORIGIN_ADDRESS: "https://203.0.113.7/" });
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toContain("::error::Input origin-address is not valid: an IP address or host with an optional :port");
    const unchecked = runCheck({ REPOSITORY: "acme/app", ORIGIN_ADDRESS: "203.0.113.7", DEPLOY_CONFIG: "" });
    expect(unchecked.status).toBe(1);
    expect(unchecked.stdout).toContain("::error::Input origin-address is not valid: empty when deploy-config is empty");
  });

  it("is off unless the caller turns it on", () => {
    expect(inputs.e2e).toMatchObject({ type: "boolean", default: false });
  });

  it("is refused outside SOFTURE/AI by the check job, before anything is built", () => {
    const refused = runCheck({ E2E: "true", REPOSITORY: "acme/app" });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain("::error::Input e2e is not valid: false outside SOFTURE/AI");
    expect(runCheck({ E2E: "true", REPOSITORY: "SOFTURE/AI" }).status).toBe(0);
    expect(runCheck({ E2E: "false", REPOSITORY: "acme/app" }).status).toBe(0);
    expect(workflow.jobs.check?.steps?.[0]?.env).toMatchObject({ E2E: "${{ inputs.e2e }}", REPOSITORY: "${{ github.repository }}" });
  });

  it("builds the image without logging in to GHCR or pushing it", () => {
    const login = buildSteps.find((step) => step.uses?.startsWith("docker/login-action@") === true);
    const push = buildSteps.find((step) => step.uses?.startsWith("docker/build-push-action@") === true);
    expect(login?.if).toBe("${{ !inputs.e2e }}");
    expect(push?.with?.push).toBe("${{ !inputs.e2e }}");
  });

  it("hands the image to the deploy job as an artifact only under inputs.e2e", () => {
    const push = buildSteps.find((step) => step.uses?.startsWith("docker/build-push-action@") === true);
    expect(push?.with?.outputs).toBe("${{ inputs.e2e && format('type=docker,dest={0}/deploy-e2e-image.tar', runner.temp) || '' }}");
    const upload = buildSteps.find((step) => step.uses?.startsWith("actions/upload-artifact@") === true);
    expect(upload?.if).toBe("inputs.e2e");
    expect(upload?.with).toMatchObject({ name: "deploy-e2e-image", path: "${{ runner.temp }}/deploy-e2e-image.tar" });
    const download = deploySteps.find((step) => step.uses?.startsWith("actions/download-artifact@") === true);
    expect(download?.if).toBe("inputs.e2e");
    expect(download?.with?.name).toBe("deploy-e2e-image");
  });

  it("runs every test-only step of the deploy job under inputs.e2e", () => {
    const testOnly = deploySteps.filter((step) =>
      /\.softure-ai-cli|e2e-server|e2e-image|-artifact@|end-to-end test/.test(
        `${step.name ?? ""} ${step.uses ?? ""} ${step.run ?? ""} ${step["working-directory"] ?? ""} ${JSON.stringify(step.with ?? {})}`,
      ),
    );
    expect(testOnly.map((step) => step.name ?? step.uses)).toEqual([
      "actions/checkout@v7",
      "Build the deploy CLI from the tag (end-to-end test)",
      "actions/download-artifact@v8",
      "Set up this runner as the server (end-to-end test)",
      "./.softure-ai-deploy/.github/actions/deploy",
      "actions/upload-artifact@v7",
      "./.softure-ai-deploy/.github/actions/deploy",
      "Show the server's log and the stack (end-to-end test)",
      "Remove the end-to-end server and image",
    ]);
    // The send runs for every caller; the test path only points it at its own server and CLI.
    const testPathOnly = testOnly.filter((step) => step.id !== "send");
    for (const step of testPathOnly) expect(step.if ?? "", step.name ?? step.uses).toMatch(/\binputs\.e2e\b/);
  });

  it("sends with the production ssh command, taking the throwaway server's address and keys only under inputs.e2e", () => {
    const send = deploySteps.find((step) => step.id === "send");
    expect(send?.if).toBeUndefined();
    expect(send?.with).toMatchObject({
      "ssh-host": "${{ inputs.e2e && steps.e2e-server.outputs.host || secrets.ssh-host }}",
      "ssh-user": "${{ inputs.e2e && steps.e2e-server.outputs.user || secrets.ssh-user }}",
      "ssh-private-key": "${{ inputs.e2e && steps.e2e-server.outputs.private-key || secrets.ssh-private-key }}",
      "ssh-known-hosts": "${{ inputs.e2e && steps.e2e-server.outputs.known-hosts || secrets.ssh-known-hosts }}",
    });
  });

  it("renders .env.prod with the tag's CLI only under inputs.e2e", () => {
    const send = deploySteps.find((step) => step.id === "send");
    expect(send?.with?.["deploy-cli"]).toBe(
      "${{ inputs.e2e && format('{0}/.softure-ai-cli/tools/deploy/dist/cli/main.js', github.workspace) || '' }}",
    );
    const render = readAction().runs.steps.find((step) => step.name === "Render .env.prod");
    expect(render?.env?.DEPLOY_CLI).toBe("${{ inputs.deploy-cli }}");
    expect(render?.run).toContain("--package=@softure-ai/deploy@${process.env.DEPLOY_CLI_VERSION}");
  });

  it("runs the verify job's wait in the deploy job, and verify with the tag's CLI trusting the run's CA", () => {
    const calls = deploySteps.filter((step) => step.uses === "./.softure-ai-deploy/.github/actions/deploy");
    expect(calls).toHaveLength(2);
    const e2eVerify = calls[1];
    expect(e2eVerify?.if).toBe("inputs.e2e");
    expect(e2eVerify?.with).toEqual({
      release: "${{ needs.check.outputs.release }}",
      send: false,
      verify: true,
      report: false,
      "deploy-cli": "${{ format('{0}/.softure-ai-cli/tools/deploy/dist/cli/main.js', github.workspace) }}",
      "ca-file": "${{ steps.e2e-server.outputs.ca-file }}",
    });
    const verify = readAction().runs.steps.find((step) => step.name === "Verify the routes in deploy.json");
    expect(verify?.env).toMatchObject({ NODE_EXTRA_CA_CERTS: "${{ inputs.ca-file }}" });
  });

  it("gives each test run its own deploy concurrency group and skips verify", () => {
    const deployJob = workflow.jobs.deploy as Job & { concurrency?: { group?: string } };
    expect(deployJob.concurrency?.group).toBe(
      "deploy-app-${{ github.repository }}-${{ inputs.environment }}${{ inputs.e2e && format('-e2e-{0}', github.run_id) || '' }}",
    );
    expect((workflow.jobs.verify as Job & { if?: string }).if).toBe("${{ inputs.deploy && !inputs.e2e }}");
  });
});

describe("deploy: false and the release output of deploy-app.yml (issue #468)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const call = getWorkflowCall(workflow) as WorkflowCall & { outputs?: Record<string, { value?: string }> };
  const checkStep = workflow.jobs.check?.steps?.[0];

  function check(env: Record<string, string>): { status: number | null; stdout: string; output: string } {
    const outputDir = mkdtempSync(join(tmpdir(), "deploy-check-release-"));
    try {
      const output = join(outputDir, "output");
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-e", "-c", checkStep?.run ?? ""], {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          GITHUB_OUTPUT: output,
          TAG: "v1.2.3",
          APP_URL: "https://example.com",
          IMAGE: "",
          BUILD_CONTEXT: ".",
          DOCKERFILE: "Dockerfile",
          COMPOSE_FILE: "docker/prod/docker-compose.yml",
          SERVER_SCRIPT: "docker/server/deploy.sh",
          DEPLOY_ENVIRONMENT: "production",
          REMOTE_COMMAND: "deploy",
          SSH_PORT: "22",
          HEALTH_PATH: "/api/health",
          VERIFY_TIMEOUT: "300",
          DEPLOY_CONFIG: "deploy.json",
          DEPLOY_CLI_VERSION: "0.3.0",
          NODE_VERSION: "22",
          BUILD_ARGS: "APP_ORIGIN=https://example.com",
          SECRET_MIN_LENGTHS: "",
          REGISTRY_TOKEN: "true",
          REPOSITORY: "acme/app",
          E2E: "false",
          APP_VARS: "{}",
          DEPLOY: "false",
          PASSED_SECRETS: "",
          ...env,
        },
      });
      return { status: result.status, stdout: result.stdout, output: readFileSync(output, "utf8") };
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }

  it("is on by default, and the workflow hands the check job's release on as its own output", () => {
    expect(call.inputs?.deploy).toMatchObject({ type: "boolean", default: true });
    expect(call.outputs?.release?.value).toBe("${{ jobs.check.outputs.release }}");
    expect(checkStep?.env).toMatchObject({ DEPLOY: "${{ inputs.deploy }}" });
  });

  it("takes no secret with deploy off and writes the checked values as one line of JSON", () => {
    const result = check({});
    expect(result.status, result.stdout).toBe(0);
    const line = result.output.split("\n").find((entry) => entry.startsWith("release="));
    expect(JSON.parse((line ?? "release=null").slice("release=".length))).toEqual({
      tag: "v1.2.3",
      "app-url": "https://example.com",
      image: "ghcr.io/acme/app",
      environment: "production",
      "compose-file": "docker/prod/docker-compose.yml",
      "server-script": "docker/server/deploy.sh",
      "deploy-config": "deploy.json",
      "remote-command": "deploy",
      "ssh-port": "22",
      "health-path": "/api/health",
      "verify-timeout-seconds": "300",
      "deploy-cli-version": "0.3.0",
      "node-version": "22",
      "build-args": "APP_ORIGIN=https://example.com",
      "secret-min-lengths": "",
      "registry-token": "true",
      "server-files": "/docker/prod/\n/docker/server/deploy.sh\n/deploy.json\n",
    });
  });

  it("refuses with deploy off whatever belongs to the deploy action, naming it", () => {
    const refused = check({
      PASSED_SECRETS: "ssh-host app-secrets",
      ORIGIN_ADDRESS: "203.0.113.7",
      ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP",
    });
    expect(refused.status).toBe(1);
    for (const reason of [
      "true when the secret ssh-host is passed (the caller's job passes it to the deploy action)",
      "true when the secret app-secrets is passed (the caller's job passes it to the deploy action)",
      "true when the secret origin-address is passed (the deploy action takes it)",
      "true with origin-address-var (the deploy action takes origin-address)",
    ]) {
      expect(refused.stdout).toContain(`::error::Input deploy is not valid: ${reason}`);
    }
  });

  it("still asks for the named secrets with deploy on", () => {
    const missing = check({ DEPLOY: "true" });
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain("::error::Secret ssh-host is required");
  });
});

describe("build: false and the sha output of deploy-app.yml (issue #628)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const call = getWorkflowCall(workflow) as WorkflowCall & { outputs?: Record<string, { value?: string }> };
  const jobs = workflow.jobs as Record<string, Job & { if?: string; outputs?: Record<string, string> }>;
  const checkStep = jobs.check?.steps?.[0];
  const ENV: Record<string, string> = {
    TAG: "v1.2.3",
    APP_URL: "https://example.com",
    IMAGE: "",
    BUILD_CONTEXT: ".",
    DOCKERFILE: "Dockerfile",
    COMPOSE_FILE: "docker/prod/docker-compose.yml",
    SERVER_SCRIPT: "docker/server/deploy.sh",
    DEPLOY_ENVIRONMENT: "production",
    REMOTE_COMMAND: "deploy",
    SSH_PORT: "22",
    HEALTH_PATH: "/api/health",
    VERIFY_TIMEOUT: "300",
    DEPLOY_CONFIG: "deploy.json",
    DEPLOY_CLI_VERSION: "0.3.0",
    NODE_VERSION: "22",
    REPOSITORY: "acme/app",
    E2E: "false",
    APP_VARS: "{}",
    DEPLOY: "false",
    BUILD: "false",
    PASSED_SECRETS: "",
  };

  it("builds by default, and runs the build job only when it is on", () => {
    expect(call.inputs?.build).toMatchObject({ type: "boolean", default: true });
    expect(checkStep?.env).toMatchObject({ BUILD: "${{ inputs.build }}" });
    expect(jobs.build?.if).toBe("inputs.build");
  });

  it("checks the inputs and hands out the release with the build off", () => {
    const result = runScript(checkStep?.run ?? "", ENV);
    expect(result.status, result.stdout).toBe(0);
    expect(result.output).toMatch(/^release=\{/m);
  });

  it("refuses the build off with a deploy or a prebuilt image, naming why", () => {
    const refused = runScript(checkStep?.run ?? "", {
      ...ENV,
      DEPLOY: "true",
      PASSED_SECRETS: "ssh-host ssh-user ssh-private-key ssh-known-hosts app-secrets",
      PREBUILT_IMAGE: `ghcr.io/acme/app@sha256:${"a".repeat(64)}`,
    });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain("::error::Input build is not valid: true with deploy (the deploy sends the image the build makes)");
    expect(refused.stdout).toContain("::error::Input build is not valid: true with prebuilt-image (only the build tags it)");
  });

  it("puts out the tag's commit from the branch guard, as the workflow output sha", () => {
    const guard = findNamedStep(jobs.check, "Refuse a tag off the release branch");
    expect(guard.id).toBe("commit");
    expect(guard.run).toContain('echo "sha=$sha" >> "$GITHUB_OUTPUT"');
    expect(jobs.check?.outputs?.sha).toBe("${{ steps.commit.outputs.sha }}");
    expect(call.outputs?.sha?.value).toBe("${{ jobs.check.outputs.sha }}");
  });
});

describe("deploy-cancel-run.yml (issue #628)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-cancel-run.yml"));
  const call = getWorkflowCall(workflow);
  const job = workflow.jobs.cancel;
  const step = findNamedStep(job, "Cancel this run");

  it("takes only the runner, and only its one job may write to Actions", () => {
    expect(Object.keys(call.inputs ?? {})).toEqual(["runs-on"]);
    expect(call.secrets).toBeUndefined();
    expect(workflow.permissions).toEqual({});
    expect(Object.keys(workflow.jobs)).toEqual(["cancel"]);
    expect(job?.permissions).toEqual({ actions: "write" });
    expect(step.env).toEqual({
      GH_TOKEN: "${{ github.token }}",
      REPOSITORY: "${{ github.repository }}",
      RUN_ID: "${{ github.run_id }}",
    });
  });

  it("cancels the calling run through the runs API", () => {
    const result = runScript(step.run ?? "", { GH_TOKEN: "token", REPOSITORY: "acme/app", RUN_ID: "42" }, {
      bin: { gh: '#!/bin/bash\nprintf \'%s\\n\' "$*" >> "$RUNNER_TEMP/gh-calls"\n' },
    });
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toContain("cancelling run 42");
  });

  it("calls gh with the run's cancel endpoint and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-cancel-"));
    try {
      const log = join(dir, "calls");
      const result = runScript(step.run ?? "", { GH_TOKEN: "token", REPOSITORY: "acme/app", RUN_ID: "42" }, {
        bin: { gh: `#!/bin/bash\nprintf '%s\\n' "$*" >> '${log}'\n` },
      });
      expect(result.status, result.stdout).toBe(0);
      expect(readFileSync(log, "utf8")).toBe("api --method POST repos/acme/app/actions/runs/42/cancel\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns instead of failing when the API refuses, e.g. a run another watcher cancelled already", () => {
    const result = runScript(step.run ?? "", { GH_TOKEN: "token", REPOSITORY: "acme/app", RUN_ID: "42" }, {
      bin: { gh: "#!/bin/bash\necho 'HTTP 409' >&2\nexit 1\n" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("::warning::");
  });
});

describe("the fail-fast input of deploy-release-checks.yml (issue #628)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-release-checks.yml"));
  const jobs = workflow.jobs as Record<string, Job & { strategy?: Record<string, unknown> }>;

  it("is off by default, so a pull request still sees every red shard, and stops the other shards when on", () => {
    expect(getWorkflowCall(workflow).inputs?.["fail-fast"]).toMatchObject({ type: "boolean", default: false });
    expect(jobs.unit?.strategy?.["fail-fast"]).toBe("${{ inputs.fail-fast }}");
  });
});

describe("the preflight of the deploy action (issue #628)", () => {
  const action = readAction();
  const steps = action.runs.steps;
  const check = steps.find((step) => step.name === "Check the SSH secrets");
  const release = steps[0]?.run ?? "";

  function readRelease(env: Record<string, string>): { status: number | null; stdout: string } {
    const result = runScript(release, { ENVIRONMENT_INPUT: "", APP_URL_INPUT: "", ...env });
    return { status: result.status, stdout: result.stdout };
  }

  const RELEASE = JSON.stringify({
    tag: "v1", "app-url": "https://example.com", image: "ghcr.io/acme/app", environment: "production",
    "compose-file": "docker/prod/docker-compose.yml", "server-script": "docker/server/deploy.sh",
    "deploy-config": "deploy.json", "remote-command": "deploy", "ssh-port": "22", "health-path": "/api/health",
    "verify-timeout-seconds": "300", "deploy-cli-version": "0.3.0", "node-version": "22", "build-args": "",
    "secret-min-lengths": "", "registry-token": "true", "server-files": "/docker/prod/\n",
  });

  it("is off by default", () => {
    expect(action.inputs.preflight?.default).toBe("false");
  });

  it("accepts a preflight with send, verify and report off, and refuses it with any of them on", () => {
    const off = { RELEASE, PREFLIGHT: "true", SEND: "false", VERIFY: "false", REPORT: "false" };
    expect(readRelease(off).status).toBe(0);
    for (const on of ["SEND", "VERIFY", "REPORT"]) {
      const refused = readRelease({ ...off, [on]: "true" });
      expect(refused.status, on).toBe(1);
      expect(refused.stdout).toContain("::error::Input preflight is not valid: true only with send, verify and report false");
    }
  });

  it("checks out the server files, sets up Node and renders .env.prod for a send or a preflight, then stops", () => {
    const either = "inputs.send == 'true' || inputs.preflight == 'true'";
    expect(steps.find((step) => step.uses?.startsWith("actions/checkout@") === true)?.if).toBe(either);
    expect(steps.find((step) => step.uses?.startsWith("actions/setup-node@") === true)?.if).toBe(
      `${either} || (inputs.verify == 'true' && steps.release.outputs.deploy-config != '')`,
    );
    expect(steps.find((step) => step.name === "Render .env.prod")?.if).toBe(either);
    expect(check?.if).toBe(either);
    for (const name of ["Pack the release", "Send the release to the server"]) {
      expect(steps.find((step) => step.name === name)?.if, name).toBe("inputs.send == 'true'");
    }
    const cleanup = steps.at(-1);
    expect(cleanup?.if).toBe("always()");
    expect(cleanup?.run).toContain(".softure-ai-release/.env.prod");
  });

  it("checks the SSH secrets right after the release, before anything is fetched, and never connects", () => {
    expect(steps.indexOf(check as Step)).toBe(1);
    expect(check?.run ?? "").not.toMatch(/\bssh\b -/);
    expect(check?.env).toEqual({
      SSH_HOST: "${{ inputs.ssh-host }}",
      SSH_USER: "${{ inputs.ssh-user }}",
      SSH_PRIVATE_KEY: "${{ inputs.ssh-private-key }}",
      SSH_KNOWN_HOSTS: "${{ inputs.ssh-known-hosts }}",
      SSH_PORT: "${{ steps.release.outputs.ssh-port }}",
    });
  });

  describe("the SSH check", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-ssh-check-"));
    const keyFile = join(dir, "id_ed25519");
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "test", "-f", keyFile]);
    const encryptedFile = join(dir, "id_encrypted");
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "secret-phrase", "-C", "test", "-f", encryptedFile]);
    const hostKey = readFileSync(`${keyFile}.pub`, "utf8").split(" ").slice(0, 2).join(" ");
    const VALID = {
      SSH_HOST: "203.0.113.7",
      SSH_USER: "deploy",
      SSH_PRIVATE_KEY: readFileSync(keyFile, "utf8"),
      SSH_KNOWN_HOSTS: `203.0.113.7 ${hostKey}`,
      SSH_PORT: "22",
    };
    const ENCRYPTED_KEY = readFileSync(encryptedFile, "utf8");
    rmSync(dir, { recursive: true, force: true });

    function runCheck(env: Record<string, string>): { status: number | null; stdout: string } {
      const result = runScript(check?.run ?? "", { ...VALID, ...env });
      return { status: result.status, stdout: result.stdout };
    }

    it("passes valid secrets, on port 22 and on another port", () => {
      const passed = runCheck({});
      expect(passed.status, passed.stdout).toBe(0);
      const port = runCheck({ SSH_PORT: "2222", SSH_KNOWN_HOSTS: `[203.0.113.7]:2222 ${hostKey}` });
      expect(port.status, port.stdout).toBe(0);
    });

    it("names every empty secret", () => {
      const empty = runCheck({ SSH_HOST: "", SSH_USER: "", SSH_PRIVATE_KEY: "", SSH_KNOWN_HOSTS: "" });
      expect(empty.status).toBe(1);
      for (const input of ["ssh-host", "ssh-user", "ssh-private-key", "ssh-known-hosts"]) {
        expect(empty.stdout).toContain(`::error::${input} is empty`);
      }
    });

    it.each([
      ["SSH_HOST", "bad host;", "::error::ssh-host is not a host name or address."],
      ["SSH_USER", "Root User", "::error::ssh-user is not a user name."],
      ["SSH_PRIVATE_KEY", "not a key", "::error::ssh-private-key is not an OpenSSH private key"],
      ["SSH_KNOWN_HOSTS", `198.51.100.1 ${hostKey}`, "::error::ssh-known-hosts has no line for the host ssh-host names"],
      ["SSH_PORT", "2222", "::error::ssh-known-hosts has no line for the host ssh-host names"],
    ])("refuses %s=%s", (name, value, message) => {
      const refused = runCheck({ [name]: value });
      expect(refused.status).toBe(1);
      expect(refused.stdout).toContain(message);
      expect(refused.stdout).not.toContain("PRIVATE KEY");
    });

    it("refuses a key with a passphrase, which the send could not use", () => {
      const refused = runCheck({ SSH_PRIVATE_KEY: ENCRYPTED_KEY });
      expect(refused.status).toBe(1);
      expect(refused.stdout).toContain("::error::ssh-private-key is not an OpenSSH private key without a passphrase");
    });
  });
});

describe("the example release pipeline that fails fast (issue #628)", () => {
  const caller = parse(readFileSync(join(REPO_ROOT, "tools/deploy/examples/deploy-pipeline.yml"), "utf8")) as Workflow;
  const jobs = caller.jobs as Record<string, Job & { needs?: string | string[]; if?: string; environment?: unknown; "runs-on"?: string }>;
  const needsOf = (id: string): string[] => {
    const needs = jobs[id]?.needs ?? [];
    return typeof needs === "string" ? [needs] : needs;
  };
  const watchers = Object.entries(jobs).filter(([, job]) => job.uses?.includes("deploy-cancel-run.yml") === true);

  it("checks the release first without building, so the preflight and the image start at once", () => {
    expect(jobs.release?.uses).toBe(`${CALLER_PREFIX}deploy-app.yml@master`);
    expect(jobs.release?.with).toMatchObject({ deploy: false, build: false });
    expect(needsOf("preflight")).toEqual(["release"]);
    expect(needsOf("image")).toEqual(["release"]);
    expect(jobs.image?.with?.ref).toBe("${{ needs.release.outputs.sha }}");
    expect(needsOf("static")).toEqual([]);
    expect(needsOf("unit")).toEqual([]);
  });

  it("runs the static checks and the unit shards as two calls, the shards failing fast", () => {
    expect(jobs.static?.uses).toBe(`${CALLER_PREFIX}deploy-release-checks.yml@master`);
    expect(jobs.static?.with).toMatchObject({ unit: false });
    expect(jobs.unit?.uses).toBe(`${CALLER_PREFIX}deploy-release-checks.yml@master`);
    expect(jobs.unit?.with).toMatchObject({ static: false, "fail-fast": true });
  });

  it("runs the preflight in the production environment with the deploy's secrets, checks only", () => {
    const preflight = jobs.preflight?.steps?.[0];
    const deploy = jobs.deploy?.steps?.[0];
    expect(jobs.preflight?.environment).toBe("production");
    expect(jobs.preflight?.permissions).toEqual({ contents: "read" });
    expect(preflight?.uses).toBe("SOFTURE/AI/.github/actions/deploy@master");
    expect(preflight?.with).toMatchObject({
      release: "${{ needs.release.outputs.release }}",
      preflight: true,
      send: false,
      verify: false,
      report: false,
    });
    expect(preflight?.env).toEqual(deploy?.env);
    for (const input of ["ssh-host", "ssh-user", "ssh-private-key", "ssh-known-hosts", "secret-names", "app-vars"]) {
      expect(preflight?.with?.[input], input).toBe(deploy?.with?.[input]);
    }
  });

  it("builds the release from the tested image only after every part passed", () => {
    expect(needsOf("build").sort()).toEqual(["image", "preflight", "static", "unit"]);
    expect(jobs.build?.with).toMatchObject({ deploy: false, "prebuilt-image": "${{ needs.image.outputs.prebuilt-image }}" });
    expect(needsOf("deploy")).toEqual(["build"]);
  });

  it("watches each part before the build with its own job, and never the build, the deploy or the report", () => {
    expect(watchers.map(([id]) => id).sort()).toEqual(["stop-on-image", "stop-on-preflight", "stop-on-static", "stop-on-unit"]);
    for (const [id, job] of watchers) {
      expect(job.uses, id).toBe(`${CALLER_PREFIX}deploy-cancel-run.yml@master`);
      expect(job.if, id).toBe("failure()");
      expect(needsOf(id), id).toEqual([id.replace("stop-on-", "")]);
      expect(job.permissions, id).toEqual({ actions: "write" });
    }
  });

  it("grants actions: write to the watchers only", () => {
    expect(JSON.stringify(caller.permissions)).not.toContain("actions");
    for (const [id, job] of Object.entries(jobs)) {
      if (id.startsWith("stop-on-")) continue;
      expect(JSON.stringify(job.permissions ?? {}), id).not.toContain("actions");
    }
  });
});

describe("the example caller with environments (issue #468)", () => {
  const caller = readYaml(EXAMPLE_ENVIRONMENTS_CALLER);
  const action = readAction();
  const build = caller.jobs.build as Job;
  const called = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-app.yml")));

  it("builds through deploy-app.yml with deploy off and no secrets", () => {
    expect(build.uses).toBe(`${CALLER_PREFIX}deploy-app.yml@master`);
    expect(build.with?.deploy).toBe(false);
    expect(build.secrets).toBeUndefined();
    for (const key of Object.keys(build.with ?? {})) expect(Object.keys(called.inputs ?? {})).toContain(key);
  });

  it.each(["production", "dev"])("deploys %s from a job in that environment, passing only the action's inputs", (id) => {
    const job = caller.jobs[id] as Job & { environment?: string; needs?: unknown };
    expect(job.environment).toBe(id);
    expect(job.needs).toBe("build");
    expect(job.permissions).toEqual({ contents: "read", packages: "read" });
    const step = job.steps?.[0];
    expect(step?.uses).toBe("SOFTURE/AI/.github/actions/deploy@master");
    expect(step?.with).toMatchObject({
      release: "${{ needs.build.outputs.release }}",
      "ssh-private-key": "${{ secrets.DEPLOY_SSH_KEY }}",
      "app-vars": "${{ toJSON(vars) }}",
    });
    // The app's secrets by name (issue #476): each in the step's env from its own secret, all listed in secret-names.
    expect(step?.with?.["app-secrets"]).toBeUndefined();
    const env = (step as { env?: Record<string, string> } | undefined)?.env ?? {};
    expect(Object.keys(env).length).toBeGreaterThan(0);
    for (const [name, value] of Object.entries(env)) expect(value).toBe(`\${{ secrets.${name} }}`);
    expect(String(step?.with?.["secret-names"]).split(/\s+/).sort()).toEqual(Object.keys(env).sort());
    for (const key of Object.keys(step?.with ?? {})) expect(Object.keys(action.inputs)).toContain(key);
  });

  it("leaves the run's deploy-report to one environment", () => {
    expect((caller.jobs.production?.steps?.[0]?.with ?? {}).report).toBeUndefined();
    expect(caller.jobs.dev?.steps?.[0]?.with?.report).toBe(false);
  });
});

describe("the end-to-end caller e2e-deploy.yml", () => {
  const caller = readYaml(join(WORKFLOWS_DIR, "e2e-deploy.yml"));
  const job = caller.jobs.deploy as Job & { permissions?: unknown };
  const called = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-app.yml")));
  const assertStep = (caller.jobs.assert?.steps ?? []).find((step) => (step.run ?? "").includes("check-received.sh"));

  it("calls this commit's deploy-app.yml with the test path on", () => {
    expect(job.uses).toBe("./.github/workflows/deploy-app.yml");
    expect(job.with).toMatchObject({
      tag: "${{ github.event.pull_request.head.sha || github.sha }}",
      "release-branch": "${{ github.head_ref || github.ref_name }}",
      e2e: true,
    });
  });

  it("passes only declared inputs and secrets, and every required one", () => {
    const declared = Object.keys(called.inputs ?? {});
    for (const key of Object.keys(job.with ?? {})) expect(declared).toContain(key);
    for (const [key, input] of Object.entries(called.inputs ?? {})) {
      if (input.required === true) expect(Object.keys(job.with ?? {})).toContain(key);
    }
    // The named form: every secret but origin-address, which has nothing to check on the test path (verify is
    // skipped). None is `required: true` (a caller with deploy: false passes none); the check job asks for them.
    const passed = Object.keys(job.secrets as Record<string, unknown>);
    for (const key of passed) expect(Object.keys(called.secrets ?? {})).toContain(key);
    expect(passed.sort()).toEqual(["app-secrets", "ssh-host", "ssh-known-hosts", "ssh-private-key", "ssh-user"]);
  });

  it("grants packages: write to the calling job only", () => {
    expect(caller.permissions).toEqual({ contents: "read" });
    expect(job.permissions).toEqual({ contents: "read", packages: "write" });
  });

  it("calls this commit's deploy-report.yml on the test path after the deploy, and checks its body", () => {
    const report = caller.jobs.report as Job & { needs?: unknown; if?: string };
    expect(report.uses).toBe("./.github/workflows/deploy-report.yml");
    expect(report.with).toEqual({ tag: (caller.jobs.deploy as Job & { with?: Record<string, unknown> }).with?.tag, e2e: true });
    expect(report.needs).toBe("deploy");
    expect(report.if).toBe("${{ always() }}");
    expect(report.permissions).toEqual({ contents: "write" });
    const checkReport = (caller.jobs.assert?.steps ?? []).find((step) => (step.run ?? "").includes("check-report.sh"));
    expect(checkReport?.env).toMatchObject({ IMAGE: "${{ needs.deploy.outputs.image }}" });
  });

  it("expects exactly the compose file's required names, and passes one more secret that must not be rendered", () => {
    const composeFile = String(job.with?.["compose-file"]);
    const compose = readFileSync(join(REPO_ROOT, composeFile), "utf8");
    const required = [...new Set([...compose.matchAll(/\$\{([A-Z_][A-Z0-9_]*):?\?\}/g)].map((match) => match[1]))].sort();
    const expected = String(assertStep?.env?.EXPECTED_ENV_NAMES).split(" ");
    expect(expected).toEqual(required);
    const secrets = JSON.parse(String((job.secrets as Record<string, unknown>)["app-secrets"])) as Record<string, string>;
    expect(Object.keys(secrets).filter((name) => !required.includes(name))).toEqual(["UNUSED_SECRET"]);
    for (const name of required) expect(Object.keys(secrets)).toContain(name);
  });

  it("checks out the commit it deployed", () => {
    const checkout = (caller.jobs.assert?.steps ?? []).find((step) => step.uses?.startsWith("actions/checkout@") === true);
    expect(checkout?.with?.ref).toBe(job.with?.tag);
  });

  it("checks the recording against the same files and image it deployed", () => {
    expect(assertStep?.env).toMatchObject({
      COMPOSE_FILE: job.with?.["compose-file"],
      SERVER_SCRIPT: job.with?.["server-script"],
      DEPLOY_CONFIG: job.with?.["deploy-config"],
      TAG: job.with?.tag,
      IMAGE: "${{ needs.deploy.outputs.image }}",
      EXPECTED_IMAGE: job.with?.image,
    });
  });

  it("deploys an image the e2e server's own registry serves, the one the committed compose file runs", () => {
    const image = String(job.with?.image);
    expect(image).toMatch(/^localhost:[0-9]+\//);
    const compose = readFileSync(join(REPO_ROOT, String(job.with?.["compose-file"])), "utf8");
    expect(compose).toContain(`image: ${image}:\${TAG}`);
  });
});

describe("deploy-cut-release.yml (DF-12)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-cut-release.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const job = workflow.jobs.cut as Job & { concurrency?: { group?: string; "cancel-in-progress"?: boolean } };
  const steps = job.steps ?? [];
  const findStep = (name: string): Step => {
    const step = steps.find((candidate) => candidate.name === name);
    if (step === undefined) throw new Error(`deploy-cut-release.yml has no step named "${name}"`);
    return step;
  };
  const checkStep = findStep("Check the inputs and the branch");
  const tagStep = findStep("Pick the next free date tag");
  const releaseStep = findStep("Create the release");
  const deployStep = findStep("Start the deploy workflow on the tag");

  /** Runs one step's script with fake `gh` and `date` first on PATH; returns the exit, stdout, outputs and gh calls. */
  function runStep(
    step: Step,
    env: Record<string, string>,
  ): { status: number | null; stdout: string; output: string; ghCalls: string[] } {
    const dir = mkdtempSync(join(tmpdir(), "deploy-cut-release-"));
    try {
      const bin = join(dir, "bin");
      const ghLog = join(dir, "gh.log");
      writeFileSync(join(dir, "output"), "");
      writeFileSync(join(dir, "summary"), "");
      writeFileSync(ghLog, "");
      mkdirSync(bin);
      // The fake gh records its arguments one call per line and answers `api` with FAKE_TAG_REFS.
      writeFileSync(
        join(bin, "gh"),
        `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${ghLog}"\nif [[ "$1" == api ]]; then printf '%s' "$FAKE_TAG_REFS"; fi\n`,
      );
      // The fake date answers only for the expected zone, so a lost TZ shows up as a wrong tag.
      writeFileSync(
        join(bin, "date"),
        `#!/usr/bin/env bash\nif [[ "$TZ" == "$FAKE_TZ" ]]; then echo 2026.10.06; else echo "wrong-zone-$TZ"; fi\n`,
      );
      chmodSync(join(bin, "gh"), 0o755);
      chmodSync(join(bin, "date"), 0o755);
      const result = spawnSync("bash", ["-e", "-c", step.run ?? ""], {
        encoding: "utf8",
        env: {
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          GITHUB_OUTPUT: join(dir, "output"),
          GITHUB_STEP_SUMMARY: join(dir, "summary"),
          GITHUB_REPOSITORY: "acme/app",
          GITHUB_SERVER_URL: "https://github.com",
          GITHUB_REF: "refs/heads/main",
          DEFAULT_BRANCH: "main",
          GH_TOKEN: "token",
          FAKE_TAG_REFS: "",
          FAKE_TZ: "UTC",
          ...env,
        },
      });
      return {
        status: result.status,
        stdout: result.stdout,
        output: readFileSync(join(dir, "output"), "utf8"),
        ghCalls: readFileSync(ghLog, "utf8").split("\n").filter((line) => line !== ""),
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const DEFAULT_CHECK_ENV = { TAG_PREFIX: "v", TIME_ZONE: "UTC", DEPLOY_WORKFLOW: "deploy.yml" };

  it("is started by the app, cuts from its dispatched commit and defaults to v, UTC and deploy.yml", () => {
    expect(inputs).toMatchObject({
      description: { default: "" },
      "tag-prefix": { default: "v" },
      timezone: { default: "UTC" },
      "deploy-workflow": { default: "deploy.yml" },
    });
    expect(tagStep.env?.SHA).toBe("${{ github.sha }}");
    expect(checkStep.env?.DEFAULT_BRANCH).toBe("${{ github.event.repository.default_branch }}");
  });

  it("grants the job exactly what a tag, a release and a dispatch need, one run per repository at a time", () => {
    expect(workflow.permissions).toEqual({});
    expect(job.permissions).toEqual({ contents: "write", actions: "write" });
    expect(job.concurrency).toEqual({ group: "deploy-cut-release-${{ github.repository }}", "cancel-in-progress": false });
  });

  it("accepts the defaults on the default branch", () => {
    expect(runStep(checkStep, DEFAULT_CHECK_ENV).status).toBe(0);
    expect(runStep(checkStep, { ...DEFAULT_CHECK_ENV, TIME_ZONE: "Europe/Warsaw", DEPLOY_WORKFLOW: "" }).status).toBe(0);
  });

  it("refuses a branch that is not the default one", () => {
    const refused = runStep(checkStep, { ...DEFAULT_CHECK_ENV, GITHUB_REF: "refs/heads/feature" });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain("::error::A release is cut from the default branch (main) only, not from refs/heads/feature");
    expect(runStep(checkStep, { ...DEFAULT_CHECK_ENV, GITHUB_REF: "refs/tags/main" }).status).toBe(1);
  });

  it.each([
    ["TAG_PREFIX", "v 1", 'Input tag-prefix is not valid: "v 1"'],
    ["TIME_ZONE", "Mars/Olympus", 'Input timezone is not valid: "Mars/Olympus"'],
    ["TIME_ZONE", "../../etc/passwd", 'Input timezone is not valid: "../../etc/passwd"'],
    ["DEPLOY_WORKFLOW", "deploy", 'Input deploy-workflow is not valid: "deploy"'],
    ["DEPLOY_WORKFLOW", "../ci.yml", 'Input deploy-workflow is not valid: "../ci.yml"'],
  ])("refuses %s=%s", (name, value, message) => {
    const refused = runStep(checkStep, { ...DEFAULT_CHECK_ENV, [name]: value });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain(`::error::${message}`);
  });

  it.each([
    ["no release that day", "", "v2026.10.06"],
    ["one release that day", "refs/tags/v2026.10.06\n", "v2026.10.06-2"],
    ["three releases that day", "refs/tags/v2026.10.06\nrefs/tags/v2026.10.06-2\nrefs/tags/v2026.10.06-3\n", "v2026.10.06-4"],
    ["only a longer tag that shares the prefix", "refs/tags/v2026.10.06-2\n", "v2026.10.06"],
  ])("picks the next free tag with %s", (_case, refs, expected) => {
    const result = runStep(tagStep, { TAG_PREFIX: "v", TIME_ZONE: "UTC", SHA: "abc123", FAKE_TAG_REFS: refs });
    expect(result.status).toBe(0);
    expect(result.output).toBe(`tag=${expected}\nsha=abc123\n`);
    expect(result.ghCalls).toEqual(["api --paginate repos/acme/app/git/matching-refs/tags/v2026.10.06 --jq .[].ref"]);
  });

  it("names the tag by the date in the given zone and with the given prefix", () => {
    const result = runStep(tagStep, { TAG_PREFIX: "release-", TIME_ZONE: "Europe/Warsaw", FAKE_TZ: "Europe/Warsaw", SHA: "abc" });
    expect(result.output).toBe("tag=release-2026.10.06\nsha=abc\n");
  });

  it("creates the release on the picked commit with the description above the generated notes", () => {
    expect(releaseStep.env).toMatchObject({
      TAG: "${{ steps.tag.outputs.tag }}",
      SHA: "${{ steps.tag.outputs.sha }}",
      DESCRIPTION: "${{ inputs.description }}",
    });
    const result = runStep(releaseStep, { TAG: "v2026.10.06", SHA: "abc123", DESCRIPTION: "Ships `x`; $(not run)" });
    expect(result.status).toBe(0);
    expect(result.ghCalls).toEqual([
      "release create v2026.10.06 --repo acme/app --target abc123 --title v2026.10.06 --notes Ships `x`; $(not run) --generate-notes",
    ]);
  });

  it("starts the deploy workflow on the tag with the tag as its input, unless deploy-workflow is empty", () => {
    expect(deployStep.if).toBe("inputs.deploy-workflow != ''");
    const result = runStep(deployStep, { TAG: "v2026.10.06-2", DEPLOY_WORKFLOW: "deploy.yml" });
    expect(result.status).toBe(0);
    expect(result.ghCalls).toEqual(["workflow run deploy.yml --repo acme/app --ref v2026.10.06-2 -f tag=v2026.10.06-2"]);
  });

  it("runs the steps in order: check, tag, release, deploy", () => {
    expect(steps.map((step) => step.name)).toEqual([
      "Check the inputs and the branch",
      "Pick the next free date tag",
      "Create the release",
      "Start the deploy workflow on the tag",
    ]);
  });
});

describe("the example release caller", () => {
  const caller = readYaml(EXAMPLE_RELEASE_CALLER);
  const callingJobs = Object.values(caller.jobs).filter((job) => job.uses !== undefined);
  const job = callingJobs[0] as Job;
  const called = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-cut-release.yml")));

  it("is started by hand or by an agent only", () => {
    expect(Object.keys(caller.on)).toEqual(["workflow_dispatch"]);
  });

  it("calls the cut-release workflow with one uses: line", () => {
    expect(callingJobs).toHaveLength(1);
    expect(job.uses).toBe("SOFTURE/AI/.github/workflows/deploy-cut-release.yml@master");
  });

  it("grants what the called job needs and nothing more", () => {
    expect(caller.permissions).toEqual({ contents: "write", actions: "write" });
  });

  it("passes only declared inputs", () => {
    const declared = Object.keys(called.inputs ?? {});
    for (const key of Object.keys(job.with ?? {})) expect(declared).toContain(key);
    expect(job.secrets).toBeUndefined();
  });

  it("starts the deploy caller shipped next to it, which takes the tag as a dispatch input", () => {
    expect(job.with?.["deploy-workflow"]).toBe("deploy.yml");
    const deployCaller = readYaml(EXAMPLE_CALLER);
    const dispatch = deployCaller.on.workflow_dispatch as { inputs?: Record<string, WorkflowInput> };
    expect(dispatch.inputs?.tag?.required).toBe(true);
  });
});

describe("deploy-integration.yml (issue #248)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-integration.yml"));
  const testSteps = workflow.jobs.test?.steps ?? [];
  const recordJob = workflow.jobs.record as Job & { needs?: unknown; if?: string };
  const recordSteps = recordJob.steps ?? [];
  const suite = testSteps.find((step) => step.name === "Run the suite");
  const record = recordSteps.find((step) => step.name === "Record the result");
  const deleteRef = recordSteps.find((step) => step.name === "Delete the integration ref");

  function runStep(step: Step | undefined, env: Record<string, string>, bin: Record<string, string> = {}) {
    const dir = mkdtempSync(join(tmpdir(), "deploy-integration-"));
    try {
      for (const [name, script] of Object.entries(bin)) writeFileSync(join(dir, name), script, { mode: 0o755 });
      writeFileSync(join(dir, "output"), "");
      const result = spawnSync("bash", ["-e", "-c", step?.run ?? ""], {
        encoding: "utf8",
        env: { PATH: `${dir}:${process.env.PATH ?? ""}`, GITHUB_OUTPUT: join(dir, "output"), RUNNER_TEMP: dir, ...env },
      });
      return { ...result, output: readFileSync(join(dir, "output"), "utf8") };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("runs the app's suite in a job that can only read and keeps no credentials", () => {
    // packages: read lets the caller's registry-token pull a private image (issue #462).
    expect(workflow.jobs.test?.permissions).toEqual({ contents: "read", packages: "read" });
    const checkout = testSteps.find((step) => step.uses?.startsWith("actions/checkout@") === true);
    expect(checkout?.with).toEqual({
      ref: "${{ github.sha }}",
      "persist-credentials": false,
      "sparse-checkout": "${{ inputs.sparse-checkout }}",
      "sparse-checkout-cone-mode": false,
    });
  });

  it("declares artifact-paths, sparse-checkout and node-cache, off except the npm cache (issue #368)", () => {
    const inputs = getWorkflowCall(workflow).inputs ?? {};
    expect(inputs["artifact-paths"]).toMatchObject({ type: "string", default: "" });
    expect(inputs["sparse-checkout"]).toMatchObject({ type: "string", default: "" });
    expect(inputs["node-cache"]).toMatchObject({ type: "string", default: "npm" });
  });

  it("checks out both jobs sparsely with the same patterns, and caches the suite's downloads (issue #368)", () => {
    const recordCheckout = recordSteps.find((step) => step.uses?.startsWith("actions/checkout@") === true);
    expect(recordCheckout?.with).toMatchObject({
      "sparse-checkout": "${{ inputs.sparse-checkout }}",
      "sparse-checkout-cone-mode": false,
    });
    const setupNode = testSteps.find((step) => step.uses?.startsWith("actions/setup-node@") === true);
    expect(setupNode?.with).toEqual({ "node-version": "${{ inputs.node-version }}", cache: "${{ inputs.node-cache }}" });
  });

  it("uploads the failure artifacts when the suite is red or the job failed, before the job fails (issue #368)", () => {
    const index = testSteps.findIndex((step) => step.name === "Keep the failure artifacts");
    const upload = testSteps[index];
    expect(upload?.if).toBe("inputs.artifact-paths != '' && (failure() || steps.suite.outputs.result == 'red')");
    expect(upload?.uses?.startsWith("actions/upload-artifact@")).toBe(true);
    expect(upload?.with).toEqual({
      name: "integration-failure",
      path: "${{ inputs.artifact-paths }}",
      "if-no-files-found": "warn",
      "retention-days": 7,
      overwrite: true,
    });
    expect(index).toBeGreaterThan(testSteps.findIndex((step) => step.name === "Run the suite"));
    expect(index).toBeLessThan(testSteps.findIndex((step) => step.name === "Fail on a red suite"));
  });

  const SUITE_ENV = {
    INTEGRATION_IMAGE: "${{ inputs.image }}",
    INTEGRATION_EXPECTED_ORIGINS: "${{ inputs.expected-origins }}",
    INTEGRATION_FAIL_ON_FLAKY: "${{ inputs.fail-on-flaky }}",
  };

  it("hands the image, the expected origins and fail-on-flaky to the set-up and the suite (issue #308)", () => {
    const setup = testSteps.find((step) => step.name === "Set up");
    expect(setup?.env).toEqual({ SETUP_COMMAND: "${{ inputs.setup-command }}", ...SUITE_ENV });
    expect(suite?.env).toEqual({ TEST_COMMAND: "${{ inputs.test-command }}", ...SUITE_ENV });
  });

  it("pulls the image before the app's code runs, through a Docker config it deletes (issue #308)", () => {
    const pullIndex = testSteps.findIndex((step) => step.name === "Pull the image");
    const pull = testSteps[pullIndex];
    expect(pull?.if).toBe("inputs.image != ''");
    expect(pullIndex).toBeLessThan(testSteps.findIndex((step) => step.name === "Set up"));
    const docker = '#!/bin/sh\necho "docker $*" >> "$RUNNER_TEMP/../docker-calls"\nfor a in "$@"; do [ "$a" = "--password-stdin" ] && { cat; echo; } >> "$RUNNER_TEMP/../docker-calls"; done\nexit 0\n';
    const image = `ghcr.io/acme/app@sha256:${"a".repeat(64)}`;
    const dir = mkdtempSync(join(tmpdir(), "deploy-integration-pull-"));
    try {
      const runner = join(dir, "runner");
      mkdirSync(runner);
      writeFileSync(join(dir, "docker"), docker, { mode: 0o755 });
      const run = (token: string) =>
        spawnSync("bash", ["-e", "-c", pull?.run ?? ""], {
          encoding: "utf8",
          env: { PATH: `${dir}:${process.env.PATH ?? ""}`, RUNNER_TEMP: runner, IMAGE: image, REGISTRY_TOKEN: token, REGISTRY_USER: "bot" },
        });
      const withToken = run("secret-token");
      expect(withToken.status, withToken.stderr).toBe(0);
      const calls = readFileSync(join(dir, "docker-calls"), "utf8").split("\n");
      expect(calls[0]).toMatch(/^docker --config \S+ login ghcr\.io --username bot --password-stdin$/);
      expect(calls[1]).toBe("secret-token");
      expect(calls[2]?.startsWith("docker --config ")).toBe(true);
      expect(calls[2]?.endsWith(` pull ${image}`)).toBe(true);
      const config = /--config (\S+)/.exec(calls[0] ?? "")?.[1] ?? "";
      expect(existsSync(config)).toBe(false);
      writeFileSync(join(dir, "docker-calls"), "");
      expect(run("").status).toBe(0);
      expect(readFileSync(join(dir, "docker-calls"), "utf8")).not.toContain("login");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the suite's exit code as the result instead of stopping the job", () => {
    expect(runStep(suite, { TEST_COMMAND: "exit 0" })).toMatchObject({ status: 0, output: "result=green\n" });
    expect(runStep(suite, { TEST_COMMAND: "echo failing; exit 3" })).toMatchObject({ status: 0, output: "result=red\n" });
  });

  it("records after the suite whatever its result, except a cancelled one", () => {
    expect(recordJob.needs).toBe("test");
    expect(recordJob.if).toBe("${{ always() }}");
    expect(record?.if).toBe("needs.test.result != 'cancelled'");
    expect(record?.env?.RESULT).toBe("${{ needs.test.outputs.result || 'red' }}");
  });

  it("records with the pinned CLI, the tested commit, its ref and the run, and the JUnit report when set", () => {
    const run = (junit: string, env: Record<string, string> = {}) =>
      runStep(
        record,
        {
          GITHUB_SHA: "a".repeat(40),
          GITHUB_REF: "refs/heads/integration/feature",
          RESULT: "red",
          RUN_URL: "https://github.com/acme/app/actions/runs/1/attempts/1",
          JUNIT_REPORT: junit,
          RESULTS_REPORT: "",
          RESULTS_FORMAT: "",
          FAIL_ON_FLAKY: "false",
          NOTES_REF: "refs/notes/integration",
          REF_PREFIX: "integration/",
          DEPLOY_CLI_VERSION: "0.1.5",
          ...env,
        },
        { npx: '#!/bin/sh\nprintf "%s\\n" "$@"\n' },
      );
    const base = [
      "--yes",
      "--package=@softure-ai/deploy@0.1.5",
      "softure-deploy",
      "integration",
      "record",
      `--sha=${"a".repeat(40)}`,
      "--ref=refs/heads/integration/feature",
      "--result=red",
      "--run=https://github.com/acme/app/actions/runs/1/attempts/1",
    ];
    expect(run("").stdout.split("\n")).toEqual([...base, ""]);
    const withReport = run("reports/junit.xml").stdout.split("\n");
    expect(withReport.slice(0, -2)).toEqual(base);
    expect(withReport.at(-2)).toMatch(/^--junit=.+\/integration-results\/junit\.xml$/);
    const results = run("", {
      RESULTS_REPORT: "test-results/e2e.json",
      RESULTS_FORMAT: "playwright-json",
      FAIL_ON_FLAKY: "true",
      NOTES_REF: "refs/notes/e2e-run",
      REF_PREFIX: "e2e-run/",
    }).stdout.split("\n");
    expect(results.slice(0, base.length)).toEqual(base);
    expect(results.slice(base.length, -1)).toEqual([
      expect.stringMatching(/^--results=.+\/integration-results\/e2e\.json$/) as unknown,
      "--format=playwright-json",
      "--fail-on-flaky",
      "--notes-ref=refs/notes/e2e-run",
      "--ref-prefix=e2e-run/",
    ]);
  });

  it("deletes only an integration ref, and accepts one already gone", () => {
    expect(deleteRef?.if).toBe("always()");
    const gh = '#!/bin/sh\necho "$@" >> "$RUNNER_TEMP/../gh-calls"\n[ "$GH_FAIL" = "" ] || { echo "$GH_FAIL" >&2; exit 1; }\n';
    const prefixed = runStep(deleteRef, { GITHUB_REF: "refs/heads/e2e-run/feature", GITHUB_REPOSITORY: "acme/app", REF_PREFIX: "e2e-run/" }, { gh });
    expect(prefixed.stdout).toContain("Deleted refs/heads/e2e-run/feature.");
    const tag = runStep(deleteRef, { GITHUB_REF: "refs/tags/v1.2.3", GITHUB_REPOSITORY: "acme/app", REF_PREFIX: "integration/", GH_FAIL: "must not run" }, { gh });
    expect(tag.stdout).toContain("is not an integration ref; it stays");
    const integration = runStep(deleteRef, { GITHUB_REF: "refs/heads/integration/feature", GITHUB_REPOSITORY: "acme/app", REF_PREFIX: "integration/" }, { gh });
    expect(integration.status, integration.stderr).toBe(0);
    expect(integration.stdout).toContain("Deleted refs/heads/integration/feature.");
    const main = runStep(deleteRef, { GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "acme/app", REF_PREFIX: "integration/", GH_FAIL: "must not run" }, { gh });
    expect(main.status).toBe(0);
    expect(main.stdout).toContain("is not an integration ref; it stays");
    const gone = runStep(deleteRef, { GITHUB_REF: "refs/heads/integration/x", GITHUB_REPOSITORY: "acme/app", REF_PREFIX: "integration/", GH_FAIL: "Reference does not exist (HTTP 422)" }, { gh });
    expect(gone.status).toBe(0);
    const denied = runStep(deleteRef, { GITHUB_REF: "refs/heads/integration/x", GITHUB_REPOSITORY: "acme/app", REF_PREFIX: "integration/", GH_FAIL: "Resource not accessible (HTTP 403)" }, { gh });
    expect(denied.status).toBe(1);
  });

  it("refuses an input that is not valid before anything runs", () => {
    const validate = testSteps[0];
    expect(validate?.name).toBe("Validate inputs");
    const valid = {
      TEST_COMMAND: "npm test",
      JUNIT_REPORT: "",
      RESULTS_REPORT: "",
      RESULTS_FORMAT: "",
      IMAGE: "",
      EXPECTED_ORIGINS: "",
      NOTES_REF: "refs/notes/integration",
      REF_PREFIX: "integration/",
      NODE_VERSION: "22",
      DEPLOY_CLI_VERSION: "0.1.5",
      ARTIFACT_PATHS: "",
      NODE_CACHE: "npm",
      GITHUB_REF: "refs/heads/integration/x",
    };
    const image = `ghcr.io/acme/app@sha256:${"0".repeat(64)}`;
    expect(runStep(validate, valid).status).toBe(0);
    for (const accepted of [
      { RESULTS_REPORT: "test-results/e2e.json", RESULTS_FORMAT: "playwright-json" },
      { RESULTS_REPORT: "reports/junit.xml" },
      { IMAGE: image, GITHUB_REF: "refs/tags/v1.2.3", EXPECTED_ORIGINS: "https://app.example.com, http://localhost:3000" },
      { IMAGE: `registry.example.com:5000/app@sha256:${"0".repeat(64)}` },
      { NOTES_REF: "refs/notes/e2e-run", REF_PREFIX: "e2e-run/" },
      { ARTIFACT_PATHS: "test-results/**\n!test-results/**/*.webm\nplaywright-report/trace?.zip\n" },
      { NODE_CACHE: "" },
      { NODE_CACHE: "yarn" },
    ]) {
      const result = runStep(validate, { ...valid, ...accepted });
      expect(result.status, `${JSON.stringify(accepted)}: ${result.stdout}`).toBe(0);
    }
    for (const [key, value] of [
      ["TEST_COMMAND", ""],
      ["JUNIT_REPORT", "../junit.xml"],
      ["JUNIT_REPORT", "/tmp/junit.xml"],
      ["RESULTS_REPORT", "../e2e.json"],
      ["RESULTS_FORMAT", "playwright-json"],
      ["DEPLOY_CLI_VERSION", "latest"],
      ["GITHUB_REF", "refs/tags/v1"],
      ["IMAGE", "ghcr.io/acme/app:latest"],
      ["IMAGE", `ghcr.io/acme/app@sha256:${"0".repeat(63)}`],
      ["EXPECTED_ORIGINS", "app.example.com"],
      ["EXPECTED_ORIGINS", "https://app.example.com/path"],
      ["NOTES_REF", "refs/heads/x"],
      ["NOTES_REF", "refs/notes/a..b"],
      ["REF_PREFIX", "integration"],
      ["REF_PREFIX", "-x/"],
      ["ARTIFACT_PATHS", "test-results/**\n/tmp/trace.zip"],
      ["ARTIFACT_PATHS", "!../secrets"],
      ["ARTIFACT_PATHS", "logs/$(id)"],
      ["NODE_CACHE", "pnpm"],
    ]) {
      expect(runStep(validate, { ...valid, [key as string]: value as string }).status, `${key as string}=${value as string}`).toBe(1);
    }
    expect(runStep(validate, { ...valid, JUNIT_REPORT: "a.xml", RESULTS_REPORT: "b.xml" }).status).toBe(1);
    expect(runStep(validate, { ...valid, RESULTS_REPORT: "a.json", RESULTS_FORMAT: "tap" }).status).toBe(1);
  });
});

describe("the example integration caller", () => {
  const caller = readYaml(EXAMPLE_INTEGRATION_CALLER);
  const job = Object.values(caller.jobs)[0] as Job;
  const called = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-integration.yml")));

  it("runs on a push of integration/<name> and of the main branch", () => {
    expect(caller.on).toEqual({ push: { branches: ["integration/**", "main"] } });
  });

  it("calls the integration workflow with one uses: line and passes only declared inputs", () => {
    expect(job.uses).toBe("SOFTURE/AI/.github/workflows/deploy-integration.yml@master");
    const declared = Object.keys(called.inputs ?? {});
    for (const key of Object.keys(job.with ?? {})) expect(declared).toContain(key);
    expect(job.with?.["test-command"]).toBeDefined();
  });

  it("grants what the record job and the test job's image pull need and nothing more", () => {
    expect(caller.permissions).toEqual({ contents: "write", packages: "read" });
  });
});

/** Runs a step's script with bash -e (as a runner does) and `bin` first on PATH; returns the exit, stdout and outputs. */
function runScript(
  script: string,
  env: Record<string, string>,
  options: { cwd?: string; bin?: Record<string, string> } = {},
): { status: number | null; stdout: string; output: string; summary: string } {
  const dir = mkdtempSync(join(tmpdir(), "deploy-step-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin);
    for (const [name, text] of Object.entries(options.bin ?? {})) writeFileSync(join(bin, name), text, { mode: 0o755 });
    writeFileSync(join(dir, "output"), "");
    writeFileSync(join(dir, "summary"), "");
    const result = spawnSync("bash", ["-e", "-c", script], {
      cwd: options.cwd ?? dir,
      encoding: "utf8",
      env: {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        HOME: dir,
        RUNNER_TEMP: dir,
        GITHUB_OUTPUT: join(dir, "output"),
        GITHUB_STEP_SUMMARY: join(dir, "summary"),
        GITHUB_REPOSITORY: "acme/app",
        ...env,
      },
    });
    return {
      status: result.status,
      stdout: result.stdout,
      output: readFileSync(join(dir, "output"), "utf8"),
      summary: readFileSync(join(dir, "summary"), "utf8"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function findNamedStep(job: Job | undefined, name: string): Step {
  const step = (job?.steps ?? []).find((candidate) => candidate.name === name);
  if (step === undefined) throw new Error(`no step named "${name}"`);
  return step;
}

describe("deploy-release-checks.yml (issue #406)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-release-checks.yml"));
  const call = getWorkflowCall(workflow) as WorkflowCall & { outputs?: Record<string, { value?: string }> };
  const inputs = call.inputs ?? {};
  const jobs = workflow.jobs as Record<string, Job & { if?: string; needs?: unknown; strategy?: { matrix?: Record<string, unknown> } }>;
  const inputStep = findNamedStep(jobs.prepare, "Check the inputs");
  const commitStep = findNamedStep(jobs.prepare, "Resolve the commit");

  /** The input step's env with every input at its default, as the runner would pass it. */
  const DEFAULTS: Record<string, string> = {
    TAG: "",
    TAG_PATTERN: String(inputs["tag-pattern"]?.default),
    RELEASE_BRANCH: "",
    NODE_VERSION: "22",
    CACHE: "npm",
    INSTALL_COMMAND: "npm ci",
    STATIC: "true",
    STATIC_COMMAND: String(inputs["static-command"]?.default),
    UNIT: "true",
    TEST_COMMAND: String(inputs["test-command"]?.default),
    SHARDS: "1",
    STATIC_CACHE_PATHS: "",
  };

  it("checks the caller's commit by default: static and one unit shard, and reads the repository only", () => {
    expect(inputs).toMatchObject({
      tag: { default: "" },
      "tag-pattern": { default: "^v[0-9]{4}\\.[0-9]{2}\\.[0-9]{2}(-[0-9]+)?$" },
      static: { default: true },
      unit: { default: true },
      shards: { default: 1 },
      "install-command": { default: "npm ci" },
    });
    expect(Object.keys(call.outputs ?? {})).toEqual(["sha"]);
    expect(call.outputs?.sha?.value).toBe("${{ jobs.prepare.outputs.sha || github.sha }}");
    expect(Object.keys(jobs)).toEqual(["prepare", "static", "unit"]);
    for (const job of Object.values(jobs)) expect(job.permissions).toEqual({ contents: "read" });
  });

  it("accepts the defaults and puts out the shard list", () => {
    const result = runScript(inputStep.run ?? "", DEFAULTS);
    expect(result.status).toBe(0);
    expect(result.output).toBe("shards=[1]\n");
    expect(runScript(inputStep.run ?? "", { ...DEFAULTS, SHARDS: "3" }).output).toContain("shards=[1,2,3]\n");
    expect(runScript(inputStep.run ?? "", { ...DEFAULTS, SHARDS: "20" }).output).toContain(",19,20]\n");
  });

  it.each(["v2026.10.12", "v2026.10.12-2", "v2026.10.12-13"])("accepts the date tag %s", (tag) => {
    expect(runScript(inputStep.run ?? "", { ...DEFAULTS, TAG: tag }).status).toBe(0);
  });

  it.each([
    ["TAG", "v2026.10.12-x", "Input tag is not valid: a tag matching"],
    ["TAG", "release-1", "Input tag is not valid: a tag matching"],
    ["TAG", "v1;id", "Input tag is not valid: a tag name"],
    ["TAG_PATTERN", "(", "Input tag-pattern is not valid"],
    ["RELEASE_BRANCH", "a..b", "Input release-branch is not valid"],
    ["NODE_VERSION", "22; id", "Input node-version is not valid"],
    ["CACHE", "bun", "Input cache is not valid"],
    ["SHARDS", "0", "Input shards is not valid: 1 to 20"],
    ["SHARDS", "21", "Input shards is not valid: 1 to 20"],
    ["STATIC_COMMAND", "", "Input static-command is not valid"],
    ["TEST_COMMAND", "", "Input test-command is not valid"],
    ["INSTALL_COMMAND", "", "Input install-command is not valid"],
    ["STATIC_CACHE_PATHS", ".eslintcache\n/tmp/cache", "Input static-cache-paths is not valid: paths inside the checkout"],
    ["STATIC_CACHE_PATHS", "../.eslintcache", "Input static-cache-paths is not valid: paths inside the checkout"],
    ["STATIC_CACHE_PATHS", "a/../../b", "Input static-cache-paths is not valid: paths inside the checkout"],
    ["STATIC_CACHE_PATHS", "~/.cache", "Input static-cache-paths is not valid: paths inside the checkout"],
  ])("refuses %s=%s", (name, value, message) => {
    const tag: Record<string, string> = name === "TAG_PATTERN" ? { TAG: "v2026.10.12" } : {};
    const refused = runScript(inputStep.run ?? "", { ...DEFAULTS, ...tag, [name]: value });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain(`::error::${message}`);
    expect(refused.output).toBe("");
  });

  it("refuses a run with nothing to do", () => {
    const idle = runScript(inputStep.run ?? "", { ...DEFAULTS, STATIC: "false", UNIT: "false" });
    expect(idle.status).toBe(1);
    expect(idle.stdout).toContain("nothing would run");
    expect(runScript(inputStep.run ?? "", { ...DEFAULTS, STATIC: "false" }).status).toBe(0);
  });

  describe("the commit guard", () => {
    const git = (cwd: string, ...args: string[]): string => {
      const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
      });
      if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
      return result.stdout.trim();
    };
    const env = { SHA: "f".repeat(40), RELEASE_BRANCH: "", DEFAULT_BRANCH: "main", REPOSITORY: "acme/app" };

    /** A repository whose main holds the tag v2026.10.12 and whose side branch holds v2026.10.12-2. */
    function withRepository(test: (repo: string, onMain: string, offMain: string) => void): void {
      const repo = mkdtempSync(join(tmpdir(), "deploy-checks-repo-"));
      try {
        git(repo, "init", "-q");
        git(repo, "commit", "-q", "--allow-empty", "-m", "on main");
        const onMain = git(repo, "rev-parse", "HEAD");
        git(repo, "update-ref", "refs/remotes/origin/main", onMain);
        git(repo, "tag", "v2026.10.12");
        git(repo, "commit", "-q", "--allow-empty", "-m", "off main");
        const offMain = git(repo, "rev-parse", "HEAD");
        git(repo, "tag", "v2026.10.12-2");
        test(repo, onMain, offMain);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    }

    it("checks the caller's own commit and leaves the ref to the checkout without a tag", () => {
      const result = runScript(commitStep.run ?? "", { ...env, TAG: "" });
      expect(result.status).toBe(0);
      expect(result.output).toBe(`sha=${"f".repeat(40)}\nref=\n`);
      expect(commitStep.env).toMatchObject({ SHA: "${{ github.sha }}", DEFAULT_BRANCH: "${{ github.event.repository.default_branch }}" });
    });

    it("pins every job to the tag's commit when it is on the release branch", () => {
      withRepository((repo, onMain) => {
        const result = runScript(commitStep.run ?? "", { ...env, TAG: "v2026.10.12" }, { cwd: repo });
        expect(result.status).toBe(0);
        expect(result.output).toBe(`sha=${onMain}\nref=${onMain}\n`);
      });
    });

    it("refuses a tag whose commit is off the release branch, an unknown tag and an unknown branch", () => {
      withRepository((repo, _onMain, offMain) => {
        const off = runScript(commitStep.run ?? "", { ...env, TAG: "v2026.10.12-2" }, { cwd: repo });
        expect(off.status).toBe(1);
        expect(off.stdout).toContain(`::error::The commit ${offMain} of v2026.10.12-2 is not on main`);
        expect(off.output).toBe("");
        expect(runScript(commitStep.run ?? "", { ...env, TAG: "v2026.10.13" }, { cwd: repo }).stdout).toContain("names no commit");
        const branch = runScript(commitStep.run ?? "", { ...env, TAG: "v2026.10.12", RELEASE_BRANCH: "release" }, { cwd: repo });
        expect(branch.stdout).toContain("::error::The release branch release does not exist");
      });
    });

    it("fetches commits only, without credentials, and only for a tag", () => {
      const checkout = (jobs.prepare?.steps ?? []).find((step) => step.uses?.startsWith("actions/checkout@") === true);
      expect(checkout?.if).toBe("inputs.tag != ''");
      expect(checkout?.with).toMatchObject({ ref: "${{ inputs.tag }}", "persist-credentials": false, "fetch-depth": 0, filter: "tree:0" });
    });
  });

  it("checks out the resolved commit in every other job, without credentials", () => {
    for (const id of ["static", "unit"]) {
      const checkout = (jobs[id]?.steps ?? []).find((step) => step.uses?.startsWith("actions/checkout@") === true);
      expect(checkout?.with, id).toMatchObject({
        ref: "${{ needs.prepare.outputs.ref }}",
        "persist-credentials": false,
        "sparse-checkout": "${{ inputs.sparse-checkout }}",
      });
    }
  });

  it("runs the caller's commands from env, never interpolated", () => {
    const commands = [
      [findNamedStep(jobs.static, "Install"), "INSTALL_COMMAND", "install-command"],
      [findNamedStep(jobs.static, "Type check and lint"), "STATIC_COMMAND", "static-command"],
      [findNamedStep(jobs.unit, "Install"), "INSTALL_COMMAND", "install-command"],
      [findNamedStep(jobs.unit, "Unit tests"), "TEST_COMMAND", "test-command"],
    ] as const;
    for (const [step, variable, input] of commands) {
      expect(step.run).toBe(`bash -e -o pipefail -c "$${variable}"`);
      expect(step.env?.[variable]).toBe(`\${{ inputs.${input} }}`);
    }
  });

  it("runs the unit tests once per shard, each told its index and the count", () => {
    expect(jobs.unit?.strategy?.matrix).toEqual({ shard: "${{ fromJSON(needs.prepare.outputs.shards || '[1]') }}" });
    expect(findNamedStep(jobs.unit, "Unit tests").env).toMatchObject({ SHARD_INDEX: "${{ matrix.shard }}", SHARD_COUNT: "${{ inputs.shards }}" });
    const result = runScript(`SHARD_INDEX=2 SHARD_COUNT=3; ${String(inputs["test-command"]?.default).replace(/^npm test --/, "printf '%s\\n'")}`, {});
    expect(result.stdout).toBe("--shard=2/3\n");
  });

  describe("a pull request's run (issue #627)", () => {
    it("runs prepare only for a tag or more than one unit shard", () => {
      expect((jobs.prepare as { if?: string }).if).toBe("inputs.tag != '' || (inputs.unit && inputs.shards != 1)");
    });

    it("runs static and unit after a skipped prepare, never after a failed or cancelled one", () => {
      expect(jobs.static?.needs).toBe("prepare");
      expect(jobs.unit?.needs).toBe("prepare");
      expect(jobs.static?.if).toBe("${{ !cancelled() && inputs.static && needs.prepare.result != 'failure' }}");
      expect(jobs.unit?.if).toBe("${{ !cancelled() && inputs.unit && needs.prepare.result != 'failure' }}");
    });

    it("checks the inputs first in every job, with the one step prepare runs", () => {
      for (const id of ["prepare", "static", "unit"]) {
        expect(jobs[id]?.steps?.[0], id).toEqual(inputStep);
      }
    });

    it("accepts cache paths inside the checkout", () => {
      const accepted = runScript(inputStep.run ?? "", { ...DEFAULTS, STATIC_CACHE_PATHS: ".eslintcache\n**/*.tsbuildinfo\n\napps/web/.eslintcache\n" });
      expect(accepted.status).toBe(0);
      expect(inputStep.env).toMatchObject({ STATIC_CACHE_PATHS: "${{ inputs.static-cache-paths }}" });
      expect(inputs["static-cache-paths"]).toMatchObject({ default: "" });
    });
  });

  describe("the static cache (issue #627)", () => {
    const steps = jobs.static?.steps ?? [];
    const cacheIndex = steps.findIndex((step) => step.uses?.startsWith("actions/cache@") === true);
    const cache = steps[cacheIndex];

    it("restores and saves the caller's paths before the install, only when it names some", () => {
      expect(cache?.uses).toBe("actions/cache@v6");
      expect(cache?.if).toBe("inputs.static-cache-paths != ''");
      expect(cache?.with?.path).toBe("${{ inputs.static-cache-paths }}");
      expect(cacheIndex).toBeGreaterThan(steps.findIndex((step) => step.uses?.startsWith("actions/setup-node@") === true));
      expect(cacheIndex).toBeLessThan(steps.indexOf(findNamedStep(jobs.static, "Install")));
    });

    it("keys an entry on the OS, the lockfiles and the commit, and restores by the lockfile prefix", () => {
      const prefix = "softure-static-${{ runner.os }}-${{ hashFiles('package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock') }}-";
      expect(cache?.with?.key).toBe(`${prefix}\${{ needs.prepare.outputs.sha || github.sha }}`);
      expect(cache?.with?.["restore-keys"]).toBe(prefix);
    });

    it("is the only cache, and unit has none", () => {
      expect(steps.filter((step) => step.uses?.startsWith("actions/cache@") === true)).toHaveLength(1);
      expect((jobs.unit?.steps ?? []).some((step) => step.uses?.startsWith("actions/cache@") === true)).toBe(false);
    });
  });
});

describe("deploy-release-image.yml (issue #406)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-release-image.yml"));
  const call = getWorkflowCall(workflow) as WorkflowCall & { outputs?: Record<string, { value?: string }> };
  const job = workflow.jobs.build;
  const inputStep = findNamedStep(job, "Check the inputs");
  const digestStep = findNamedStep(job, "Image by digest");
  const SHA = "0123456789abcdef0123456789abcdef01234567";
  const DEFAULTS = { REF: SHA, IMAGE: "", BUILD_CONTEXT: ".", DOCKERFILE: "Dockerfile", REPOSITORY: "Acme/App" };

  it("builds one commit in one job, the only one that may write packages", () => {
    expect(call.inputs?.ref?.required).toBe(true);
    expect(Object.keys(workflow.jobs)).toEqual(["build"]);
    expect(job?.permissions).toEqual({ contents: "read", packages: "write" });
    expect(call.outputs?.["prebuilt-image"]?.value).toBe("${{ jobs.build.outputs.prebuilt-image }}");
  });

  it("checks the inputs first and names the image <image>:sha-<sha>", () => {
    expect(job?.steps?.[0]).toBe(inputStep);
    const result = runScript(inputStep.run ?? "", DEFAULTS);
    expect(result.status).toBe(0);
    expect(result.output).toBe(`image=ghcr.io/acme/app\ntagged=ghcr.io/acme/app:sha-${SHA}\n`);
    const own = runScript(inputStep.run ?? "", { ...DEFAULTS, IMAGE: "ghcr.io/acme/web" });
    expect(own.output).toBe(`image=ghcr.io/acme/web\ntagged=ghcr.io/acme/web:sha-${SHA}\n`);
  });

  it.each([
    ["REF", "v2026.10.12", "Input ref is not valid"],
    ["REF", SHA.slice(0, 7), "Input ref is not valid"],
    ["IMAGE", "ghcr.io/Acme/App:latest", "Input image is not valid"],
    ["BUILD_CONTEXT", "../app", "Input context is not valid"],
    ["DOCKERFILE", "/Dockerfile", "Input dockerfile is not valid"],
  ])("refuses %s=%s", (name, value, message) => {
    const refused = runScript(inputStep.run ?? "", { ...DEFAULTS, [name]: value });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain(`::error::${message}`);
    expect(refused.output).toBe("");
  });

  it("checks out the commit without credentials and pushes the checked tag with the build arguments", () => {
    const checkout = (job?.steps ?? []).find((step) => step.uses?.startsWith("actions/checkout@") === true);
    expect(checkout?.with).toMatchObject({ ref: "${{ inputs.ref }}", "persist-credentials": false });
    const push = (job?.steps ?? []).find((step) => step.uses?.startsWith("docker/build-push-action@") === true);
    expect(push?.with).toMatchObject({ push: true, tags: "${{ steps.ref.outputs.tagged }}", "build-args": "${{ inputs.build-args }}" });
  });

  it("hands the image on by digest, the form deploy-app.yml's prebuilt-image takes", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    const env = { IMAGE: "ghcr.io/acme/app", IMAGE_REF: `ghcr.io/acme/app:sha-${SHA}`, DIGEST: digest };
    const result = runScript(digestStep.run ?? "", env);
    expect(result.status).toBe(0);
    expect(result.output).toBe(`prebuilt-image=ghcr.io/acme/app@${digest}\n`);
    const refused = runScript(digestStep.run ?? "", { ...env, DIGEST: "" });
    expect(refused.status).toBe(1);
    expect(refused.output).toBe("");
    const deployInputStep = findNamedStep(readYaml(join(WORKFLOWS_DIR, "deploy-app.yml")).jobs.check, "Validate inputs");
    expect(deployInputStep.run).toContain('[[ ! "$PREBUILT_IMAGE" =~ ^(.+)@sha256:[0-9a-f]{64}$ ]]');
  });
});

describe("deploy-release-notes.yml (issue #406)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-release-notes.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const job = workflow.jobs.notes;
  const checkStep = findNamedStep(job, "Check the inputs");
  const editStep = findNamedStep(job, "Replace the release body");
  // The fake gh records its arguments, then the file after --notes-file, byte for byte.
  // `gh release view` prints the fixture $RUNNER_TEMP/current-body as is and records that it ran.
  const FAKE_GH = `#!/usr/bin/env bash
if [ "$1 $2" = "release view" ]; then
  printf '%s\\n' "$*" > "$RUNNER_TEMP/gh-view-args"
  cat "$RUNNER_TEMP/current-body"
  exit 0
fi
printf '%s\\n' "$*" > "$RUNNER_TEMP/gh-args"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--notes-file" ]; then cat "$2" > "$RUNNER_TEMP/gh-notes"; fi
  shift
done
`;

  it("takes a required tag and body, and grants contents: write to its one job only", () => {
    expect(inputs).toMatchObject({ tag: { required: true }, body: { required: true } });
    expect(inputs["keep-report"]).toMatchObject({ type: "boolean", required: false, default: false });
    expect(workflow.permissions).toEqual({});
    expect(job?.permissions).toEqual({ contents: "write" });
    expect(Object.keys(workflow.jobs)).toEqual(["notes"]);
  });

  it.each(["v2026.10.12", "v2026.10.12-2", "deploy@0.1.10"])("accepts the tag %s", (tag) => {
    expect(runScript(checkStep.run ?? "", { TAG: tag, BODY: "Notes" }).status).toBe(0);
  });

  it.each([
    ["", "Notes", "Input tag is not valid"],
    ["v1 2", "Notes", "Input tag is not valid"],
    ["../x", "Notes", "Input tag is not valid"],
    ["v2026.10.12", "", "Input body is empty"],
    ["v2026.10.12", " \n\t", "Input body is empty"],
  ])("refuses tag=%j body=%j", (tag, body, message) => {
    const refused = runScript(checkStep.run ?? "", { TAG: tag, BODY: body });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain(`::error::${message}`);
  });

  it("refuses a body that carries a softure-deploy section when keep-report is on, and allows it when off", () => {
    const body = "Notes\n\n<!-- softure-deploy:release-notes -->\nx\n<!-- /softure-deploy:release-notes -->\n";
    const refused = runScript(checkStep.run ?? "", { TAG: "v2026.10.12", BODY: body, KEEP_REPORT: "true" });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toContain("::error::Input body carries a softure-deploy section");
    expect(runScript(checkStep.run ?? "", { TAG: "v2026.10.12", BODY: body, KEEP_REPORT: "false" }).status).toBe(0);
  });

  it("replaces the body of the tag's release with the text byte for byte", () => {
    expect(editStep.env).toMatchObject({ TAG: "${{ inputs.tag }}", BODY: "${{ inputs.body }}", GH_TOKEN: "${{ github.token }}" });
    const body = "## Notes\n\n- `$(id)` and $HOME stay text\n";
    const script = `${editStep.run ?? ""}\ncp "$RUNNER_TEMP/gh-args" "$RUNNER_TEMP/gh-notes" "$OUT_DIR/"`;
    const outDir = mkdtempSync(join(tmpdir(), "deploy-notes-"));
    try {
      const result = runScript(script, { TAG: "v2026.10.12", BODY: body, GH_TOKEN: "token", OUT_DIR: outDir }, { bin: { gh: FAKE_GH } });
      expect(result.status).toBe(0);
      expect(readFileSync(join(outDir, "gh-args"), "utf8")).toMatch(/^release edit v2026\.10\.12 --repo acme\/app --notes-file \S+release-notes\.md\n$/);
      expect(readFileSync(join(outDir, "gh-notes"), "utf8")).toBe(body);
      expect(result.summary).toContain("v2026.10.12");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  // Runs the edit step against a release whose current body is `current`; returns the written body and whether
  // `gh release view` ran.
  function editRelease(body: string, current: string, keepReport: string): { status: number | null; notes: string; viewed: boolean; summary: string } {
    const outDir = mkdtempSync(join(tmpdir(), "deploy-notes-"));
    try {
      const fixture = join(outDir, "fixture");
      writeFileSync(fixture, current);
      const script = `cp "$FIXTURE" "$RUNNER_TEMP/current-body"\n${editStep.run ?? ""}\ncp "$RUNNER_TEMP/gh-notes" "$OUT_DIR/"\nif [ -f "$RUNNER_TEMP/gh-view-args" ]; then cp "$RUNNER_TEMP/gh-view-args" "$OUT_DIR/"; fi`;
      const env = { TAG: "v2026.10.12", BODY: body, KEEP_REPORT: keepReport, GH_TOKEN: "token", OUT_DIR: outDir, FIXTURE: fixture };
      const result = runScript(script, env, { bin: { gh: FAKE_GH } });
      const viewArgs = join(outDir, "gh-view-args");
      const viewed = existsSync(viewArgs);
      if (viewed) expect(readFileSync(viewArgs, "utf8")).toBe("release view v2026.10.12 --repo acme/app --json body --template {{.body}}\n");
      return { status: result.status, notes: readFileSync(join(outDir, "gh-notes"), "utf8"), viewed, summary: result.summary };
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }

  const SECTIONS =
    "<!-- softure-deploy:release-notes -->\n## What's in\n\n- `$(id)` stays text\n<!-- /softure-deploy:release-notes -->\n\n" +
    "<!-- softure-deploy:status -->\nDeployed\n<!-- /softure-deploy:status -->\n\n";

  it("with keep-report, writes the body and then the current body from the first softure-deploy marker, byte for byte", () => {
    const edited = editRelease("New owner text\n\n", `Old owner text\n\n${SECTIONS}`, "true");
    expect(edited.status).toBe(0);
    expect(edited.viewed).toBe(true);
    expect(edited.notes).toBe(`New owner text\n\n${SECTIONS}`);
    expect(edited.summary).toContain("softure-deploy sections were kept");
  });

  it("with keep-report and a current body without a marker, replaces the whole body as before", () => {
    const edited = editRelease("New owner text", "Old owner text only\n", "true");
    expect(edited.status).toBe(0);
    expect(edited.viewed).toBe(true);
    expect(edited.notes).toBe("New owner text");
    expect(edited.summary).toContain("no softure-deploy section");
  });

  it.each(["false", ""])("with keep-report=%j, never reads the release and replaces the whole body", (keepReport) => {
    const edited = editRelease("New owner text", `Old owner text\n\n${SECTIONS}`, keepReport);
    expect(edited.status).toBe(0);
    expect(edited.viewed).toBe(false);
    expect(edited.notes).toBe("New owner text");
  });

  it("passes keep-report to both steps", () => {
    expect(checkStep.env).toMatchObject({ KEEP_REPORT: "${{ inputs.keep-report }}" });
    expect(editStep.env).toMatchObject({ KEEP_REPORT: "${{ inputs.keep-report }}" });
  });
});

describe("the example checks caller (issue #406)", () => {
  const caller = readYaml(EXAMPLE_CHECKS_CALLER) as Workflow & { concurrency?: { group?: string; "cancel-in-progress"?: boolean } };
  const job = caller.jobs.checks as Job;
  const called = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-release-checks.yml")));

  it("runs on pull requests, their labels, and on demand", () => {
    expect(caller.on).toEqual({ pull_request: { types: ["opened", "synchronize", "reopened", "labeled"] }, workflow_dispatch: null });
    expect(caller.concurrency).toEqual({ group: "checks-${{ github.event.pull_request.number || github.ref }}", "cancel-in-progress": true });
  });

  it("calls the checks workflow with one uses: line, read-only, and passes only declared inputs", () => {
    expect(Object.keys(caller.jobs)).toEqual(["checks"]);
    expect(job.uses).toBe("SOFTURE/AI/.github/workflows/deploy-release-checks.yml@master");
    expect(caller.permissions).toEqual({ contents: "read" });
    const declared = Object.keys(called.inputs ?? {});
    for (const key of Object.keys(job.with ?? {})) expect(declared).toContain(key);
    expect(job.with?.tag).toBeUndefined();
  });

  it("runs the unit tests on demand or with the run-tests label only, and Next's type generation before tsc", () => {
    expect(job.with?.unit).toBe("${{ github.event_name == 'workflow_dispatch' || contains(github.event.pull_request.labels.*.name, 'run-tests') }}");
    expect(String(job.with?.["static-command"])).toMatch(/^npx next typegen && npx tsc --noEmit/);
  });
});

describe("the example release-notes caller (issue #406)", () => {
  const caller = readYaml(EXAMPLE_NOTES_CALLER);
  const job = caller.jobs.notes as Job;

  it("is started by hand or by an agent with a tag and a body", () => {
    expect(Object.keys(caller.on)).toEqual(["workflow_dispatch"]);
    const dispatch = caller.on.workflow_dispatch as { inputs?: Record<string, WorkflowInput> };
    expect(dispatch.inputs?.tag?.required).toBe(true);
    expect(dispatch.inputs?.body?.required).toBe(true);
    expect(dispatch.inputs?.["keep-report"]).toMatchObject({ type: "boolean", required: false, default: true });
  });

  it("calls the release-notes workflow with both inputs and grants contents: write only", () => {
    expect(job.uses).toBe("SOFTURE/AI/.github/workflows/deploy-release-notes.yml@master");
    expect(job.with).toEqual({ tag: "${{ inputs.tag }}", body: "${{ inputs.body }}", "keep-report": "${{ inputs.keep-report }}" });
    expect(caller.permissions).toEqual({ contents: "write" });
  });
});
