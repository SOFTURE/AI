import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

// Issue #476: neither deploy-app.yml nor the deploy action hands the whole secrets context to a runner (CodeQL
// excessive-secrets-exposure). deploy-app.yml takes named secrets only and refuses the removed
// `secrets-from-environment`; the action reads the app's secrets by name from its step's env (`secret-names`) and still
// takes `app-secrets` for the apps that pass it. The steps run here as the runner runs them; the render step runs the
// real CLI from source (through tsx).

const WORKFLOW = join(import.meta.dirname, "../../../.github/workflows/deploy-app.yml");
// The render, send and verify steps live in the deploy action, which the workflow's deploy and verify jobs run with the
// values they read from their secrets context.
const ACTION = join(import.meta.dirname, "../../../.github/actions/deploy/action.yml");
const CLI_SOURCE = join(import.meta.dirname, "../src/cli/main.ts");

interface Step {
  id?: string;
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

interface Result {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface WorkflowFile {
  on: { workflow_call: { inputs: Record<string, { type?: string; default?: unknown }>; secrets: Record<string, { required?: boolean }> } };
  jobs: Record<string, { steps?: Step[] }>;
}

const workflow = parse(readFileSync(WORKFLOW, "utf8")) as WorkflowFile;
const { inputs, secrets: declaredSecrets } = workflow.on.workflow_call;

const actionSteps = (parse(readFileSync(ACTION, "utf8")) as { runs: { steps: Step[] } }).runs.steps;

function getStep(job: string, name: string): Step {
  const steps = job === "action" ? actionSteps : (workflow.jobs[job]?.steps ?? []);
  const step = steps.find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`no '${name}' step in ${job === "action" ? "the deploy action" : `the ${job} job`}`);
  return step;
}

/** The step of a workflow job that runs the deploy action from the workflow's own checkout. */
function getActionCall(job: string): Step {
  const step = (workflow.jobs[job]?.steps ?? []).find(
    (candidate) => candidate.uses === "./.softure-ai-deploy/.github/actions/deploy" && candidate.if === undefined,
  );
  if (step === undefined) throw new Error(`the ${job} job runs no deploy action`);
  return step;
}

const CHECK_STEP = getStep("check", "Validate inputs");
const RENDER_STEP = getStep("action", "Render .env.prod");
const SEND_STEP = getStep("action", "Send the release to the server");
const VERIFY_STEP = getStep("action", "Verify the routes in deploy.json");
const DEPLOY_CALL = getActionCall("deploy");
const VERIFY_CALL = getActionCall("verify");

const NAMED_SECRETS = ["ssh-host", "ssh-user", "ssh-private-key", "ssh-known-hosts", "app-secrets"];

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-deploy-environment-secrets-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function bash(script: string, env: Record<string, string>, cwd = root): Result {
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("the inputs and secrets of deploy-app.yml", () => {
  it("keep secrets-from-environment only to refuse it, and drop the inputs that named secrets to read", () => {
    expect(inputs["secrets-from-environment"]).toMatchObject({ type: "boolean", default: false });
    for (const name of ["ssh-host-secret", "ssh-user-secret", "ssh-private-key-secret", "ssh-known-hosts-secret", "verify-env-secret"]) {
      expect(inputs[name], name).toBeUndefined();
    }
    expect(inputs["origin-address-var"]).toMatchObject({ type: "string", default: "" });
  });

  it("require no secret at the call, so a caller with deploy: false passes none", () => {
    for (const [name, secret] of Object.entries(declaredSecrets)) expect(secret.required, name).toBe(false);
  });

  it("let the check job see which named secrets were passed, never a value", () => {
    const passed = String(CHECK_STEP.env?.PASSED_SECRETS);
    for (const name of NAMED_SECRETS) expect(passed).toContain(`\${{ secrets.${name} != '' && '${name}' || '' }}`);
  });
});

describe("the whole secrets context", () => {
  // The two shapes the CodeQL query flags: toJSON over secrets (whole or one), and secrets[...] by a computed name.
  const FILES = [
    ...readdirSync(join(import.meta.dirname, "../../../.github/workflows")).map((name) => `.github/workflows/${name}`),
    ".github/actions/deploy/action.yml",
    // What an app copies or `init` writes into its own repository, whose scan flags the same shapes (issue #486).
    ...readdirSync(join(import.meta.dirname, "../examples")).map((name) => `tools/deploy/examples/${name}`),
    ...readdirSync(join(import.meta.dirname, "../templates/.github/workflows")).map((name) => `tools/deploy/templates/.github/workflows/${name}`),
  ];

  it.each(FILES)("never reaches a runner from %s", (file) => {
    const text = readFileSync(join(import.meta.dirname, "../../..", file), "utf8");
    const expressions = [...text.matchAll(/\$\{\{([\s\S]*?)\}\}/g)].map((match) => match[1] ?? "");
    for (const expression of expressions) {
      expect(expression, file).not.toMatch(/tojson\(\s*secrets/i);
      expect(expression.trim(), file).not.toMatch(/^secrets\[(?!["'])/);
    }
  });
});

describe("the check job", () => {
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
      DEPLOY_CLI_VERSION: "0.1.6",
      REPOSITORY: "acme/app",
      E2E: "false",
      APP_VARS: "{}",
      ...env,
    });
  }

  const BY_NAME = { SECRETS_FROM_ENVIRONMENT: "false", PASSED_SECRETS: NAMED_SECRETS.join(" ") };
  const REMOVED_FLAG =
    "::error::Input secrets-from-environment is not valid: false (removed in 0.4.0: deploy from the environment's own job " +
    "with deploy: false and the deploy action, secrets by name)\n";

  it("accepts every named secret", () => {
    const result = check(BY_NAME);
    expect(result.status, result.stdout).toBe(0);
  });

  it("refuses the removed secrets-from-environment, with or without an environment, and asks for nothing else", () => {
    for (const environment of ["", "production"]) {
      const result = check({ SECRETS_FROM_ENVIRONMENT: "true", DEPLOY_ENVIRONMENT: environment, PASSED_SECRETS: "    " });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe(REMOVED_FLAG);
    }
    const withDeployFalse = check({ SECRETS_FROM_ENVIRONMENT: "true", DEPLOY: "false", PASSED_SECRETS: "" });
    expect(withDeployFalse.status).toBe(1);
    expect(withDeployFalse.stdout).toBe(REMOVED_FLAG);
  });

  it("refuses each missing named secret, before anything is built", () => {
    const result = check({ SECRETS_FROM_ENVIRONMENT: "false", PASSED_SECRETS: "ssh-host  ssh-known-hosts" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      ["ssh-user", "ssh-private-key", "app-secrets"]
        .map(
          (name) =>
            `::error::Secret ${name} is required: pass it, or set deploy: false and run the deploy action from the environment's job.\n`,
        )
        .join(""),
    );
  });

  it("takes the origin address from the app-vars entry origin-address-var names, and checks it", () => {
    const vars = JSON.stringify({ DEPLOY_ORIGIN_IP: "203.0.113.7", PORT: 443, BAD: "https://203.0.113.7/" });
    expect(check({ ...BY_NAME, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP" }).status).toBe(0);
    const malformed = check({ ...BY_NAME, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "BAD" });
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toContain("::error::Input origin-address-var is not valid: an IP address or host with an optional :port");
    const noConfig = check({ ...BY_NAME, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP", DEPLOY_CONFIG: "" });
    expect(noConfig.status).toBe(1);
    expect(noConfig.stdout).toContain("::error::Input origin-address-var is not valid: empty when deploy-config is empty");
  });

  it.each([
    ["an entry app-vars does not hold", "{}", "DEPLOY_ORIGIN_IP"],
    ["an entry that is not text", '{"DEPLOY_ORIGIN_IP":443}', "DEPLOY_ORIGIN_IP"],
    ["app-vars that are not JSON", "not json", "DEPLOY_ORIGIN_IP"],
    ["app-vars that are a list", '["DEPLOY_ORIGIN_IP"]', "DEPLOY_ORIGIN_IP"],
  ])("refuses origin-address-var naming %s", (_label, vars, name) => {
    const result = check({ ...BY_NAME, APP_VARS: vars, ORIGIN_ADDRESS_VAR: name });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("::error::Input origin-address-var is not valid: the name of a text entry in app-vars\n");
  });

  it("refuses origin-address-var next to the origin-address secret, and a name that is not one", () => {
    const vars = JSON.stringify({ DEPLOY_ORIGIN_IP: "203.0.113.7" });
    const both = check({ ...BY_NAME, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP", ORIGIN_ADDRESS: "203.0.113.8" });
    expect(both.status).toBe(1);
    expect(both.stdout).toBe("::error::Input origin-address-var is not valid: empty when the secret origin-address is passed (one source)\n");
    const badName = check({ ...BY_NAME, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "vars.DEPLOY_ORIGIN_IP" });
    expect(badName.status).toBe(1);
    expect(badName.stdout).toBe("::error::Input origin-address-var is not valid: a name (letters, digits, _)\n");
  });
});

describe("the deploy job", () => {
  it("has no step that reads the environment's secrets by a computed name", () => {
    const names = (workflow.jobs.deploy?.steps ?? []).map((step) => step.name);
    expect(names).not.toContain("Check the environment's SSH secrets");
  });

  it("renders from the named app-secrets, never a secrets context", () => {
    expect(DEPLOY_CALL.with).toMatchObject({ "app-secrets": "${{ secrets.app-secrets }}", "secrets-context": false });
    expect(RENDER_STEP.env?.APP_SECRETS).toBe("${{ inputs.app-secrets }}");
    expect(RENDER_STEP.env?.SECRET_NAMES).toBe("${{ inputs.secret-names }}");
    expect(RENDER_STEP.env?.SECRETS_FROM_ENVIRONMENT).toBe("${{ inputs.secrets-context }}");
  });

  it("sends with the named SSH secrets, or the end-to-end server's values", () => {
    for (const [variable, output, secret] of [
      ["SSH_HOST", "host", "ssh-host"],
      ["SSH_USER", "user", "ssh-user"],
      ["SSH_PRIVATE_KEY", "private-key", "ssh-private-key"],
      ["SSH_KNOWN_HOSTS", "known-hosts", "ssh-known-hosts"],
    ] as const) {
      expect(DEPLOY_CALL.with?.[secret]).toBe(`\${{ inputs.e2e && steps.e2e-server.outputs.${output} || secrets.${secret} }}`);
      expect(SEND_STEP.env?.[variable]).toBe(`\${{ inputs.${secret} }}`);
    }
  });

  describe("the render step with the real CLI", () => {
    let workspace: string;
    let cliWrapper: string;

    beforeEach(() => {
      workspace = join(root, "workspace");
      mkdirSync(join(workspace, "docker/prod"), { recursive: true });
      writeFileSync(
        join(workspace, "docker/prod/docker-compose.yml"),
        ["services:", "  app:", "    environment:", "      AUTH_SECRET: ${AUTH_SECRET:?}", "      DATABASE_URL: ${DATABASE_URL:?}", ""].join("\n"),
      );
      // The step runs `node <DEPLOY_CLI> env render …`; this file starts the CLI's source through tsx instead.
      cliWrapper = join(root, "cli-from-source.mjs");
      writeFileSync(
        cliWrapper,
        [
          'import { spawnSync } from "node:child_process";',
          `const args = ["--conditions=@softure-ai/source", "--import", ${JSON.stringify(import.meta.resolve("tsx"))}, ${JSON.stringify(CLI_SOURCE)}];`,
          "const result = spawnSync(process.execPath, [...args, ...process.argv.slice(2)], { stdio: \"inherit\", env: process.env });",
          "process.exit(result.status ?? 1);",
          "",
        ].join("\n"),
      );
    });

    function render(secretsContext: Record<string, string>, fromEnvironment: boolean, stepEnv: Record<string, string> = {}): Result {
      const result = spawnSync("bash", ["-e", "-c", RENDER_STEP.run ?? ""], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          HOME: root,
          // The caller step's env: reaches the action's steps; the step's own variables below win over it.
          ...stepEnv,
          APP_SECRETS: JSON.stringify(secretsContext),
          SECRET_NAMES: stepEnv.SECRET_NAMES ?? "",
          SECRETS_FROM_ENVIRONMENT: String(fromEnvironment),
          APP_VARS: "{}",
          BUILD_ARGS: "",
          COMPOSE_FILE: "docker/prod/docker-compose.yml",
          DEPLOY_CLI_VERSION: "0.1.6",
          DEPLOY_CLI: cliWrapper,
        },
      });
      return { status: result.status, stdout: result.stdout, stderr: result.stderr };
    }

    function readEnvNames(): string[] {
      return readFileSync(join(workspace, ".env.prod"), "utf8")
        .split("\n")
        .filter((line) => /^[A-Za-z_]\w*=/.test(line))
        .map((line) => line.slice(0, line.indexOf("=")))
        .sort();
    }

    // What toJSON(secrets) holds in the deploy job with `secrets: inherit`: the environment's and the repository's
    // secrets by their own names, the deploy key among them, and github_token.
    const INHERITED = {
      github_token: "ghs-token-sentinel",
      AUTH_SECRET: "auth-from-environment",
      DATABASE_URL: "postgres://app@db/app",
      DEPLOY_SSH_HOST: "203.0.113.7",
      DEPLOY_SSH_USER: "deploy",
      DEPLOY_SSH_KEY: "-----BEGIN OPENSSH PRIVATE KEY-----\nkey-sentinel\n-----END OPENSSH PRIVATE KEY-----",
      DEPLOY_SSH_KNOWN_HOSTS: "203.0.113.7 ssh-ed25519 AAAA",
      UNRELATED_SECRET: "unrelated-sentinel",
    };

    it("writes exactly the compose file's names, leaving out github_token and the deploy key", () => {
      const result = render(INHERITED, true);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(readEnvNames()).toEqual(["AUTH_SECRET", "DATABASE_URL"]);
      const text = readFileSync(join(workspace, ".env.prod"), "utf8");
      for (const value of ["ghs-token-sentinel", "key-sentinel", "unrelated-sentinel"]) expect(text).not.toContain(value);
      expect(result.stdout + result.stderr).not.toContain("auth-from-environment");
    });

    it("leaves out a reserved name of the secrets context under the flag, naming it, never its value", () => {
      const result = render({ ...INHERITED, NODE_AUTH_TOKEN: "npm-sentinel", NPM_CONFIG_REGISTRY: "https://npm.example" }, true);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(result.stdout).toContain("app-secrets: NODE_AUTH_TOKEN, NPM_CONFIG_REGISTRY left out, reserved for the runner.\n");
      expect(result.stdout + result.stderr).not.toContain("npm-sentinel");
      expect(readEnvNames()).toEqual(["AUTH_SECRET", "DATABASE_URL"]);
    });

    it("still refuses a reserved name in app-secrets passed by name", () => {
      const result = render({ ...INHERITED, NODE_AUTH_TOKEN: "npm-sentinel" }, false);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("::error::app-secrets: NODE_AUTH_TOKEN is reserved for the runner and cannot be rendered.\n");
      expect(existsSync(join(workspace, ".env.prod"))).toBe(false);
    });

    describe("with secret-names", () => {
      // What the caller's step sets: each secret by name from its own context, next to whatever the runner sets.
      const STEP_ENV = {
        AUTH_SECRET: "auth-from-environment",
        DATABASE_URL: "postgres://app@db/app",
        UNLISTED_SECRET: "unlisted-sentinel",
        GITHUB_TOKEN: "ghs-token-sentinel",
      };

      it("renders exactly the listed names from the step's env, nothing it does not list", () => {
        const result = render({}, true, { ...STEP_ENV, SECRET_NAMES: "AUTH_SECRET\n  DATABASE_URL " });
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(readEnvNames()).toEqual(["AUTH_SECRET", "DATABASE_URL"]);
        const text = readFileSync(join(workspace, ".env.prod"), "utf8");
        expect(text).toContain("AUTH_SECRET=auth-from-environment");
        for (const value of ["unlisted-sentinel", "ghs-token-sentinel"]) expect(text).not.toContain(value);
        expect(result.stdout + result.stderr).not.toContain("auth-from-environment");
      });

      it("counts an empty or missing listed value as unset, so the compose file's check names it", () => {
        const result = render({}, true, { ...STEP_ENV, DATABASE_URL: "", SECRET_NAMES: "AUTH_SECRET DATABASE_URL" });
        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain("DATABASE_URL");
        expect(existsSync(join(workspace, ".env.prod"))).toBe(false);
      });

      it("refuses names the runner or the step owns, a repeat and a token that is not a name, by position only", () => {
        const result = render({}, true, {
          ...STEP_ENV,
          SECRET_NAMES: "AUTH_SECRET GITHUB_TOKEN NODE_OPTIONS COMPOSE_FILE AUTH_SECRET ci p@ss=word",
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toBe(
          [
            "GITHUB_TOKEN is reserved for the runner",
            "NODE_OPTIONS is reserved for the runner",
            "COMPOSE_FILE is a variable of the render step itself",
            "AUTH_SECRET is listed twice",
            "ci is reserved for the runner",
            "item 7 is not a name (letters, digits, _)",
          ]
            .map((problem) => `::error::secret-names: ${problem}.\n`)
            .join(""),
        );
        expect(result.stdout).not.toContain("p@ss");
        expect(existsSync(join(workspace, ".env.prod"))).toBe(false);
      });

      it("refuses secret-names next to a non-empty app-secrets", () => {
        const result = render({ AUTH_SECRET: "x" }, true, { ...STEP_ENV, SECRET_NAMES: "AUTH_SECRET DATABASE_URL" });
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("::error::secret-names: pass the app's secrets by name or as app-secrets, not both.\n");
      });
    });

    it("fails naming a compose name the environment does not hold", () => {
      const withoutDatabase: Record<string, string> = { ...INHERITED };
      delete withoutDatabase.DATABASE_URL;
      const result = render(withoutDatabase, true);
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("DATABASE_URL");
      expect(existsSync(join(workspace, ".env.prod"))).toBe(false);
    });
  });
});

describe("the verify job's origin address from app-vars", () => {
  it("reads the entry origin-address-var names, else the origin-address secret", () => {
    expect(VERIFY_CALL.with?.["origin-address"]).toBe(
      "${{ inputs.origin-address-var != '' && fromJSON(inputs.app-vars)[inputs.origin-address-var] || secrets.origin-address }}",
    );
    expect(VERIFY_STEP.env).toMatchObject({ ORIGIN_ADDRESS: "${{ inputs.origin-address }}" });
    const bin = join(root, "bin");
    mkdirSync(bin);
    // A stand-in npx prints the arguments it would have run the CLI with, one per line.
    writeFileSync(join(bin, "npx"), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    const run = (env: Record<string, string>): string[] =>
      bash(VERIFY_STEP.run ?? "", {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        APP_URL: "https://example.com",
        DEPLOY_CONFIG: "deploy.json",
        DEPLOY_CLI_VERSION: "0.1.6",
        ORIGIN_ADDRESS: "",
        ORIGIN_ADDRESS_VAR: "",
        APP_VARS: JSON.stringify({ DEPLOY_ORIGIN_IP: "203.0.113.7" }),
        ...env,
      }).stdout.split("\n");
    const base = ["--yes", "--package=@softure-ai/deploy@0.1.6", "softure-deploy", "verify", "https://example.com", "--config=deploy.json"];
    expect(run({ ORIGIN_ADDRESS: "203.0.113.8" })).toEqual([...base, "--origin=203.0.113.8", ""]);
    expect(run({})).toEqual([...base, ""]);
  });
});
