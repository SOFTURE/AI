import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

// DF-11: deploy-app.yml refuses a tag off the release branch, validates build arguments, renders non-secret values
// over secrets and stops a release whose build argument differs from the value .env.prod would hold. The steps run
// here as the runner runs them: bash for the shell steps (the branch guard against a real git repository and its
// clone), node for the render step with a stub CLI in place of the published one.

const WORKFLOW = join(import.meta.dirname, "../../../.github/workflows/deploy-app.yml");

interface Step {
  name?: string;
  id?: string;
  run?: string;
}

interface Result {
  status: number | null;
  stdout: string;
  stderr: string;
}

const jobs = (parse(readFileSync(WORKFLOW, "utf8")) as { jobs: Record<string, { steps?: Step[] }> }).jobs;

function getScript(job: string, name: string): string {
  const step = (jobs[job]?.steps ?? []).find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`deploy-app.yml has no '${name}' step in the ${job} job`);
  return step.run;
}

const CHECK_SCRIPT = getScript("check", "Validate inputs");
const GUARD_SCRIPT = getScript("check", "Refuse a tag off the release branch");
const RENDER_SCRIPT = getScript("deploy", "Render .env.prod");

// Stands in for `softure-deploy env render`: writes every name it was given (PATH and HOME aside), as the CLI would
// for a compose file that requires them all.
const STUB_CLI = `import { writeFileSync } from "node:fs";
const lines = ["# stub"];
for (const [name, value] of Object.entries(process.env)) {
  if (name === "PATH" || name === "HOME") continue;
  lines.push(\`\${name}='\${value}'\`);
}
writeFileSync(".env.prod", lines.join("\\n") + "\\n", { mode: 0o600 });
`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-deploy-release-guards-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function bash(script: string, options: { cwd: string; env: Record<string, string> }): Result {
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd: options.cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...options.env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: root,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

describe("the release branch guard of the check job", () => {
  let clone: string;
  let featureSha: string;

  beforeEach(() => {
    // The app's repository: master with a tag, a feature branch with a commit and a tag of its own.
    const origin = join(root, "origin");
    mkdirSync(origin);
    git(origin, "init", "--quiet", "--initial-branch=master");
    git(origin, "commit", "--quiet", "--allow-empty", "-m", "first");
    git(origin, "tag", "-a", "v1.0.0", "-m", "release");
    git(origin, "switch", "--quiet", "-c", "feature");
    git(origin, "commit", "--quiet", "--allow-empty", "-m", "unmerged");
    git(origin, "tag", "v1.0.1-feature");
    featureSha = git(origin, "rev-parse", "HEAD");
    git(origin, "switch", "--quiet", "master");
    git(origin, "commit", "--quiet", "--allow-empty", "-m", "second");
    git(origin, "tag", "v1.1.0");
    // What actions/checkout leaves with fetch-depth 0: every branch under origin/, every tag.
    clone = join(root, "clone");
    git(root, "clone", "--quiet", "--no-checkout", origin, clone);
  });

  function guard(env: Record<string, string>): Result {
    return bash(GUARD_SCRIPT, {
      cwd: clone,
      env: { TAG: "v1.1.0", RELEASE_BRANCH: "", DEFAULT_BRANCH: "master", REPOSITORY: "acme/app", ...env },
    });
  }

  it("passes a tag on the default branch, an annotated one too", () => {
    const latest = guard({});
    expect(latest.status, latest.stdout).toBe(0);
    expect(latest.stdout).toMatch(/^The commit [0-9a-f]{40} of v1\.1\.0 is on master\.$/m);
    expect(guard({ TAG: "v1.0.0" }).status).toBe(0);
  });

  it("refuses a tag whose commit is only on another branch, naming the commit and the branch", () => {
    const result = guard({ TAG: "v1.0.1-feature" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      `::error::The commit ${featureSha} of v1.0.1-feature is not on master; only a commit on the release branch deploys.\n`,
    );
  });

  it("checks the branch release-branch names instead of the default one", () => {
    expect(guard({ TAG: "v1.0.1-feature", RELEASE_BRANCH: "feature" }).status).toBe(0);
    expect(guard({ TAG: featureSha, RELEASE_BRANCH: "feature" }).status).toBe(0);
    expect(guard({ TAG: featureSha }).status).toBe(1);
  });

  it("refuses a tag that names no commit", () => {
    const result = guard({ TAG: "v9.9.9" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::The tag v9.9.9 names no commit in acme/app.\n");
  });

  it("refuses a release branch that does not exist", () => {
    const result = guard({ RELEASE_BRANCH: "main" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::The release branch main does not exist in acme/app.\n");
  });

  it("refuses to guess when neither release-branch nor the event names a branch", () => {
    const result = guard({ DEFAULT_BRANCH: "" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::The event names no default branch; set the release-branch input.\n");
  });
});

describe("the check job's validation of release-branch and build-args", () => {
  function check(env: Record<string, string>): Result {
    const output = join(root, "output");
    return bash(CHECK_SCRIPT, {
      cwd: root,
      env: {
        GITHUB_OUTPUT: output,
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
        REPOSITORY: "acme/app",
        E2E: "false",
        ...env,
      },
    });
  }

  it("accepts an empty release-branch, a branch name and NAME=value lines with blank lines between", () => {
    const result = check({
      RELEASE_BRANCH: "release/2026.10",
      BUILD_ARGS: "APP_ORIGIN=https://app.example.com\n\nNEXT_PUBLIC_URL=https://example.com/a=b,c\n",
    });
    expect(result.status, result.stdout).toBe(0);
    expect(check({}).status).toBe(0);
  });

  it.each([
    ["a path segment ..", "release/../master"],
    ["a trailing slash", "release/"],
    ["a leading dash", "-x"],
    ["a space", "my branch"],
  ])("refuses a release-branch with %s", (_label, branch) => {
    const result = check({ RELEASE_BRANCH: branch });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::Input release-branch is not valid: a branch name");
  });

  it("refuses a build-args line that is not NAME=value, naming the line", () => {
    const result = check({ BUILD_ARGS: "APP_ORIGIN=https://example.com\nAPP DOMAIN=example.com\n" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::Input build-args is not valid: NAME=value lines (line 2 is not)");
  });

  it("refuses a build argument named twice", () => {
    const result = check({ BUILD_ARGS: "APP_ORIGIN=https://a.example.com\nAPP_ORIGIN=https://b.example.com" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::Input build-args is not valid: each name once (APP_ORIGIN repeats)");
  });
});

describe("the render step of the deploy job", () => {
  let workspace: string;
  let stubCli: string;

  beforeEach(() => {
    workspace = join(root, "workspace");
    mkdirSync(workspace);
    stubCli = join(root, "stub-cli.mjs");
    writeFileSync(stubCli, STUB_CLI);
  });

  function render(env: Record<string, string>): Result {
    const result = spawnSync("bash", ["-e", "-c", RENDER_SCRIPT], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: root,
        APP_SECRETS: "{}",
        APP_VARS: "{}",
        BUILD_ARGS: "",
        COMPOSE_FILE: "docker/prod/docker-compose.yml",
        DEPLOY_CLI_VERSION: "0.1.3",
        DEPLOY_CLI: stubCli,
        ...env,
      },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  function readEnvProd(): string {
    return readFileSync(join(workspace, ".env.prod"), "utf8");
  }

  it("renders app-vars over the secret of the same name and lists the names it took, never a value", () => {
    const result = render({
      APP_SECRETS: JSON.stringify({ AUTH_SECRET: "s3cret", REGISTRATION_CLOSED: "secret-switch" }),
      APP_VARS: JSON.stringify({ REGISTRATION_CLOSED: "1", MCP_ALLOW_WRITES: "1" }),
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toBe("app-vars: REGISTRATION_CLOSED taken from app-vars over the secret of the same name.\n");
    expect(readEnvProd()).toContain("REGISTRATION_CLOSED='1'\n");
    expect(readEnvProd()).toContain("MCP_ALLOW_WRITES='1'\n");
    expect(readEnvProd()).toContain("AUTH_SECRET='s3cret'\n");
  });

  it("refuses app-vars that are not a JSON object", () => {
    const result = render({ APP_VARS: '["REGISTRATION_CLOSED"]' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::app-vars is not a JSON object of names and values.\n");
  });

  it("refuses a name in app-vars that steers the runner", () => {
    const result = render({ APP_VARS: JSON.stringify({ NODE_OPTIONS: "--require=/tmp/x.js" }) });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::app-vars: NODE_OPTIONS is reserved for the runner and cannot be rendered.\n");
    expect(existsSync(join(workspace, ".env.prod"))).toBe(false);
  });

  it("passes a build argument equal to the value .env.prod holds and ignores one .env.prod does not hold", () => {
    const result = render({
      APP_SECRETS: JSON.stringify({ APP_ORIGIN: "https://app.example.com" }),
      BUILD_ARGS: "  APP_ORIGIN=https://app.example.com\nNEXT_PUBLIC_LANDING=https://example.com\n",
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toBe("build-args and .env.prod agree on APP_ORIGIN.\n");
  });

  it("compares with the value app-vars gave, not the secret it replaced", () => {
    const result = render({
      APP_SECRETS: JSON.stringify({ APP_ORIGIN: "https://old.example.com" }),
      APP_VARS: JSON.stringify({ APP_ORIGIN: "https://app.example.com" }),
      BUILD_ARGS: "APP_ORIGIN=https://app.example.com",
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it("stops a release whose build argument differs from .env.prod, removes the file and prints neither value", () => {
    const result = render({
      APP_SECRETS: JSON.stringify({ APP_ORIGIN: "https://runtime.example.com", APP_DOMAIN: "example.com" }),
      BUILD_ARGS: "APP_ORIGIN=https://build.example.com\nAPP_DOMAIN=example.com",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      "::error::build-args and .env.prod hold different values for APP_ORIGIN; " +
        "the image and the runtime must agree, so set both to the same value.\n",
    );
    expect(result.stdout + result.stderr).not.toContain("runtime.example.com");
    expect(result.stdout + result.stderr).not.toContain("build.example.com");
    expect(existsSync(join(workspace, ".env.prod"))).toBe(false);
  });
});
