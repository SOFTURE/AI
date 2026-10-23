import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
  on: Record<
    string,
    {
      inputs?: Record<
        string,
        { type?: string; default?: unknown; required?: boolean }
      >;
    } | null
  >;
  jobs: Record<string, Job>;
}

function readWorkflow(name: string): Workflow {
  return parse(readFileSync(join(WORKFLOWS_DIR, name), "utf8")) as Workflow;
}

const REUSABLE = readdirSync(WORKFLOWS_DIR).filter((name) => {
  const workflow = readWorkflow(name);
  return (
    Object.keys(workflow.on).length === 1 && "workflow_call" in workflow.on
  );
});

function getCheckStep(name: string, jobId: string): Step | undefined {
  return readWorkflow(name).jobs[jobId]?.steps?.[0];
}

const FIRST_CHECK = getCheckStep("deploy-release-checks.yml", "static");

function runCheck(value: string): { status: number | null; output: string } {
  const result = spawnSync(
    "bash",
    ["-e", "-c", FIRST_CHECK?.run ?? "exit 99"],
    {
      env: { PATH: process.env.PATH, RUNS_ON: value },
      encoding: "utf8",
    },
  );
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

// The GitHub CLI on a self-hosted runner (issue #686). GitHub's hosted images ship `gh`, a self-hosted runner may not:
// every job that calls it sets it up right after the runner check, with the one shared step, which installs a pinned,
// checksum-verified copy into $RUNNER_TEMP when the runner has none.

const GH_STEP_NAME = "Set up the GitHub CLI";
const CALLS_GH = /(^|[\s;&|(!])gh\s+(api|release|workflow|run)\b/m;

function callsGh(job: Job): boolean {
  return (job.steps ?? []).some(
    (step) => step.name !== GH_STEP_NAME && CALLS_GH.test(step.run ?? ""),
  );
}

const GH_JOBS = REUSABLE.flatMap((name) =>
  Object.entries(readWorkflow(name).jobs)
    .filter(([, job]) => callsGh(job))
    .map(([id]) => `${name} → ${id}`),
);

const GH_STEP = readWorkflow("deploy-cut-release.yml").jobs.cut?.steps?.[1];
const GH_SCRIPT = GH_STEP?.run ?? "exit 99";

describe("the jobs that call gh", () => {
  it("are the five the issue's workflows run gh in", () => {
    expect(GH_JOBS.sort()).toEqual([
      "deploy-cancel-run.yml → cancel",
      "deploy-cut-release.yml → cut",
      "deploy-integration.yml → record",
      "deploy-release-notes.yml → notes",
      "deploy-report.yml → report",
    ]);
  });

  it.each(REUSABLE)(
    "%s sets gh up second in exactly those jobs, with the one shared step",
    (name) => {
      for (const [id, job] of Object.entries(readWorkflow(name).jobs)) {
        const steps = job.steps ?? [];
        if (callsGh(job)) {
          expect(steps[1], `${name} → ${id}`).toEqual(GH_STEP);
        } else {
          expect(
            steps.some((step) => step.name === GH_STEP_NAME),
            `${name} → ${id}`,
          ).toBe(false);
        }
      }
    },
  );
});

describe("the GitHub CLI setup step", () => {
  const PINNED_SUM =
    /fdd768eb70f6409f80fcfa9f3a1c0adf0fc98d827ab3ce0bed2ac22762c5d786/;
  const VERSION = /^\s*version=([0-9.]+)$/m.exec(GH_SCRIPT)?.[1] ?? "";

  interface Sandbox {
    root: string;
    bin: string;
    temp: string;
    githubPath: string;
  }

  // A PATH of its own: only the tools the step uses, so the machine's own gh is never found.
  function makeSandbox(
    tools: string[] = [
      "tar",
      "gzip",
      "mkdir",
      "rm",
      "cut",
      "cp",
      "sha256sum",
      "shasum",
      "perl",
    ],
  ): Sandbox {
    const root = mkdtempSync(join(tmpdir(), "gh-setup-"));
    const bin = join(root, "bin");
    const temp = join(root, "temp");
    mkdirSync(bin);
    mkdirSync(temp);
    for (const tool of tools) {
      const found = spawnSync("bash", ["-c", `command -v ${tool}`], {
        encoding: "utf8",
      }).stdout.trim();
      if (found) symlinkSync(found, join(bin, tool));
    }
    const githubPath = join(root, "github-path");
    writeFileSync(githubPath, "");
    return { root, bin, temp, githubPath };
  }

  function writeTool(sandbox: Sandbox, name: string, body: string): void {
    const file = join(sandbox.bin, name);
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
  }

  // A stand-in for curl that "downloads" an archive laid out like the real one, gh_<v>_linux_<arch>/bin/gh.
  function writeArchiveCurl(sandbox: Sandbox, arch: string): string {
    const name = `gh_${VERSION}_linux_${arch}`;
    const source = join(sandbox.root, "source");
    mkdirSync(join(source, name, "bin"), { recursive: true });
    writeFileSync(
      join(source, name, "bin/gh"),
      `#!/bin/bash\necho "gh version ${VERSION}"\n`,
    );
    chmodSync(join(source, name, "bin/gh"), 0o755);
    const archive = join(sandbox.root, "gh.tar.gz");
    spawnSync("tar", ["-czf", archive, "-C", source, name]);
    writeFileSync(join(sandbox.root, "curl-args"), "");
    writeTool(
      sandbox,
      "curl",
      `echo "$*" > "${join(sandbox.root, "curl-args")}"\nwhile [ $# -gt 0 ]; do if [ "$1" = -o ]; then cp "${archive}" "$2"; fi; shift; done`,
    );
    const hash = spawnSync(
      "bash",
      [
        "-c",
        `(sha256sum "$1" 2> /dev/null || shasum -a 256 "$1") | cut -d " " -f 1`,
        "_",
        archive,
      ],
      {
        encoding: "utf8",
      },
    );
    return hash.stdout.trim();
  }

  function runStep(
    sandbox: Sandbox,
    options: { script?: string; os?: string; arch?: string } = {},
  ) {
    const result = spawnSync(
      "/bin/bash",
      ["-e", "-c", options.script ?? GH_SCRIPT],
      {
        env: {
          PATH: sandbox.bin,
          RUNNER_OS: options.os ?? "Linux",
          RUNNER_ARCH: options.arch ?? "X64",
          RUNNER_TEMP: sandbox.temp,
          GITHUB_PATH: sandbox.githubPath,
        },
        encoding: "utf8",
      },
    );
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      githubPath: readFileSync(sandbox.githubPath, "utf8"),
    };
  }

  it("is named, takes no input and no token, and pins a version and both Linux checksums", () => {
    expect(GH_STEP?.name).toBe(GH_STEP_NAME);
    expect(GH_STEP?.env).toBeUndefined();
    expect(GH_SCRIPT).not.toContain("${{");
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(GH_SCRIPT).toMatch(PINNED_SUM);
    expect(GH_SCRIPT).toMatch(
      /7f322df34e624d14f5ec0c4acb121fd6dfa14392fdbbd1066aa8e0a05ac3721e/,
    );
  });

  it("does nothing when the runner has gh", () => {
    const sandbox = makeSandbox();
    writeTool(sandbox, "gh", "exit 0");
    writeTool(sandbox, "curl", "exit 9");
    expect(runStep(sandbox)).toEqual({ status: 0, output: "", githubPath: "" });
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it.each([
    ["macOS", "ARM64"],
    ["Windows", "X64"],
    ["Linux", "ARM"],
  ])("refuses %s %s, saying to install gh on the runner", (os, arch) => {
    const sandbox = makeSandbox();
    const result = runStep(sandbox, { os, arch });
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      `::error::The GitHub CLI (gh) is not on this runner and cannot be installed on ${os} ${arch}`,
    );
    expect(result.githubPath).toBe("");
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it("names the tools it needs and does not find", () => {
    const sandbox = makeSandbox(["mkdir", "rm", "cut"]);
    const result = runStep(sandbox);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "::error::The GitHub CLI (gh) is not on this runner, and installing it needs: curl tar",
    );
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it("fails with the address when the download fails", () => {
    const sandbox = makeSandbox();
    writeTool(sandbox, "curl", "exit 22");
    const result = runStep(sandbox);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      `::error::Downloading the GitHub CLI failed: https://github.com/cli/cli/releases/download/v${VERSION}/gh_${VERSION}_linux_amd64.tar.gz`,
    );
    expect(result.githubPath).toBe("");
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it("refuses an archive whose checksum is not the pinned one, and installs nothing", () => {
    const sandbox = makeSandbox();
    writeArchiveCurl(sandbox, "amd64");
    const result = runStep(sandbox);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      `::error::The GitHub CLI archive gh_${VERSION}_linux_amd64.tar.gz does not match its pinned SHA-256`,
    );
    expect(result.githubPath).toBe("");
    expect(
      existsSync(
        join(sandbox.temp, `gh-${VERSION}`, `gh_${VERSION}_linux_amd64`),
      ),
    ).toBe(false);
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it.each([
    ["X64", "amd64", PINNED_SUM],
    [
      "ARM64",
      "arm64",
      /7f322df34e624d14f5ec0c4acb121fd6dfa14392fdbbd1066aa8e0a05ac3721e/,
    ],
  ])(
    "on %s unpacks the matching %s archive into RUNNER_TEMP and puts its bin on GITHUB_PATH",
    (arch, asset, pinned) => {
      const sandbox = makeSandbox();
      const sum = writeArchiveCurl(sandbox, asset);
      const result = runStep(sandbox, {
        arch,
        script: GH_SCRIPT.replace(pinned, sum),
      });
      const bin = join(
        sandbox.temp,
        `gh-${VERSION}`,
        `gh_${VERSION}_linux_${asset}`,
        "bin",
      );
      expect(result.status, result.output).toBe(0);
      expect(result.githubPath).toBe(`${bin}\n`);
      expect(result.output).toContain(`gh version ${VERSION}`);
      expect(readFileSync(join(sandbox.root, "curl-args"), "utf8")).toContain(
        `https://github.com/cli/cli/releases/download/v${VERSION}/gh_${VERSION}_linux_${asset}.tar.gz`,
      );
      rmSync(sandbox.root, { recursive: true, force: true });
    },
  );
});
