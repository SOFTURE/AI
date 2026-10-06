import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    const inputs = getWorkflowCall(readYaml(join(WORKFLOWS_DIR, "deploy-app.yml"))).inputs ?? {};
    expect(inputs["deploy-cli-version"]?.default).toBe(pkg.version);
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

  it("removes the archive with the key, whatever happened", () => {
    expect(cleanup?.if).toBe("always()");
    expect(cleanup?.run).toContain("release.tar.gz");
    expect(cleanup?.run).toContain(".env.prod");
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
          ...env,
        },
      });
      return { status: result.status, stdout: result.stdout };
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }

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

  it("runs every test-only step of the deploy job under inputs.e2e", () => {
    const testOnly = deploySteps.filter((step) =>
      /\.softure-ai-cli|e2e-server|upload-artifact/.test(
        `${step.uses ?? ""} ${step.run ?? ""} ${step["working-directory"] ?? ""} ${JSON.stringify(step.with ?? {})}`,
      ),
    );
    expect(testOnly.map((step) => step.name ?? step.uses)).toEqual([
      "actions/checkout@v7",
      "Build the deploy CLI from the tag (end-to-end test)",
      "Start the throwaway SSH server (end-to-end test)",
      "actions/upload-artifact@v7",
      "Show the throwaway SSH server's log (end-to-end test)",
      "Remove the key, .env.prod and the release archive",
    ]);
    for (const step of testOnly.slice(0, -1)) expect(step.if ?? "", step.name ?? step.uses).toMatch(/\binputs\.e2e\b/);
  });

  it("sends with the production ssh command, taking the throwaway server's address and keys only under inputs.e2e", () => {
    const send = deploySteps.find((step) => step.name === "Send the release to the server");
    expect(send?.if).toBeUndefined();
    expect(send?.env).toMatchObject({
      SSH_HOST: "${{ inputs.e2e && steps.e2e-server.outputs.host || secrets.ssh-host }}",
      SSH_USER: "${{ inputs.e2e && steps.e2e-server.outputs.user || secrets.ssh-user }}",
      SSH_PRIVATE_KEY: "${{ inputs.e2e && steps.e2e-server.outputs.private-key || secrets.ssh-private-key }}",
      SSH_KNOWN_HOSTS: "${{ inputs.e2e && steps.e2e-server.outputs.known-hosts || secrets.ssh-known-hosts }}",
    });
  });

  it("renders .env.prod with the tag's CLI only under inputs.e2e", () => {
    const render = deploySteps.find((step) => step.name === "Render .env.prod");
    expect(render?.env?.DEPLOY_CLI).toBe(
      "${{ inputs.e2e && format('{0}/.softure-ai-cli/tools/deploy/dist/cli/main.js', github.workspace) || '' }}",
    );
    expect(render?.run).toContain("--package=@softure-ai/deploy@${process.env.DEPLOY_CLI_VERSION}");
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
    expect(job.with).toMatchObject({ tag: "${{ github.sha }}", e2e: true });
  });

  it("passes only declared inputs and secrets, and every required one", () => {
    const declared = Object.keys(called.inputs ?? {});
    for (const key of Object.keys(job.with ?? {})) expect(declared).toContain(key);
    for (const [key, input] of Object.entries(called.inputs ?? {})) {
      if (input.required === true) expect(Object.keys(job.with ?? {})).toContain(key);
    }
    expect(Object.keys(job.secrets as Record<string, unknown>).sort()).toEqual(Object.keys(called.secrets ?? {}).sort());
  });

  it("grants packages: write to the calling job only", () => {
    expect(caller.permissions).toEqual({ contents: "read" });
    expect(job.permissions).toEqual({ contents: "read", packages: "write" });
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

  it("checks the recording against the same files and image it deployed", () => {
    expect(assertStep?.env).toMatchObject({
      COMPOSE_FILE: job.with?.["compose-file"],
      SERVER_SCRIPT: job.with?.["server-script"],
      DEPLOY_CONFIG: job.with?.["deploy-config"],
      TAG: "${{ github.sha }}",
      IMAGE: "${{ needs.deploy.outputs.image }}",
      EXPECTED_IMAGE: job.with?.image,
    });
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
    expect(job.uses).toBe("SOFTURE/AI/.github/workflows/deploy-cut-release.yml@deploy-workflows-v1");
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
