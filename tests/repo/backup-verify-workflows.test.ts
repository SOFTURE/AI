// The weekly off-site backup check (issue #1386) runs in adopting apps: the example of @softure-ai/backup and the
// workflow `softure-deploy init --host=cloudflare` writes. Each script step here runs with bash and a fake `gh` and
// `docker` first on PATH, so no call reaches GitHub or a registry.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

const EXAMPLE_FILE = join(REPO_ROOT, "modules/backup/examples/backup-verify.yml");
const TEMPLATE_FILE = join(REPO_ROOT, "tools/deploy/templates/cloudflare/.github/workflows/backup-verify.yml.tmpl");
const BACKUP_VERSION = (JSON.parse(readFileSync(join(REPO_ROOT, "modules/backup/package.json"), "utf8")) as { version: string })
  .version;

interface Step {
  name?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Workflow {
  permissions: Record<string, string>;
  jobs: { verify: { env?: Record<string, string>; steps: Step[] } };
}

function readWorkflow(file: string): Workflow {
  return parse(readFileSync(file, "utf8")) as Workflow;
}

function findStep(workflow: Workflow, name: string): Step {
  const step = workflow.jobs.verify.steps.find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`no script step "${name}"`);
  return step;
}

/** Records each call; answers `release list` and `issue list` from the environment, refuses an assignee on demand. */
const FAKE_GH = `#!/usr/bin/env bash
echo "gh $*" >> "$FAKE_LOG"
case "$1 $2" in
  "release list") printf '%s\\n' $FAKE_RELEASES ;;
  "issue list") printf '%s\\n' $FAKE_OPEN_ISSUES ;;
  "issue create")
    for arg in "$@"; do
      if [ "$arg" = "--assignee" ] && [ -n "\${FAKE_REFUSE_ASSIGNEE:-}" ]; then echo "could not assign" >&2; exit 1; fi
    done ;;
esac
exit 0
`;

/** Records each call; `manifest inspect` succeeds only for the references in FAKE_IMAGES. */
const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
if [ "$1 $2" = "manifest inspect" ]; then
  for image in $FAKE_IMAGES; do
    if [ "$image" = "$3" ]; then exit 0; fi
  done
  echo "no such manifest: $3" >&2
  exit 1
fi
exit 0
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "backup-verify-"));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin/gh"), FAKE_GH, { mode: 0o755 });
  writeFileSync(join(dir, "bin/docker"), FAKE_DOCKER, { mode: 0o755 });
  writeFileSync(join(dir, "env"), "");
  writeFileSync(join(dir, "log"), "");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

interface RunResult {
  status: number | null;
  stdout: string;
  githubEnv: string;
  calls: string[];
}

