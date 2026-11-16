// The Cloudflare deploy action (RP-8) runs in adopting apps against their production Worker, so each step's script
// runs here with bash and a fake `wrangler` and `npx` first on PATH: no call reaches Cloudflare.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

const ACTION_FILE = join(REPO_ROOT, ".github/actions/deploy-cloudflare/action.yml");

interface Step {
  id?: string;
  name?: string;
  if?: string;
  shell?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
}

interface Action {
  inputs: Record<string, { required?: boolean; default?: string }>;
  runs: { using: string; steps: Step[] };
}

const action = parse(readFileSync(ACTION_FILE, "utf8")) as Action;

function findStep(id: string): Step {
  const step = action.runs.steps.find((candidate) => candidate.id === id || candidate.name === id);
  if (step?.run === undefined) throw new Error(`no script step ${id}`);
  return step;
}

/** Records every call with its arguments; on `deploy`, the secrets file's content and the output line wrangler writes. */
const FAKE_WRANGLER = `#!/usr/bin/env bash
echo "wrangler $*" >> "$FAKE_LOG"
if [ "$1" = "deploy" ]; then
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--secrets-file" ]; then
      cat "$2" > "$FAKE_LOG.secrets"
      stat -c %a "$2" > "$FAKE_LOG.mode" 2> /dev/null || stat -f %Lp "$2" > "$FAKE_LOG.mode"
      echo "$2" > "$FAKE_LOG.path"
    fi
    shift
  done
  if [ -n "\${WRANGLER_OUTPUT_FILE_PATH:-}" ]; then
    echo '{"type":"wrangler-session","version":1}' >> "$WRANGLER_OUTPUT_FILE_PATH"
    echo '{"type":"deploy","version":1,"worker_name":"shop","version_id":"v-123"}' >> "$WRANGLER_OUTPUT_FILE_PATH"
  fi
fi
exit "\${FAKE_STATUS:-0}"
`;

