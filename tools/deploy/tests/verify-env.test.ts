import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

// Issue #357: the verify step of deploy-app.yml runs `softure-deploy verify` with variables the app chose (a Web Bot
// Auth key for a `webBotAuth` route): from the secret `verify-env`, or from the secrets `verify-env-names` lists when
// the secrets stay in the environment. The steps run here as the runner runs them.

const WORKFLOW = join(import.meta.dirname, "../../../.github/workflows/deploy-app.yml");

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Result {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface WorkflowFile {
  on: { workflow_call: { inputs: Record<string, { type?: string; default?: unknown }>; secrets: Record<string, { required?: boolean }> } };
  jobs: Record<string, { environment?: string; steps?: Step[] }>;
}

const workflow = parse(readFileSync(WORKFLOW, "utf8")) as WorkflowFile;
const { inputs, secrets } = workflow.on.workflow_call;

function getStep(job: string, name: string): Step {
  const step = (workflow.jobs[job]?.steps ?? []).find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`deploy-app.yml has no '${name}' step in the ${job} job`);
  return step;
}

const CHECK_STEP = getStep("check", "Validate inputs");
const VERIFY_STEP = getStep("verify", "Verify the routes in deploy.json");

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-deploy-verify-env-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function bash(script: string, env: Record<string, string>): Result {
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("the verify-env input and secret", () => {
  it("are optional and empty by default", () => {
    expect(inputs["verify-env-names"]).toMatchObject({ type: "string", default: "" });
    expect(secrets["verify-env"]?.required).toBe(false);
  });

  it("put the verify job in the environment only when it lists names", () => {
    expect(workflow.jobs.verify?.environment).toBe("${{ inputs.verify-env-names != '' && inputs.environment || '' }}");
  });

  it("reach the check job and the verify step", () => {
    expect(CHECK_STEP.env).toMatchObject({
      VERIFY_ENV: "${{ secrets.verify-env }}",
      VERIFY_ENV_NAMES: "${{ inputs.verify-env-names }}",
    });
    expect(String(CHECK_STEP.env?.PASSED_SECRETS)).toContain("${{ secrets.verify-env != '' && 'verify-env' || '' }}");
    expect(VERIFY_STEP.env).toMatchObject({
      VERIFY_ENV: "${{ inputs.verify-env-names != '' && toJSON(secrets) || secrets.verify-env }}",
      VERIFY_ENV_NAMES: "${{ inputs.verify-env-names }}",
    });
  });
});

describe("the check job", () => {
  const NAMED_SECRETS = "ssh-host ssh-user ssh-private-key ssh-known-hosts app-secrets";
  const BY_NAME = { SECRETS_FROM_ENVIRONMENT: "false", PASSED_SECRETS: NAMED_SECRETS };
  const FROM_ENVIRONMENT = { SECRETS_FROM_ENVIRONMENT: "true", DEPLOY_ENVIRONMENT: "production", PASSED_SECRETS: "" };

  function check(env: Record<string, string>): Result {
    return bash(CHECK_STEP.run ?? "", {
      GITHUB_OUTPUT: join(root, "output"),
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
      DEPLOY_CLI_VERSION: "0.1.8",
      REPOSITORY: "acme/app",
      E2E: "false",
      APP_VARS: "{}",
      SSH_HOST_SECRET: "DEPLOY_SSH_HOST",
      SSH_USER_SECRET: "DEPLOY_SSH_USER",
      SSH_PRIVATE_KEY_SECRET: "DEPLOY_SSH_KEY",
      SSH_KNOWN_HOSTS_SECRET: "DEPLOY_SSH_KNOWN_HOSTS",
      VERIFY_ENV: "",
      VERIFY_ENV_NAMES: "",
      ...env,
    });
  }

  const KEY = JSON.stringify({ WEB_BOT_AUTH_PRIVATE_KEY: "seed-value" });

  it("accepts verify-env with secrets by name, and verify-env-names with secrets-from-environment", () => {
    const byName = check({ ...BY_NAME, PASSED_SECRETS: `${NAMED_SECRETS} verify-env`, VERIFY_ENV: KEY });
    expect(byName.status, byName.stdout).toBe(0);
    const fromEnvironment = check({ ...FROM_ENVIRONMENT, VERIFY_ENV_NAMES: "WEB_BOT_AUTH_PRIVATE_KEY\nOTHER_KEY " });
    expect(fromEnvironment.status, fromEnvironment.stdout).toBe(0);
  });

  it("refuses verify-env under secrets-from-environment, pointing at verify-env-names", () => {
    const result = check({ ...FROM_ENVIRONMENT, PASSED_SECRETS: "verify-env", VERIFY_ENV: KEY });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      "::error::Input secrets-from-environment is not valid: false when the secret verify-env is passed (list the secrets in verify-env-names)\n",
    );
  });

  it("refuses verify-env-names without secrets-from-environment", () => {
    const result = check({ ...BY_NAME, VERIFY_ENV_NAMES: "WEB_BOT_AUTH_PRIVATE_KEY" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      "::error::Input verify-env-names is not valid: empty without secrets-from-environment (pass the secret verify-env instead)\n",
    );
  });

  it("refuses verify-env-names that lists no name", () => {
    const result = check({ ...FROM_ENVIRONMENT, VERIFY_ENV_NAMES: " \n " });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::Input verify-env-names is not valid: one or more secret names, or empty\n");
  });

  it("refuses a name that is not one, and each name reserved for the step or the runner, in either form", () => {
    const reserved = ["APP_URL", "deploy_config", "VERIFY_ENV", "ORIGIN_ADDRESS", "PATH", "home", "NODE_OPTIONS", "npm_config_registry"];
    const listed = check({ ...FROM_ENVIRONMENT, VERIFY_ENV_NAMES: ["1KEY", ...reserved].join(" ") });
    expect(listed.status).toBe(1);
    expect(listed.stdout.split("\n").filter(Boolean)).toEqual([
      "::error::Input verify-env-names is not valid: 1KEY is not a name (letters, digits, _)",
      ...reserved.map((name) => `::error::Input verify-env-names is not valid: ${name} is reserved for the verify step or the runner`),
    ]);
    const passed = check({
      ...BY_NAME,
      PASSED_SECRETS: `${NAMED_SECRETS} verify-env`,
      VERIFY_ENV: JSON.stringify({ "BAD-NAME": "x", NODE_OPTIONS: "--require=./evil.js", OK: "y" }),
    });
    expect(passed.status).toBe(1);
    expect(passed.stdout).toBe(
      [
        "::error::Input verify-env is not valid: BAD-NAME is not a name (letters, digits, _)",
        "::error::Input verify-env is not valid: NODE_OPTIONS is reserved for the verify step or the runner",
        "",
      ].join("\n"),
    );
    expect(passed.stdout).not.toContain("evil");
  });

  it("refuses verify-env that is not a JSON object of text values, never printing a value", () => {
    for (const value of ["not json secret-123", "[1]", JSON.stringify({ KEY: 7 })]) {
      const result = check({ ...BY_NAME, PASSED_SECRETS: `${NAMED_SECRETS} verify-env`, VERIFY_ENV: value });
      expect(result.status, value).toBe(1);
      expect(result.stdout, value).toBe("::error::Input verify-env is not valid: a JSON object of text values by name\n");
    }
  });

  it("refuses both forms when deploy-config is empty, since verify then runs no CLI", () => {
    const byName = check({ ...BY_NAME, PASSED_SECRETS: `${NAMED_SECRETS} verify-env`, VERIFY_ENV: KEY, DEPLOY_CONFIG: "" });
    expect(byName.status).toBe(1);
    expect(byName.stdout).toBe("::error::Input verify-env is not valid: empty when deploy-config is empty (verify runs with deploy.json)\n");
    const fromEnvironment = check({ ...FROM_ENVIRONMENT, VERIFY_ENV_NAMES: "KEY", DEPLOY_CONFIG: "" });
    expect(fromEnvironment.status).toBe(1);
    expect(fromEnvironment.stdout).toBe(
      "::error::Input verify-env-names is not valid: empty when deploy-config is empty (verify runs with deploy.json)\n",
    );
  });
});

describe("the verify step", () => {
  const ARGS = ["--yes", "--package=@softure-ai/deploy@0.1.8", "softure-deploy", "verify", "https://example.com", "--config=deploy.json"];

  // A stand-in npx prints its arguments, then its environment as JSON, as the CLI would see them.
  function verify(env: Record<string, string>): Result {
    const bin = join(root, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, "npx"),
      `#!/bin/sh\nprintf 'arg:%s\\n' "$@"\nexec "${process.execPath}" -e 'process.stdout.write("env:" + JSON.stringify(process.env) + "\\n")'\n`,
      { mode: 0o755 },
    );
    return bash(VERIFY_STEP.run ?? "", {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      APP_URL: "https://example.com",
      DEPLOY_CONFIG: "deploy.json",
      DEPLOY_CLI_VERSION: "0.1.8",
      ORIGIN_ADDRESS: "",
      ORIGIN_ADDRESS_VAR: "",
      APP_VARS: "{}",
      VERIFY_ENV: "",
      VERIFY_ENV_NAMES: "",
      ...env,
    });
  }

  function read(result: Result): { masks: string[]; args: string[]; env: Record<string, string> } {
    const lines = result.stdout.split("\n");
    const envLine = lines.find((line) => line.startsWith("env:")) ?? "env:{}";
    return {
      masks: lines.filter((line) => line.startsWith("::add-mask::")).map((line) => line.slice("::add-mask::".length)),
      args: lines.filter((line) => line.startsWith("arg:")).map((line) => line.slice("arg:".length)),
      env: JSON.parse(envLine.slice("env:".length)) as Record<string, string>,
    };
  }

  it("exports the entries of verify-env to the CLI only, masking every line, and passes the JSON on to nothing", () => {
    const result = verify({ VERIFY_ENV: JSON.stringify({ WEB_BOT_AUTH_PRIVATE_KEY: "seed-value", PEM_KEY: "line one\nline two\n" }) });
    expect(result.status, result.stderr).toBe(0);
    const { masks, args, env } = read(result);
    expect(args).toEqual(ARGS);
    expect(env.WEB_BOT_AUTH_PRIVATE_KEY).toBe("seed-value");
    expect(env.PEM_KEY).toBe("line one\nline two\n");
    expect(env.VERIFY_ENV).toBeUndefined();
    expect(masks.sort()).toEqual(["line one", "line two", "seed-value"]);
    // The value appears only in its mask registration and in the CLI's own environment.
    expect(result.stdout).not.toMatch(/^(?!::add-mask::|env:).*seed-value/m);
  });

  it("exports only the secrets verify-env-names lists from the job's secrets context", () => {
    const result = verify({
      VERIFY_ENV_NAMES: "WEB_BOT_AUTH_PRIVATE_KEY\n",
      VERIFY_ENV: JSON.stringify({ github_token: "ghs_token", WEB_BOT_AUTH_PRIVATE_KEY: "seed-value", DEPLOY_SSH_KEY: "ssh-key" }),
    });
    expect(result.status, result.stderr).toBe(0);
    const { masks, args, env } = read(result);
    expect(args).toEqual(ARGS);
    expect(env.WEB_BOT_AUTH_PRIVATE_KEY).toBe("seed-value");
    expect(env.github_token).toBeUndefined();
    expect(env.DEPLOY_SSH_KEY).toBeUndefined();
    expect(env.VERIFY_ENV).toBeUndefined();
    expect(masks).toEqual(["seed-value"]);
  });

  it("names a listed secret the environment lacks and runs nothing", () => {
    const result = verify({ VERIFY_ENV_NAMES: "WEB_BOT_AUTH_PRIVATE_KEY OTHER", VERIFY_ENV: JSON.stringify({ github_token: "x" }) });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      [
        "::error::verify-env-names: the environment (or the repository) has no secret WEB_BOT_AUTH_PRIVATE_KEY.",
        "::error::verify-env-names: the environment (or the repository) has no secret OTHER.",
        "",
      ].join("\n"),
    );
  });

  it("runs as before with neither", () => {
    const result = verify({});
    expect(result.status, result.stderr).toBe(0);
    const { masks, args, env } = read(result);
    expect(args).toEqual(ARGS);
    expect(masks).toEqual([]);
    expect(env.VERIFY_ENV).toBeUndefined();
  });
});
