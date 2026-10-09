import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

// Issue #296: with `secrets-from-environment: true` and `secrets: inherit`, deploy-app.yml's deploy job reads the app's
// secrets and the SSH values from its own environment instead of named secrets the caller cannot fill from one. The
// steps run here as the runner runs them; the render step runs the real CLI from source (through tsx).

const WORKFLOW = join(import.meta.dirname, "../../../.github/workflows/deploy-app.yml");
const CLI_SOURCE = join(import.meta.dirname, "../src/cli/main.ts");

interface Step {
  name?: string;
  if?: string;
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
  jobs: Record<string, { steps?: Step[] }>;
}

const workflow = parse(readFileSync(WORKFLOW, "utf8")) as WorkflowFile;
const { inputs, secrets: declaredSecrets } = workflow.on.workflow_call;

function getStep(job: string, name: string): Step {
  const step = (workflow.jobs[job]?.steps ?? []).find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`deploy-app.yml has no '${name}' step in the ${job} job`);
  return step;
}

const CHECK_STEP = getStep("check", "Validate inputs");
const SSH_CHECK_STEP = getStep("deploy", "Check the environment's SSH secrets");
const RENDER_STEP = getStep("deploy", "Render .env.prod");
const SEND_STEP = getStep("deploy", "Send the release to the server");
const VERIFY_STEP = getStep("verify", "Verify the routes in deploy.json");

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
  it("leave secrets-from-environment off and name the example caller's secrets by default", () => {
    expect(inputs["secrets-from-environment"]).toMatchObject({ type: "boolean", default: false });
    expect(inputs["ssh-host-secret"]?.default).toBe("DEPLOY_SSH_HOST");
    expect(inputs["ssh-user-secret"]?.default).toBe("DEPLOY_SSH_USER");
    expect(inputs["ssh-private-key-secret"]?.default).toBe("DEPLOY_SSH_KEY");
    expect(inputs["ssh-known-hosts-secret"]?.default).toBe("DEPLOY_SSH_KNOWN_HOSTS");
    expect(inputs["origin-address-var"]).toMatchObject({ type: "string", default: "" });
  });

  it("require no secret at the call, so a caller with secrets: inherit can call it", () => {
    for (const [name, secret] of Object.entries(declaredSecrets)) expect(secret.required, name).toBe(false);
  });

  it("let the check job see which named secrets were passed, never a value", () => {
    const passed = String(CHECK_STEP.env?.PASSED_SECRETS);
    for (const name of NAMED_SECRETS) expect(passed).toContain(`\${{ secrets.${name} != '' && '${name}' || '' }}`);
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
      SSH_HOST_SECRET: "DEPLOY_SSH_HOST",
      SSH_USER_SECRET: "DEPLOY_SSH_USER",
      SSH_PRIVATE_KEY_SECRET: "DEPLOY_SSH_KEY",
      SSH_KNOWN_HOSTS_SECRET: "DEPLOY_SSH_KNOWN_HOSTS",
      ...env,
    });
  }

  const FROM_ENVIRONMENT = { SECRETS_FROM_ENVIRONMENT: "true", DEPLOY_ENVIRONMENT: "production", PASSED_SECRETS: "    " };
  const BY_NAME = { SECRETS_FROM_ENVIRONMENT: "false", PASSED_SECRETS: NAMED_SECRETS.join(" ") };

  it("accepts the flag with an environment and no named secret (secrets: inherit)", () => {
    const result = check(FROM_ENVIRONMENT);
    expect(result.status, result.stdout).toBe(0);
  });

  it("accepts every named secret without the flag, as before", () => {
    const result = check(BY_NAME);
    expect(result.status, result.stdout).toBe(0);
  });

  it("refuses the flag without an environment", () => {
    const result = check({ ...FROM_ENVIRONMENT, DEPLOY_ENVIRONMENT: "" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      "::error::Input secrets-from-environment is not valid: false without environment (the deploy job reads that environment's secrets)\n",
    );
  });

  it("refuses the flag next to a named secret, naming each one", () => {
    const result = check({ ...FROM_ENVIRONMENT, PASSED_SECRETS: " ssh-host  app-secrets " });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      "::error::Input secrets-from-environment is not valid: false when the secret ssh-host is passed (pass secrets: inherit instead)\n" +
        "::error::Input secrets-from-environment is not valid: false when the secret app-secrets is passed (pass secrets: inherit instead)\n",
    );
    const origin = check({ ...FROM_ENVIRONMENT, ORIGIN_ADDRESS: "203.0.113.7" });
    expect(origin.status).toBe(1);
    expect(origin.stdout).toContain("false when the secret origin-address is passed (use origin-address-var)");
  });

  it.each([
    ["SSH_HOST_SECRET", "ssh-host-secret", "DEPLOY-SSH-HOST"],
    ["SSH_USER_SECRET", "ssh-user-secret", ""],
    ["SSH_PRIVATE_KEY_SECRET", "ssh-private-key-secret", "1KEY"],
    ["SSH_KNOWN_HOSTS_SECRET", "ssh-known-hosts-secret", "KNOWN HOSTS"],
  ])("refuses %s that is not a secret name under the flag", (variable, input, value) => {
    const result = check({ ...FROM_ENVIRONMENT, [variable]: value });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(`::error::Input ${input} is not valid: a secret name (letters, digits, _)\n`);
    expect(check({ ...BY_NAME, [variable]: value }).status).toBe(0);
  });

  it("refuses each missing named secret without the flag, before anything is built", () => {
    const result = check({ SECRETS_FROM_ENVIRONMENT: "false", PASSED_SECRETS: "ssh-host  ssh-known-hosts" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      ["ssh-user", "ssh-private-key", "app-secrets"]
        .map((name) => `::error::Secret ${name} is required: pass it, or set secrets-from-environment with secrets: inherit.\n`)
        .join(""),
    );
  });

  it("takes the origin address from the app-vars entry origin-address-var names, and checks it", () => {
    const vars = JSON.stringify({ DEPLOY_ORIGIN_IP: "203.0.113.7", PORT: 443, BAD: "https://203.0.113.7/" });
    expect(check({ ...FROM_ENVIRONMENT, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP" }).status).toBe(0);
    const malformed = check({ ...FROM_ENVIRONMENT, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "BAD" });
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toContain("::error::Input origin-address-var is not valid: an IP address or host with an optional :port");
    const noConfig = check({ ...FROM_ENVIRONMENT, APP_VARS: vars, ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP", DEPLOY_CONFIG: "" });
    expect(noConfig.status).toBe(1);
    expect(noConfig.stdout).toContain("::error::Input origin-address-var is not valid: empty when deploy-config is empty");
  });

  it.each([
    ["an entry app-vars does not hold", "{}", "DEPLOY_ORIGIN_IP"],
    ["an entry that is not text", '{"DEPLOY_ORIGIN_IP":443}', "DEPLOY_ORIGIN_IP"],
    ["app-vars that are not JSON", "not json", "DEPLOY_ORIGIN_IP"],
    ["app-vars that are a list", '["DEPLOY_ORIGIN_IP"]', "DEPLOY_ORIGIN_IP"],
  ])("refuses origin-address-var naming %s", (_label, vars, name) => {
    const result = check({ ...FROM_ENVIRONMENT, APP_VARS: vars, ORIGIN_ADDRESS_VAR: name });
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

describe("the deploy job under secrets-from-environment", () => {
  it("checks the SSH secrets by name only under the flag and off the end-to-end path", () => {
    expect(SSH_CHECK_STEP.if).toBe("inputs.secrets-from-environment && !inputs.e2e");
    const missing = String(SSH_CHECK_STEP.env?.MISSING_SECRETS);
    for (const input of ["ssh-host-secret", "ssh-user-secret", "ssh-private-key-secret", "ssh-known-hosts-secret"]) {
      expect(missing).toContain(`\${{ secrets[inputs.${input}] == '' && inputs.${input} || '' }}`);
    }
    const steps = workflow.jobs.deploy?.steps ?? [];
    expect(steps.indexOf(SSH_CHECK_STEP)).toBeLessThan(steps.indexOf(RENDER_STEP));
  });

  it("names every SSH secret the environment lacks and stops", () => {
    const names = "DEPLOY_SSH_HOST DEPLOY_SSH_USER\nDEPLOY_SSH_KEY DEPLOY_SSH_KNOWN_HOSTS";
    const result = bash(SSH_CHECK_STEP.run ?? "", {
      DEPLOY_ENVIRONMENT: "production",
      SSH_SECRET_NAMES: names,
      MISSING_SECRETS: " DEPLOY_SSH_USER  DEPLOY_SSH_KNOWN_HOSTS",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      "::error::The environment production (or the repository) has no secret DEPLOY_SSH_USER, DEPLOY_SSH_KNOWN_HOSTS; " +
        "the deploy reads the SSH values from DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY, DEPLOY_SSH_KNOWN_HOSTS.\n",
    );
    const complete = bash(SSH_CHECK_STEP.run ?? "", { DEPLOY_ENVIRONMENT: "production", SSH_SECRET_NAMES: names, MISSING_SECRETS: "   " });
    expect(complete.status).toBe(0);
    expect(complete.stdout).toBe("SSH values read from the secrets DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY, DEPLOY_SSH_KNOWN_HOSTS.\n");
  });

  it("renders from the job's whole secrets context under the flag, else from app-secrets", () => {
    expect(RENDER_STEP.env?.APP_SECRETS).toBe("${{ inputs.secrets-from-environment && toJSON(secrets) || secrets.app-secrets }}");
    expect(RENDER_STEP.env?.SECRETS_FROM_ENVIRONMENT).toBe("${{ inputs.secrets-from-environment }}");
  });

  it("sends with the secrets the *-secret inputs name under the flag", () => {
    for (const [variable, output, input, secret] of [
      ["SSH_HOST", "host", "ssh-host-secret", "ssh-host"],
      ["SSH_USER", "user", "ssh-user-secret", "ssh-user"],
      ["SSH_PRIVATE_KEY", "private-key", "ssh-private-key-secret", "ssh-private-key"],
      ["SSH_KNOWN_HOSTS", "known-hosts", "ssh-known-hosts-secret", "ssh-known-hosts"],
    ] as const) {
      expect(SEND_STEP.env?.[variable]).toBe(
        `\${{ inputs.e2e && steps.e2e-server.outputs.${output} || inputs.secrets-from-environment && secrets[inputs.${input}] || secrets.${secret} }}`,
      );
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

    function render(secretsContext: Record<string, string>, fromEnvironment: boolean): Result {
      const result = spawnSync("bash", ["-e", "-c", RENDER_STEP.run ?? ""], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          HOME: root,
          APP_SECRETS: JSON.stringify(secretsContext),
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
    expect(VERIFY_STEP.env).toMatchObject({
      ORIGIN_ADDRESS: "${{ secrets.origin-address }}",
      ORIGIN_ADDRESS_VAR: "${{ inputs.origin-address-var }}",
      APP_VARS: "${{ inputs.app-vars }}",
    });
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
    expect(run({ ORIGIN_ADDRESS_VAR: "DEPLOY_ORIGIN_IP" })).toEqual([...base, "--origin=203.0.113.7", ""]);
    expect(run({ ORIGIN_ADDRESS: "203.0.113.8" })).toEqual([...base, "--origin=203.0.113.8", ""]);
    expect(run({})).toEqual([...base, ""]);
  });
});