const FAKE_NPX = `#!/usr/bin/env bash
echo "npx $*" >> "$FAKE_LOG"
exit "\${FAKE_STATUS:-0}"
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "deploy-cloudflare-"));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin/wrangler"), FAKE_WRANGLER, { mode: 0o755 });
  writeFileSync(join(dir, "bin/npx"), FAKE_NPX, { mode: 0o755 });
  mkdirSync(join(dir, "app"));
  writeFileSync(join(dir, "app/deploy.json"), "{}\n");
  writeFileSync(join(dir, "output"), "");
  writeFileSync(join(dir, "summary"), "");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(id: string, env: Record<string, string>, cwd = join(dir, "app")): { status: number | null; stdout: string; output: string; summary: string; log: string } {
  const result = spawnSync("bash", ["-e", "-c", findStep(id).run ?? ""], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: `${join(dir, "bin")}:${process.env.PATH ?? ""}`,
      HOME: dir,
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: join(dir, "output"),
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
      FAKE_LOG: join(dir, "log"),
      ...env,
    },
  });
  const read = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");
  return { status: result.status, stdout: result.stdout, output: read(join(dir, "output")), summary: read(join(dir, "summary")), log: read(join(dir, "log")) };
}

const VALID = {
  TAG: "v2026.11.16",
  RELEASE_BRANCH: "master",
  APP_URL: "https://shop.example.com",
  API_TOKEN: "token",
  ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  SECRET_NAMES: "AUTH_SECRET RESEND_API_KEY",
  AUTH_SECRET: "auth value",
  RESEND_API_KEY: "re_value",
  WRANGLER_ENV: "",
  DEPLOY_CONFIG: "deploy.json",
  DEPLOY_CLI_VERSION: "0.7.1",
};

describe("the deploy-cloudflare action", () => {
  it("is a composite action whose script steps run in bash, interpolate nothing and read no secrets context", () => {
    expect(action.runs.using).toBe("composite");
    for (const step of action.runs.steps) {
      if (step.run === undefined) continue;
      expect(step.shell, step.name).toBe("bash");
      expect(step.run, step.name).not.toMatch(/\$\{\{/);
    }
    expect(readFileSync(ACTION_FILE, "utf8")).not.toMatch(/\$\{\{[^}]*(?<![\w.-])secrets\b(?!-)/);
    for (const name of ["tag", "release-branch", "app-url", "api-token", "account-id", "deploy-cli-version"]) {
      expect(action.inputs[name]?.required, name).toBe(true);
    }
  });

  it("runs the steps in order: check, tag, build, migrate, deploy, verify, rollback, report, cleanup", () => {
    expect(action.runs.steps.map((step) => step.id ?? step.name ?? step.uses)).toEqual([
      "check",
      "tag",
      "build",
      "migrate",
      "deploy",
      "verify",
      "rollback",
      "Write deploy-report.json",
      "actions/upload-artifact@v7",
      "Remove the secrets file and wrangler's output",
    ]);
  });

  describe("the input check", () => {
    it("passes valid inputs whose secrets the step's env holds", () => {
      expect(run("check", VALID).status).toBe(0);
    });

    it.each([
      [{ APP_URL: "http://shop.example.com" }, "app-url is not https://<host>[:port]"],
      [{ API_TOKEN: "" }, "api-token is empty: set the CLOUDFLARE_API_TOKEN secret in the environment"],
      [{ ACCOUNT_ID: "acme" }, "account-id is not a Cloudflare account ID"],
      [{ TAG: "../v1" }, "tag is not a release tag name"],
      [{ RELEASE_BRANCH: "" }, "release-branch is not a branch name"],
      [{ DEPLOY_CLI_VERSION: "latest" }, "deploy-cli-version is not a version"],
      [{ WRANGLER_ENV: "prod uction" }, "wrangler-env is not an environment name"],
      [{ DEPLOY_CONFIG: "missing.json" }, "deploy-config: missing.json is not a file of the app"],
      [{ RESEND_API_KEY: "" }, "secret-names: RESEND_API_KEY is empty: pass secrets.RESEND_API_KEY as RESEND_API_KEY in the step's env and set the secret in the environment"],
      [{ SECRET_NAMES: "AUTH_SECRET AUTH_SECRET" }, "secret-names: AUTH_SECRET is listed twice"],
      [{ SECRET_NAMES: "CLOUDFLARE_API_TOKEN" }, "secret-names: CLOUDFLARE_API_TOKEN is reserved for the runner or wrangler"],
      [{ SECRET_NAMES: "auth_secret" }, "secret-names: auth_secret is not an upper snake case name"],
    ])("refuses %j", (change, message) => {
      const result = run("check", { ...VALID, ...change });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(`::error::${message}`);
    });
  });

  describe("the tag check", () => {
    function git(cwd: string, ...args: string[]): string {
      const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" } });
      if (result.status !== 0) throw new Error(result.stderr);
      return result.stdout.trim();
    }

    /** A clone whose origin's master has the first commit and a tag on master, and a tag on a side branch. */
    function makeClone(): string {
      const origin = join(dir, "origin");
      mkdirSync(origin);
      git(origin, "init", "-q", "-b", "master");
      git(origin, "commit", "-q", "--allow-empty", "-m", "first");
      git(origin, "tag", "v1");
      git(origin, "checkout", "-q", "-b", "side");
      git(origin, "commit", "-q", "--allow-empty", "-m", "side");
      git(origin, "tag", "v2");
      git(origin, "checkout", "-q", "master");
      const clone = join(dir, "clone");
      git(dir, "clone", "-q", origin, clone);
      return clone;
    }

    it("passes the tag's commit on the release branch and names it", () => {
      const clone = makeClone();
      git(clone, "checkout", "-q", "v1");
      const result = run("tag", { TAG: "v1", RELEASE_BRANCH: "master" }, clone);
      expect(result.status).toBe(0);
      expect(result.output).toBe(`sha=${git(clone, "rev-parse", "HEAD")}\n`);
    });

    it("refuses a tag whose commit is not on the release branch", () => {
      const clone = makeClone();
      git(clone, "checkout", "-q", "v2");
      const result = run("tag", { TAG: "v2", RELEASE_BRANCH: "master" }, clone);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("::error::The commit of v2 is not on master; only a tag on the release branch deploys.");
    });

    it("refuses a checkout of another commit, an unknown tag and an unknown branch", () => {
      const clone = makeClone();
      git(clone, "checkout", "-q", "v2");
      expect(run("tag", { TAG: "v1", RELEASE_BRANCH: "master" }, clone).stdout).toMatch(/::error::The checkout is [0-9a-f]{40}, not the commit of v1/);
      expect(run("tag", { TAG: "v9", RELEASE_BRANCH: "master" }, clone).stdout).toContain("::error::The tag v9 is not in the checkout");
      expect(run("tag", { TAG: "v2", RELEASE_BRANCH: "main" }, clone).stdout).toContain("::error::The branch main is not in the checkout");
    });
  });

  it("migrates with the direct URL as DATABASE_URL and builds with the given command", () => {
    const migrate = run("migrate", { DATABASE_URL: "postgres://migrator@db/app", MIGRATE_COMMAND: 'echo "migrate $DATABASE_URL" >> "$FAKE_LOG"' });
    expect(migrate.status).toBe(0);
    expect(findStep("migrate").if).toBe("inputs.migrate-database-url != ''");
    expect(run("build", { BUILD_COMMAND: "npx opennextjs-cloudflare build" }).status).toBe(0);
    expect(readFileSync(join(dir, "log"), "utf8")).toBe("migrate postgres://migrator@db/app\nnpx opennextjs-cloudflare build\n");
  });

  describe("the deploy", () => {
    const DEPLOY = {
      CLOUDFLARE_API_TOKEN: "token",
      CLOUDFLARE_ACCOUNT_ID: VALID.ACCOUNT_ID,
      SECRET_NAMES: "AUTH_SECRET\nRESEND_API_KEY",
      AUTH_SECRET: 'auth "quoted" value',
      RESEND_API_KEY: "re_value",
      OTHER_SECRET: "never sent",
      WRANGLER: "wrangler",
      WRANGLER_ENV: "",
      TAG: "v2026.11.16",
      SHA: "a".repeat(40),
    };

    it("uploads exactly the listed secrets with the code as one version, privately, removes the file and names the version", () => {
      const result = run("deploy", DEPLOY);
      expect(result.status).toBe(0);
      expect(result.log).toBe(`wrangler deploy --secrets-file ${join(dir, "cloudflare-secrets.json")} --message v2026.11.16 (${"a".repeat(40)})\n`);
      expect(JSON.parse(readFileSync(join(dir, "log.secrets"), "utf8"))).toEqual({ AUTH_SECRET: 'auth "quoted" value', RESEND_API_KEY: "re_value" });
      expect(readFileSync(join(dir, "log.mode"), "utf8").trim()).toBe("600");
      expect(existsSync(join(dir, "cloudflare-secrets.json"))).toBe(false);
      expect(result.output).toBe("version-id=v-123\n");
    });

    it("sends an empty object without secret names and passes a wrangler environment", () => {
      const result = run("deploy", { ...DEPLOY, SECRET_NAMES: "", WRANGLER_ENV: "production" });
      expect(result.status).toBe(0);
      expect(result.log).toContain(" --env production\n");
      expect(JSON.parse(readFileSync(join(dir, "log.secrets"), "utf8"))).toEqual({});
    });

    it("removes the secrets file when wrangler fails and fails the step", () => {
      const result = run("deploy", { ...DEPLOY, FAKE_STATUS: "3" });
      expect(result.status).toBe(3);
      expect(result.stdout).toContain("::error::wrangler deploy failed (3); the previous version keeps serving.");
      expect(existsSync(join(dir, "cloudflare-secrets.json"))).toBe(false);
      expect(result.output).toBe("");
    });
  });

  it("verifies with the pinned CLI and deploy.json", () => {
    const result = run("verify", { APP_URL: "https://shop.example.com", DEPLOY_CONFIG: "deploy.json", DEPLOY_CLI_VERSION: "0.7.1" });
    expect(result.status).toBe(0);
    expect(result.log).toBe("npx --yes --package=@softure-ai/deploy@0.7.1 softure-deploy verify https://shop.example.com --config=deploy.json\n");
  });

  it("rolls back only after a deploy that verified red, and says so", () => {
    expect(findStep("rollback").if).toBe("failure() && steps.deploy.outcome == 'success' && steps.verify.outcome == 'failure'");
    const result = run("rollback", { CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ACCOUNT_ID: VALID.ACCOUNT_ID, WRANGLER: "wrangler", WRANGLER_ENV: "", TAG: "v2" });
    expect(result.status).toBe(0);
    expect(result.log).toBe("wrangler rollback --message verify failed for v2\n");
    expect(result.output).toBe("rolled-back=true\n");
    expect(result.stdout).toContain("::error::verify failed for v2; the previous Worker version serves again.");
    expect(result.summary).toContain("`wrangler rollback`");
  });

  describe("the report", () => {
    const REPORT = {
      TAG: "v2",
      DEPLOY_ENVIRONMENT: "production",
      VERSION_ID: "v-123",
      RUN_URL: "https://github.com/acme/app/actions/runs/1/attempts/1",
      CHECK_RESULT: "success",
      BUILD_RESULT: "success",
      DEPLOY_RESULT: "success",
      VERIFY_RESULT: "success",
      MIGRATE_OUTCOME: "success",
      ROLLED_BACK: "",
    };

    function readReport(env: Record<string, string>): Record<string, unknown> {
      const result = run("Write deploy-report.json", env);
      expect(result.status).toBe(0);
      return JSON.parse(readFileSync(join(dir, "deploy-report/deploy-report.json"), "utf8")) as Record<string, unknown>;
    }

    it("writes the VPS report's shape with the Worker version and the steps that ran", () => {
      const report = readReport(REPORT);
      expect(report).toMatchObject({
        version: 1,
        tag: "v2",
        environment: "production",
        image: "worker@v-123",
        digest: "",
        jobs: [
          { name: "check", result: "success" },
          { name: "build", result: "success" },
          { name: "deploy", result: "success" },
          { name: "verify", result: "success" },
        ],
        serverLines: ["step|migrate|ok", "step|deploy|ok|v-123", "result|ok"],
      });
    });

    it("names the failed step: verify after a rollback, the migration, or an empty report before any deploy", () => {
      expect(readReport({ ...REPORT, VERIFY_RESULT: "failure", ROLLED_BACK: "true" }).serverLines).toEqual([
        "step|migrate|ok",
        "step|deploy|ok|v-123",
        "step|rollback|ok",
        "result|failed|verify",
      ]);
      expect(readReport({ ...REPORT, VERSION_ID: "", DEPLOY_RESULT: "skipped", VERIFY_RESULT: "skipped", MIGRATE_OUTCOME: "failure" })).toMatchObject({
        image: "",
        serverLines: ["result|failed|migrate"],
      });
      expect(readReport({ ...REPORT, VERSION_ID: "", DEPLOY_RESULT: "skipped", VERIFY_RESULT: "skipped", MIGRATE_OUTCOME: "skipped" }).serverLines).toEqual([]);
    });
  });

  it("removes the secrets file in every case", () => {
    const cleanup = action.runs.steps.at(-1);
    expect(cleanup?.if).toBe("always()");
    expect(cleanup?.run).toContain('"$RUNNER_TEMP/cloudflare-secrets.json"');
  });
});
