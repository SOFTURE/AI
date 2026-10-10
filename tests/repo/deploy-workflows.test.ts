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
const CALLER_PREFIX = "SOFTURE/AI/.github/workflows/";

interface WorkflowInput {
  required?: boolean;
  default?: unknown;
}

interface Step {
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
    expect(DEPLOY_WORKFLOWS).toContain("deploy-cut-release.yml");
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

describe("the verify job of deploy-app.yml", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const steps = workflow.jobs.verify?.steps ?? [];
  const verifyIndex = steps.findIndex((step) => (step.run ?? "").includes("softure-deploy verify"));
  const verifyStep = steps[verifyIndex];
  const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@") === true);

  it("reads deploy.json by default, the file softure-deploy init writes", () => {
    expect(inputs["deploy-config"]?.default).toBe("deploy.json");
  });

  it("waits for the health route before anything else", () => {
    expect(steps[0]?.run).toContain("HEALTH_PATH");
    expect(verifyIndex).toBeGreaterThan(0);
  });

  it("runs softure-deploy verify on the app URL with the app's config from the pinned CLI", () => {
    expect(verifyStep?.run).toContain('softure-deploy verify "$APP_URL" --config="$DEPLOY_CONFIG"');
    expect(verifyStep?.run).toContain("--package=@softure-ai/deploy@$DEPLOY_CLI_VERSION");
    expect(verifyStep?.env).toMatchObject({
      APP_URL: "${{ inputs.app-url }}",
      DEPLOY_CONFIG: "${{ inputs.deploy-config }}",
      DEPLOY_CLI_VERSION: "${{ inputs.deploy-cli-version }}",
    });
  });

  it("skips the config steps when deploy-config is empty", () => {
    const configSteps = steps.slice(1);
    expect(configSteps.length).toBeGreaterThan(0);
    for (const step of configSteps) expect(step.if).toBe("inputs.deploy-config != ''");
  });

  it("adds --origin only when the optional origin-address secret is set (DF-13)", () => {
    const secrets = getWorkflowCall(workflow).secrets ?? {};
    expect(secrets["origin-address"]?.required).toBe(false);
    expect(verifyStep?.env).toMatchObject({ ORIGIN_ADDRESS: "${{ secrets.origin-address }}" });
    const binDir = mkdtempSync(join(tmpdir(), "deploy-verify-"));
    try {
      // A stand-in npx prints the arguments it would have run the CLI with, one per line.
      writeFileSync(join(binDir, "npx"), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
      const run = (origin: string) =>
        spawnSync("bash", ["-e", "-c", verifyStep?.run ?? ""], {
          encoding: "utf8",
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            APP_URL: "https://example.com",
            DEPLOY_CONFIG: "deploy.json",
            DEPLOY_CLI_VERSION: "0.1.3",
            ORIGIN_ADDRESS: origin,
          },
        }).stdout;
      const base = ["--yes", "--package=@softure-ai/deploy@0.1.3", "softure-deploy", "verify", "https://example.com", "--config=deploy.json"];
      expect(run("").split("\n")).toEqual([...base, ""]);
      expect(run("203.0.113.7").split("\n")).toEqual([...base, "--origin=203.0.113.7", ""]);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("checks out only the config file at the tag, without credentials", () => {
    expect(checkout?.with).toEqual({
      ref: "${{ inputs.tag }}",
      "persist-credentials": false,
      "sparse-checkout": "/${{ inputs.deploy-config }}",
      "sparse-checkout-cone-mode": false,
    });
    expect(workflow.jobs.verify?.permissions).toEqual({ contents: "read" });
  });
});

describe("the deploy job of deploy-app.yml", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const inputs = getWorkflowCall(workflow).inputs ?? {};
  const steps = workflow.jobs.deploy?.steps ?? [];
  const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@") === true);
  const packIndex = steps.findIndex((step) => step.name === "Pack the release");
  const sendIndex = steps.findIndex((step) => step.name === "Send the release to the server");
  const cleanup = steps.at(-1);

  it("ships init's server script by default", () => {
    expect(inputs["server-script"]?.default).toBe("docker/server/deploy.sh");
  });

  it("checks out only the server files the check job anchored, at the tag, without credentials", () => {
    expect(checkout?.with).toEqual({
      ref: "${{ inputs.tag }}",
      "persist-credentials": false,
      "sparse-checkout": "${{ needs.check.outputs.server-files }}",
      "sparse-checkout-cone-mode": false,
    });
    expect(workflow.jobs.check?.steps?.[0]?.run).toContain('echo "/$prod_dir/"');
  });

  it("packs the release before it sends it, and sends the archive in the one SSH call", () => {
    expect(packIndex).toBeGreaterThan(0);
    expect(sendIndex).toBeGreaterThan(packIndex);
    const send = steps[sendIndex]?.run ?? "";
    expect(send.match(/\bssh\b -i/g)).toHaveLength(1);
    expect(send).toMatch(/"\$REMOTE_COMMAND \$TAG" < release\.tar\.gz \| tee "\$output"$/m);
    expect(send).toContain("grep -qx 'result|ok' \"$output\"");
  });

  it("may read packages, for the registry token it sends, and passes that token only when registry-token is on", () => {
    expect(workflow.jobs.deploy?.permissions).toEqual({ contents: "read", packages: "read" });
    expect(inputs["registry-token"]).toMatchObject({ type: "boolean", default: true });
    expect(steps[packIndex]?.env?.REGISTRY_TOKEN).toBe("${{ inputs.registry-token && github.token || '' }}");
  });

  it("renders app-vars and compares build-args, both read from env", () => {
    const render = steps.find((step) => step.name === "Render .env.prod");
    expect(render?.env).toMatchObject({ APP_VARS: "${{ inputs.app-vars }}", BUILD_ARGS: "${{ inputs.build-args }}" });
    expect(inputs["app-vars"]).toMatchObject({ type: "string", default: "{}" });
  });

  it("removes the archive with the key, whatever happened", () => {
    expect(cleanup?.if).toBe("always()");
    expect(cleanup?.run).toContain("release.tar.gz");
    expect(cleanup?.run).toContain(".env.prod");
  });
});

describe("the summary job of deploy-app.yml (DF-10)", () => {
  const workflow = readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"));
  const summary = workflow.jobs.summary as Job & { needs?: unknown; if?: string };
  const deploySteps = workflow.jobs.deploy?.steps ?? [];
  const keep = deploySteps.find((step) => step.name === "Keep the server's step lines");

  it("keeps the server's step and result lines after the send, whatever happened", () => {
    const sendIndex = deploySteps.findIndex((step) => step.name === "Send the release to the server");
    expect(deploySteps.indexOf(keep as Step)).toBeGreaterThan(sendIndex);
    expect(keep?.if).toBe("always()");
    expect(keep?.run).toContain("grep -E '^(step|result)\\|' \"$RUNNER_TEMP/deploy-output.txt\"");
    expect((workflow.jobs.deploy as Job & { outputs?: Record<string, string> }).outputs).toEqual({
      "server-lines": "${{ steps.server-lines.outputs.lines }}",
    });
    expect(deploySteps.at(-1)?.run).toContain('"$RUNNER_TEMP/deploy-output.txt"');
  });

  it("runs after every job whatever their results, with no permissions", () => {
    expect(summary.needs).toEqual(["check", "build", "deploy", "verify"]);
    expect(summary.if).toBe("${{ always() }}");
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

describe("the example caller workflow", () => {
  const caller = readYaml(EXAMPLE_CALLER);
  const deployJob = caller.jobs.deploy as Job;
  const reportJob = caller.jobs.report as Job & { needs?: unknown; if?: string };

  it("calls the deploy workflow, then the report workflow, each with one uses: line", () => {
    expect(Object.keys(caller.jobs)).toEqual(["deploy", "report"]);
    expect(deployJob.uses).toMatch(/^SOFTURE\/AI\/\.github\/workflows\/deploy-app\.yml@master$/);
    expect(reportJob.uses).toMatch(/^SOFTURE\/AI\/\.github\/workflows\/deploy-report\.yml@master$/);
  });

  it("grants the deploy jobs what they need and nothing to write code; contents: write to the report job only", () => {
    expect(caller.permissions).toEqual({ contents: "read", packages: "write" });
    expect(deployJob.permissions).toBeUndefined();
    expect(reportJob.permissions).toEqual({ contents: "write" });
  });

  it("reports after the deploy whatever its result, on the same tag", () => {
    expect(reportJob.needs).toBe("deploy");
    expect(reportJob.if).toBe("${{ always() }}");
    expect(reportJob.with?.tag).toBe(deployJob.with?.tag);
  });

  describe.each(["deploy", "report"])("the %s job", (id) => {
    const job = caller.jobs[id] as Job;
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
      const passed = Object.keys((job.secrets ?? {}) as Record<string, unknown>);
      expect(passed.sort()).toEqual(Object.keys(declared).sort());
    });
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
      "actions/upload-artifact@v7",
      "Wait for the health route (end-to-end test)",
      "Verify the routes in deploy.json (end-to-end test)",
      "Show the server's log and the stack (end-to-end test)",
      "Remove the key, .env.prod and the release archive",
    ]);
    for (const step of testOnly.slice(0, -1)) expect(step.if ?? "", step.name ?? step.uses).toMatch(/\binputs\.e2e\b/);
  });

  it("sends with the production ssh command, taking the throwaway server's address and keys only under inputs.e2e", () => {
    const send = deploySteps.find((step) => step.name === "Send the release to the server");
    expect(send?.if).toBeUndefined();
    expect(send?.env).toMatchObject({
      SSH_HOST: "${{ inputs.e2e && steps.e2e-server.outputs.host || inputs.secrets-from-environment && secrets[inputs.ssh-host-secret] || secrets.ssh-host }}",
      SSH_USER: "${{ inputs.e2e && steps.e2e-server.outputs.user || inputs.secrets-from-environment && secrets[inputs.ssh-user-secret] || secrets.ssh-user }}",
      SSH_PRIVATE_KEY: "${{ inputs.e2e && steps.e2e-server.outputs.private-key || inputs.secrets-from-environment && secrets[inputs.ssh-private-key-secret] || secrets.ssh-private-key }}",
      SSH_KNOWN_HOSTS: "${{ inputs.e2e && steps.e2e-server.outputs.known-hosts || inputs.secrets-from-environment && secrets[inputs.ssh-known-hosts-secret] || secrets.ssh-known-hosts }}",
    });
  });

  it("renders .env.prod with the tag's CLI only under inputs.e2e", () => {
    const render = deploySteps.find((step) => step.name === "Render .env.prod");
    expect(render?.env?.DEPLOY_CLI).toBe(
      "${{ inputs.e2e && format('{0}/.softure-ai-cli/tools/deploy/dist/cli/main.js', github.workspace) || '' }}",
    );
    expect(render?.run).toContain("--package=@softure-ai/deploy@${process.env.DEPLOY_CLI_VERSION}");
  });

  it("runs the verify job's wait in the deploy job, and verify with the tag's CLI trusting the run's CA", () => {
    const verifySteps = workflow.jobs.verify?.steps ?? [];
    const wait = verifySteps.find((step) => step.name === "Wait for the health route");
    const e2eWait = deploySteps.find((step) => step.name === "Wait for the health route (end-to-end test)");
    expect(e2eWait?.run).toBe(wait?.run);
    expect(e2eWait?.env).toEqual(wait?.env);
    const e2eVerify = deploySteps.find((step) => step.name === "Verify the routes in deploy.json (end-to-end test)");
    expect(e2eVerify?.if).toBe("inputs.e2e && inputs.deploy-config != ''");
    expect(e2eVerify?.env).toMatchObject({ NODE_EXTRA_CA_CERTS: "${{ steps.e2e-server.outputs.ca-file }}" });
    expect(e2eVerify?.run).toBe('node .softure-ai-cli/tools/deploy/dist/cli/main.js verify "$APP_URL" --config="$DEPLOY_CONFIG"');
    const verify = verifySteps.find((step) => step.name === "Verify the routes in deploy.json");
    expect(verify?.run).toContain('softure-deploy verify "$APP_URL" --config="$DEPLOY_CONFIG"');
  });

  it("gives each test run its own deploy concurrency group and skips verify", () => {
    const deployJob = workflow.jobs.deploy as Job & { concurrency?: { group?: string } };
    expect(deployJob.concurrency?.group).toBe(
      "deploy-app-${{ github.repository }}-${{ inputs.environment }}${{ inputs.e2e && format('-e2e-{0}', github.run_id) || '' }}",
    );
    expect((workflow.jobs.verify as Job & { if?: string }).if).toBe("${{ !inputs.e2e }}");
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
    // skipped). None is `required: true` (secrets-from-environment passes none); the check job asks for them.
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
    expect(workflow.jobs.test?.permissions).toEqual({ contents: "read" });
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

  it("grants what the record job needs and nothing more", () => {
    expect(caller.permissions).toEqual({ contents: "write" });
  });
});