function run(step: Step, env: Record<string, string>): RunResult {
  const result = spawnSync("bash", ["-e", "-c", step.run ?? ""], {
    cwd: dir,
    encoding: "utf8",
    env: {
      PATH: `${join(dir, "bin")}:${process.env.PATH ?? ""}`,
      HOME: dir,
      GITHUB_ENV: join(dir, "env"),
      FAKE_LOG: join(dir, "log"),
      FAKE_RELEASES: "",
      FAKE_OPEN_ISSUES: "",
      FAKE_IMAGES: "",
      OWNER: "acme",
      RUN_URL: "https://github.com/acme/app/actions/runs/7",
      ...env,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    githubEnv: readFileSync(join(dir, "env"), "utf8"),
    calls: readFileSync(join(dir, "log"), "utf8").trim().split("\n").filter(Boolean),
  };
}

describe("the backup verify example finds the live release's image", () => {
  const example = readWorkflow(EXAMPLE_FILE);
  const findImage = findStep(example, "Find the live release's image");

  it("names the image without a tag and logs in before the release walk", () => {
    expect(example.jobs.verify.env?.IMAGE).toBe("ghcr.io/acme/app");
    const names = example.jobs.verify.steps.map((step) => step.name);
    expect(names.indexOf("Log in to the registry")).toBeLessThan(names.indexOf("Find the live release's image"));
    expect(names.indexOf("Find the live release's image")).toBeLessThan(names.indexOf("Read the migrations of the live image"));
    expect(findStep(example, "Read the migrations of the live image").run).toContain('docker create "$LIVE_IMAGE"');
  });

  it("skips the release still being cut and takes the newest one whose tag is on the image", () => {
    const result = run(findImage, {
      IMAGE: "ghcr.io/acme/app",
      FAKE_RELEASES: "v1.4.0 v1.3.0 v1.2.0",
      FAKE_IMAGES: "ghcr.io/acme/app:v1.3.0 ghcr.io/acme/app:v1.2.0",
    });
    expect(result.status).toBe(0);
    expect(result.githubEnv).toBe("LIVE_IMAGE=ghcr.io/acme/app:v1.3.0\n");
    expect(result.stdout).toContain("::notice::ghcr.io/acme/app:v1.4.0 is not in the registry");
    expect(result.calls).toEqual([
      "gh release list --exclude-drafts --exclude-pre-releases --limit 20 --json tagName,publishedAt --jq sort_by(.publishedAt) | reverse | .[].tagName",
      "docker manifest inspect ghcr.io/acme/app:v1.4.0",
      "docker manifest inspect ghcr.io/acme/app:v1.3.0",
    ]);
  });

  it("takes the newest release when its image is there", () => {
    const result = run(findImage, {
      IMAGE: "ghcr.io/acme/app",
      FAKE_RELEASES: "v1.4.0 v1.3.0",
      FAKE_IMAGES: "ghcr.io/acme/app:v1.4.0 ghcr.io/acme/app:v1.3.0",
    });
    expect(result.status).toBe(0);
    expect(result.githubEnv).toBe("LIVE_IMAGE=ghcr.io/acme/app:v1.4.0\n");
  });

  it("fails and names the image when no release has one", () => {
    const result = run(findImage, { IMAGE: "ghcr.io/acme/app", FAKE_RELEASES: "v1.4.0" });
    expect(result.status).toBe(1);
    expect(result.githubEnv).toBe("");
    expect(result.stdout).toContain("::error::none of the last 20 published releases has an image in ghcr.io/acme/app");
  });

  it("fails when the repository has no published release", () => {
    const result = run(findImage, { IMAGE: "ghcr.io/acme/app" });
    expect(result.status).toBe(1);
    expect(result.githubEnv).toBe("");
  });

  it("runs the backup CLI of the package version it ships with", () => {
    expect(findStep(example, "Verify the newest off-site copy").run).toContain(
      `npx --yes --package=@softure-ai/backup@${BACKUP_VERSION} softure-backup verify`,
    );
  });
});

describe.each([
  ["the backup example", EXAMPLE_FILE],
  ["the Cloudflare template", TEMPLATE_FILE],
])("%s reports a failed check as an issue", (_label, file) => {
  const workflow = readWorkflow(file);
  const report = findStep(workflow, "Report the failed check");
  const close = findStep(workflow, "Close the reports of earlier failures");

  it("may write issues and runs the report on failure and the close on success, after every other step", () => {
    expect(workflow.permissions.issues).toBe("write");
    expect(report.if).toBe("failure()");
    expect(close.if).toBe("success()");
    expect(workflow.jobs.verify.steps.slice(-2)).toEqual([report, close]);
  });

  it("opens an issue assigned to the owner when none is open", () => {
    const result = run(report, {});
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      'gh label create backup-verify --force --color B60205 --description The weekly off-site backup check failed',
      "gh issue list --label backup-verify --state open --limit 1 --json number --jq .[0].number // empty",
      "gh issue create --title Backup verify failed --label backup-verify --assignee acme --body The weekly off-site backup check failed: https://github.com/acme/app/actions/runs/7",
    ]);
  });

  it("opens the issue without an assignee when the owner cannot be assigned", () => {
    const result = run(report, { FAKE_REFUSE_ASSIGNEE: "1" });
    expect(result.status).toBe(0);
    expect(result.calls.slice(-2)).toEqual([
      "gh issue create --title Backup verify failed --label backup-verify --assignee acme --body The weekly off-site backup check failed: https://github.com/acme/app/actions/runs/7",
      "gh issue create --title Backup verify failed --label backup-verify --body The weekly off-site backup check failed: https://github.com/acme/app/actions/runs/7",
    ]);
  });

  it("comments on the open issue instead of opening a second one", () => {
    const result = run(report, { FAKE_OPEN_ISSUES: "12" });
    expect(result.status).toBe(0);
    expect(result.calls.at(-1)).toBe("gh issue comment 12 --body The weekly off-site backup check failed: https://github.com/acme/app/actions/runs/7");
    expect(result.calls.some((call) => call.startsWith("gh issue create"))).toBe(false);
  });

  it("closes every open report with the green run's link", () => {
    const result = run(close, { FAKE_OPEN_ISSUES: "12 15" });
    expect(result.status).toBe(0);
    expect(result.calls.slice(1)).toEqual([
      "gh issue close 12 --comment The weekly off-site backup check is green again: https://github.com/acme/app/actions/runs/7",
      "gh issue close 15 --comment The weekly off-site backup check is green again: https://github.com/acme/app/actions/runs/7",
    ]);
  });

  it("closes nothing when no report is open", () => {
    const result = run(close, {});
    expect(result.status).toBe(0);
    expect(result.calls).toEqual(["gh issue list --label backup-verify --state open --limit 100 --json number --jq .[].number"]);
  });
});
