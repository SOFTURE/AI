import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { AppFacts } from "../src/init/app-facts.js";
import type { InitAnswers } from "../src/init/answers.js";
import { planInitFiles } from "../src/init/generate.js";

// DF-7: the deploy workflow packs the server files with .env.prod into one archive, and the deploy.sh `init` writes
// unpacks and installs it. Both halves run here together: the workflow's pack step with bash in a fake checkout of
// the tag, then the generated deploy.sh with that archive on stdin and a stub `docker` on PATH.

const WORKFLOW = join(import.meta.dirname, "../../../.github/workflows/deploy-app.yml");

const ANSWERS: InitAnswers = {
  domain: "example.com",
  image: "ghcr.io/acme/app",
  name: "acme-app",
  paths: ["/"],
  www: false,
  env: [],
  tables: [],
};

const NO_DATABASE: AppFacts = {
  packageName: "acme-app",
  hasDatabase: false,
  hasHealthRoute: true,
  hasPublicDir: false,
  nextConfigFile: "next.config.ts",
  isStandalone: true,
};

const ENV_PROD = "AUTH_SECRET='s3cret'\n";

// The database steps run the CLI through npx; the stub records the call, prints what backup prints and writes the
// row-counts file of --out (COUNTS_JSON, else two tables), like the CLI. server-settings and --print-query run the
// real CLI (REAL_CLI through tsx): what deploy.sh reads from them is the package's own output. Called as
// softure-deploy in the helper image, the stub gets the arguments without npx's.
const STUB_NPX = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$NPX_LOG"
if [ -n "\${FAIL_NPX_ON:-}" ] && [[ " $* " == *"$FAIL_NPX_ON"* ]]; then exit 1; fi
if [ "\${1:-}" = "--yes" ]; then shift 2; fi
# The CLI reads all of a --stdin input; a writer to a pipe nobody drains could die of SIGPIPE.
if [[ " $* " == *" --stdin "* ]]; then cat > /dev/null; fi
case " $* " in
  *" server-settings "* | *" --print-query "*) exec "$REAL_NODE" --import "$TSX_LOADER" "$REAL_CLI" "$@" ;;
esac
for arg in "$@"; do
  case "$arg" in
    --dir=*) echo "backup: wrote \${arg#--dir=}/db-20261006-120000.dump (2048 bytes)" ;;
    --out=*)
      counts='{"users":3,"billing.subscriptions":2}'
      printf '{"takenAt":"2026-10-06T12:00:00.000Z","counts":%s}\\n' "\${COUNTS_JSON:-$counts}" > "\${arg#--out=}"
      ;;
  esac
done
exit 0
`;

// FAIL_DOCKER_ON fails the calls whose arguments hold that text; `image ls`, `ps` and `inspect` answer from the
// environment like a server with those images and containers would.
// DF-11: a command run under a DOCKER_CONFIG is also logged with that folder, and the login's stdin is kept.
const STUB_DOCKER = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ -n "\${DOCKER_CONFIG:-}" ]; then printf '%s %s\\n' "$1" "$DOCKER_CONFIG" >> "$DOCKER_CONFIG_LOG"; fi
if [ "$1" = "login" ]; then cat > "$LOGIN_STDIN"; fi
if [ -n "\${FAIL_COMPOSE_CONFIG:-}" ] && [[ " $* " == *" config "* ]]; then exit 1; fi
if [ -n "\${FAIL_DOCKER_ON:-}" ] && [[ " $* " == *"$FAIL_DOCKER_ON"* ]]; then exit 1; fi
# The helper image of a host without Node: absent until \`build\` ran; \`run\` executes the command after the image name
# on the host, with TOOLS_BIN (softure-deploy, node) first on PATH.
if [ "$1" = "image" ] && [ "$2" = "inspect" ] && [[ "$3" == softure-deploy-tools:* ]]; then
  [ -f "$DOCKER_LOG.tools-image" ] && exit 0
  exit 1
fi
if [ "$1" = "build" ]; then cat > "$DOCKER_LOG.tools-image"; exit 0; fi
if [ "$1" = "run" ]; then
  shift
  while [ "$#" -gt 0 ] && [[ "$1" != softure-deploy-tools:* ]]; do shift; done
  shift
  PATH="$TOOLS_BIN:$PATH" exec "$@"
fi
case " $* " in
  *" image ls "*) printf '%s' "\${DOCKER_IMAGE_TAGS:-}" ;;
  *" ps --all "*) printf 'traefik:Up 2 hours\\napp:Up 2 hours (healthy)\\n' ;;
  *" ps --quiet app "*) echo c0ffee ;;
  *" inspect "*) echo healthy ;;
  *" create "*) echo c0ffee ;;
  *" exec -T postgres pg_dump "*) printf 'PGDMP-stub' ;;
  *" exec -T postgres psql "*) printf '{"softure":[],"app":null}\\n' ;;
esac
exit 0
`;

// A crontab kept in a file, as \`crontab -l\` and \`crontab -\` would on the host.
const STUB_CRONTAB = `#!/usr/bin/env bash
if [ "$1" = "-l" ]; then
  if [ -f "$CRONTAB_FILE" ]; then cat "$CRONTAB_FILE"; exit 0; fi
  echo "no crontab for $USER" >&2
  exit 1
fi
if [ "$1" = "-" ]; then cat > "$CRONTAB_FILE"; exit 0; fi
exit 2
`;

// flock is not on every developer machine (macOS); the lock itself is the kernel's, not this script's.
const STUB_FLOCK = `#!/usr/bin/env bash
exit 0
`;

interface Step {
  name?: string;
  run?: string;
}

interface BashResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function getDeployStepScript(name: string): string {
  const workflow = parse(readFileSync(WORKFLOW, "utf8")) as { jobs: Record<string, { steps?: Step[] }> };
  const step = (workflow.jobs.deploy?.steps ?? []).find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`deploy-app.yml has no '${name}' step`);
  return step.run;
}

const PACK_SCRIPT = getDeployStepScript("Pack the release");
const SEND_SCRIPT = getDeployStepScript("Send the release to the server");

let root: string;
let checkout: string;
let server: string;
let dockerLog: string;
let stubBin: string;
let npxLog: string;
let crontabFile: string;

function write(path: string, text: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  chmodSync(path, mode);
}

function writeCheckout(options: { facts?: AppFacts; tables?: string[]; envProd?: string } = {}): void {
  const answers = { ...ANSWERS, tables: options.tables ?? [] };
  const files = planInitFiles({ answers, facts: options.facts ?? NO_DATABASE, cliVersion: "9.9.9" });
  for (const file of files) write(join(checkout, file.path), file.text, file.mode);
  writeFileSync(join(checkout, ".env.prod"), options.envProd ?? ENV_PROD);
}

function pack(env: Record<string, string> = {}): BashResult {
  const result = spawnSync("bash", ["-euo", "pipefail", "-c", PACK_SCRIPT], {
    cwd: checkout,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      RUNNER_TEMP: join(root, "runner"),
      COMPOSE_FILE: "docker/prod/docker-compose.yml",
      SERVER_SCRIPT: "docker/server/deploy.sh",
      DEPLOY_CONFIG: "deploy.json",
      ...env,
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runServer(command: string, input: Buffer | string, env: Record<string, string> = {}): BashResult {
  const result = spawnSync("bash", [join(server, "deploy.sh")], {
    input,
    encoding: "utf8",
    env: {
      PATH: `${stubBin}:${process.env.PATH ?? ""}`,
      SSH_ORIGINAL_COMMAND: command,
      DOCKER_LOG: dockerLog,
      DOCKER_CONFIG_LOG: join(root, "docker-config.log"),
      LOGIN_STDIN: join(root, "login-stdin"),
      NPX_LOG: npxLog,
      CRONTAB_FILE: crontabFile,
      REAL_NODE: process.execPath,
      TSX_LOADER: import.meta.resolve("tsx"),
      REAL_CLI: join(import.meta.dirname, "../src/cli/main.ts"),
      ...env,
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function deploy(tag: string, input: Buffer | string, env: Record<string, string> = {}): BashResult {
  return runServer(`deploy ${tag}`, input, env);
}

function readLines(output: string, kind: string): string[] {
  return output.split("\n").filter((line) => line.startsWith(`${kind}|`));
}

function packArchive(): Buffer {
  const result = pack();
  expect(result.stderr + result.stdout).not.toContain("::error::");
  expect(result.status).toBe(0);
  return readFileSync(join(checkout, "release.tar.gz"));
}

function tarDirectory(dir: string, members: string[], extraArgs: string[] = []): Buffer {
  const out = join(root, `archive-${String(Date.now())}-${String(Math.random()).slice(2)}.tar.gz`);
  const result = spawnSync("tar", ["-czf", out, ...extraArgs, "-C", dir, ...members], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`tar failed: ${result.stderr}`);
  return readFileSync(out);
}

function readDockerLog(): string[] {
  return existsSync(dockerLog) ? readFileSync(dockerLog, "utf8").trim().split("\n") : [];
}

function expectNothingInstalled(): void {
  expect(readdirSync(server).filter((name) => name !== "releases" && name !== ".deploy.lock")).toEqual(["deploy.sh"]);
  if (existsSync(join(server, "releases"))) expect(readdirSync(join(server, "releases"))).toEqual([]);
  expect(readDockerLog().filter((line) => line.startsWith("pull") || line.includes(" up "))).toEqual([]);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-deploy-server-files-"));
  checkout = join(root, "checkout");
  server = join(root, "srv", "acme-app");
  stubBin = join(root, "bin");
  dockerLog = join(root, "docker.log");
  npxLog = join(root, "npx.log");
  crontabFile = join(root, "crontab");
  writeCheckout();
  // The first setup: the owner copies deploy.sh once and binds the deploy key to it.
  write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
  write(join(stubBin, "docker"), STUB_DOCKER, 0o755);
  write(join(stubBin, "npx"), STUB_NPX, 0o755);
  write(join(stubBin, "crontab"), STUB_CRONTAB, 0o755);
  write(join(stubBin, "flock"), STUB_FLOCK, 0o755);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("a release archive packed by deploy-app.yml and installed by deploy.sh", () => {
  it("installs the tag's server files next to deploy.sh and runs the release", () => {
    const result = deploy("v1.2.3", packArchive());
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    for (const path of ["docker-compose.yml", "traefik.yml", "deploy.json"]) {
      const source = path === "deploy.json" ? path : `docker/prod/${path}`;
      expect(readFileSync(join(server, path), "utf8")).toBe(readFileSync(join(checkout, source), "utf8"));
      expect(statSync(join(server, path)).mode & 0o777).toBe(0o644);
    }
    expect(readFileSync(join(server, "deploy.sh"), "utf8")).toBe(readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"));
    expect(statSync(join(server, "deploy.sh")).mode & 0o777).toBe(0o755);
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe(`${ENV_PROD}TAG=v1.2.3\n`);
    expect(statSync(join(server, ".env.prod")).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(server, ".deployed-tag"), "utf8")).toBe("v1.2.3\n");
    expect(readdirSync(join(server, "releases"))).toEqual(["v1.2.3"]);
    expect(existsSync(join(server, "releases/v1.2.3/.env.prod"))).toBe(false);
    expect(readDockerLog()).toEqual([
      expect.stringMatching(/^compose .*--file .*releases\/v1\.2\.3\/docker-compose\.yml config --quiet$/) as unknown,
      "pull --quiet ghcr.io/acme/app:v1.2.3",
      "compose --env-file .env.prod --file docker-compose.yml up --detach --wait --remove-orphans traefik app",
    ]);
    expect(readLines(result.stdout, "step")).toEqual([
      "step|archive|ok",
      "step|files|ok",
      "step|settings|ok",
      "step|pull|ok",
      "step|switch|ok",
      "step|tag|ok",
      "step|cron|ok",
    ]);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|ok");
    expect(readFileSync(crontabFile, "utf8")).toBe(
      `17 3 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin SSH_ORIGINAL_COMMAND=maintain ${server}/deploy.sh 2>&1 | logger -t acme-app-maintain # softure-deploy:acme-app\n`,
    );
    expect(existsSync(join(server, ".env.prod.prev"))).toBe(false);
  });

  it("keeps the rules' inode, recreates Traefik when they change and replaces deploy.sh by a rename", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    const rulesInode = statSync(join(server, "traefik.yml")).ino;
    const scriptInode = statSync(join(server, "deploy.sh")).ino;
    rmSync(dockerLog);

    writeFileSync(join(checkout, "docker/prod/traefik.yml"), `${readFileSync(join(checkout, "docker/prod/traefik.yml"), "utf8")}# v2\n`);
    const result = deploy("v2", packArchive());
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(join(server, "traefik.yml"), "utf8")).toMatch(/# v2\n$/);
    expect(statSync(join(server, "traefik.yml")).ino).toBe(rulesInode);
    expect(statSync(join(server, "deploy.sh")).ino).not.toBe(scriptInode);
    expect(readDockerLog().at(-1)).toBe("compose --env-file .env.prod --file docker-compose.yml up --detach --wait --force-recreate traefik");
    expect(readLines(result.stdout, "step")).toContain("step|traefik|ok");
    expect(readdirSync(join(server, "releases")).sort()).toEqual(["v1", "v2"]);
  });

  it("does not recreate Traefik when its rules did not change", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    expect(deploy("v2", packArchive()).status).toBe(0);
    expect(readDockerLog().filter((line) => line.includes("force-recreate"))).toEqual([]);
  });

  it("keeps the newest five release folders", () => {
    const archive = packArchive();
    for (const tag of ["v1", "v2", "v3", "v4", "v5", "v6", "v7"]) expect(deploy(tag, archive).status).toBe(0);
    expect(readdirSync(join(server, "releases")).sort()).toEqual(["v3", "v4", "v5", "v6", "v7"]);
  });

  it("ships no deploy.json when deploy-config is empty", () => {
    expect(pack({ DEPLOY_CONFIG: "" }).status).toBe(0);
    expect(deploy("v1", readFileSync(join(checkout, "release.tar.gz"))).status).toBe(0);
    expect(existsSync(join(server, "deploy.json"))).toBe(false);
  });
});

describe("deploy.sh with a database counts the tables of the deploy.json the release shipped", () => {
  const WITH_DATABASE: AppFacts = { ...NO_DATABASE, hasDatabase: true };
  const DATABASE_ENV = "POSTGRES_PASSWORD='pw'\nSOFTURE_MIGRATOR_PASSWORD='m'\nSOFTURE_APP_PASSWORD='a'\n";

  function setUp(tables: string[]): void {
    writeCheckout({ facts: WITH_DATABASE, tables, envProd: DATABASE_ENV });
    write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
  }

  function readRowCountCalls(): string[] {
    const calls = existsSync(npxLog) ? readFileSync(npxLog, "utf8").trim().split("\n") : [];
    return calls.filter((line) => line.includes(" row-counts "));
  }

  function setDeployJson(edit: (config: Record<string, unknown>) => Record<string, unknown>): void {
    const path = join(checkout, "deploy.json");
    writeFileSync(path, JSON.stringify(edit(JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)));
  }

  it("counts before and compares after the switch on a later release, with the release's own deploy.json", () => {
    setUp(["users", "billing.subscriptions"]);
    const first = deploy("v1", packArchive());
    expect(first.stderr).toBe("");
    expect(first.status).toBe(0);
    // The first release has no rows to lose (and no tables yet).
    expect(readRowCountCalls()).toEqual([]);

    rmSync(dockerLog);
    const second = deploy("v2", packArchive());
    expect(second.stderr).toBe("");
    expect(second.status).toBe(0);
    const config = join(server, "releases/v2/deploy.json");
    expect(readRowCountCalls()).toEqual([
      expect.stringMatching(new RegExp(`^--yes @softure-ai/deploy@9\\.9\\.9 row-counts --config=${config} --out=\\S+/counts-before\\.json$`)) as unknown,
      expect.stringMatching(new RegExp(`^--yes @softure-ai/deploy@9\\.9\\.9 row-counts --config=${config} --compare=\\S+/counts-before\\.json --out=\\S+/counts-after\\.json$`)) as unknown,
    ]);
    expect(readDockerLog()).toContain("compose --env-file .env.prod --file docker-compose.yml up --detach --wait --remove-orphans traefik app");
  });

  it("puts the backup file and the counts before and after on its step lines for the release report", () => {
    setUp(["users", "billing.subscriptions"]);
    expect(deploy("v1", packArchive()).status).toBe(0);
    const second = deploy("v2", packArchive());
    expect(second.status).toBe(0);
    const steps = second.stdout.split("\n").filter((line) => /^step\|(backup|row-counts)/.test(line));
    expect(steps).toEqual([
      "step|backup|ok|db-20261006-120000.dump",
      "step|row-counts-before|ok|users=3,billing.subscriptions=2",
      "step|row-counts-after|ok|users=3,billing.subscriptions=2",
    ]);
    expect(deploy("v3", packArchive(), { COUNTS_JSON: "{}" }).stdout).toContain("step|row-counts-before|ok\n");
  });

  it("skips the comparison when the shipped deploy.json lists no tables", () => {
    setUp([]);
    expect(deploy("v1", packArchive()).status).toBe(0);
    const result = deploy("v2", packArchive());
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readRowCountCalls()).toEqual([]);
  });

  it("skips the comparison when the release ships no deploy.json, even if an older one is installed", () => {
    setUp(["users"]);
    expect(deploy("v1", packArchive()).status).toBe(0);
    expect(pack({ DEPLOY_CONFIG: "" }).status).toBe(0);
    const result = deploy("v2", readFileSync(join(checkout, "release.tar.gz")));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(existsSync(join(server, "deploy.json"))).toBe(true);
    expect(readRowCountCalls()).toEqual([]);
  });

  it("takes a table added to deploy.json with the release that ships it", () => {
    setUp(["users"]);
    expect(deploy("v1", packArchive()).status).toBe(0);
    setDeployJson((config) => ({ ...config, database: { rowCountTables: ["users", "orders"] } }));
    expect(deploy("v2", packArchive()).status).toBe(0);
    expect(JSON.parse(readFileSync(join(server, "releases/v2/deploy.json"), "utf8"))).toMatchObject({
      database: { rowCountTables: ["users", "orders"] },
    });
    expect(readRowCountCalls()).toHaveLength(2);
  });

  it("stops before the switch when the shipped deploy.json cannot be read", () => {
    setUp(["users"]);
    expect(deploy("v1", packArchive()).status).toBe(0);
    rmSync(dockerLog);
    writeFileSync(join(checkout, "deploy.json"), "{ not json");
    const result = deploy("v2", packArchive());
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("result|failed|settings|cannot read the release's deploy.json, or it is not valid; nothing was restarted.");
    expect(result.stderr).toContain("server-settings: cannot read");
    expect(result.stderr).toContain("deploy: the previous release is v1; redeploy it to roll back.");
    expect(readDockerLog().filter((line) => line.includes("traefik app"))).toEqual([]);
    expect(readRowCountCalls()).toEqual([]);
  });
});

describe("deploy.sh with a database on a host without Node", () => {
  const WITH_DATABASE: AppFacts = { ...NO_DATABASE, hasDatabase: true };
  const DATABASE_ENV = "POSTGRES_PASSWORD='pw'\nSOFTURE_MIGRATOR_PASSWORD='m'\nSOFTURE_APP_PASSWORD='a'\n";
  // No /usr/local/bin or the Node folder: bash, tar and the coreutils only, the docker stub and no npx.
  const HOST_PATH = "/usr/bin:/bin";
  let toolsBin: string;

  beforeEach(() => {
    writeCheckout({ facts: WITH_DATABASE, tables: ["users"], envProd: DATABASE_ENV });
    write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
    rmSync(join(stubBin, "npx"));
    toolsBin = join(root, "tools-bin");
    write(join(toolsBin, "softure-deploy"), STUB_NPX, 0o755);
    symlinkSync(process.execPath, join(toolsBin, "node"));
  });

  function deployWithoutNode(tag: string): BashResult {
    return deploy(tag, packArchive(), { PATH: `${stubBin}:${HOST_PATH}`, TOOLS_BIN: toolsBin });
  }

  it("builds the helper image once and runs every database step in it", () => {
    expect(spawnSync("bash", ["-c", "command -v node npx"], { env: { PATH: `${stubBin}:${HOST_PATH}` } }).status).not.toBe(0);
    const first = deployWithoutNode("v1");
    expect(first.stderr).toBe("");
    expect(first.status).toBe(0);
    const second = deployWithoutNode("v2");
    expect(second.stderr).toBe("");
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/^step\|row-counts-after\|ok\|users=3,billing\.subscriptions=2$/m);

    const docker = readDockerLog();
    expect(docker.filter((line) => line.startsWith("build "))).toEqual(["build --quiet --tag softure-deploy-tools:9.9.9-pg16 -"]);
    expect(readFileSync(`${dockerLog}.tools-image`, "utf8")).toBe(
      "FROM node:22-alpine\nRUN apk add --no-cache postgresql16-client && npm install --global --no-audit --no-fund @softure-ai/deploy@9.9.9\n",
    );
    const runs = docker.filter((line) => line.startsWith("run "));
    expect(runs.every((line) => line.includes(` --network host --user ${String(process.getuid?.())}:`) && line.includes(`--volume ${server}:${server}`))).toBe(true);
    const commands = readFileSync(npxLog, "utf8").trim().split("\n").map((line) => line.split(" ")[0]);
    expect(commands).toEqual(["server-settings", "backup", "schema-guard", "server-settings", "backup", "schema-guard", "row-counts", "row-counts"]);
    expect(runs.filter((line) => line.includes(" node -e "))).toHaveLength(4);
  });

  it("stops before anything restarts when the helper image cannot be built", () => {
    const result = deploy("v1", packArchive(), { PATH: `${stubBin}:${HOST_PATH}`, TOOLS_BIN: toolsBin, FAIL_DOCKER_ON: "build" });
    expect(result.status).toBe(1);
    // The CLI that reads the release's deploy.json runs in the helper image too, so the first step that needs it stops.
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe(
      "result|failed|settings|cannot read the release's deploy.json, or it is not valid; nothing was restarted.",
    );
    expect(readDockerLog().filter((line) => line.includes("traefik app"))).toEqual([]);
  });
});

describe("deploy.sh runs the hooks of the release's deploy.json", () => {
  // A host script the release ships in docker/prod/hooks/: it records what it saw and prints a line deploy.sh must keep
  // off stdout; HOOK_EXIT makes it fail.
  const CHECK_SCRIPT = `printf 'tag=%s image=%s previous=%s cwd=%s\\n' "$TAG" "$IMAGE" "$PREVIOUS_TAG" "$PWD" >> "$HOOK_LOG"
echo "result|ok"
exit "\${HOOK_EXIT:-0}"
`;

  function setHooks(hooks: Record<string, unknown>): void {
    const path = join(checkout, "deploy.json");
    writeFileSync(path, JSON.stringify({ ...(JSON.parse(readFileSync(path, "utf8")) as object), hooks }));
  }

  const HOOKS = {
    "pre-migrate": [{ name: "check-env", run: ["bash", "hooks/check.sh"] }],
    "post-up": [{ name: "publish", compose: ["exec", "-T", "app", "node", "publish.mjs", "--commit"] }],
    maintain: [
      { name: "daily-report", run: ["bash", "hooks/check.sh"] },
      { name: "purge", schedule: "*/15 * * * *", compose: ["exec", "-T", "app", "node", "purge.mjs"] },
    ],
  };

  let hookLog: string;

  beforeEach(() => {
    hookLog = join(root, "hook.log");
    write(join(checkout, "docker/prod/hooks/check.sh"), CHECK_SCRIPT);
    setHooks(HOOKS);
  });

  function deployWithHooks(tag: string, env: Record<string, string> = {}): BashResult {
    return deploy(tag, packArchive(), { HOOK_LOG: hookLog, ...env });
  }

  it("runs pre-migrate before the switch and post-up once the release is live, with their output on stderr", () => {
    expect(deployWithHooks("v1").status).toBe(0);
    const result = deployWithHooks("v2");
    expect(result.status).toBe(0);
    expect(readLines(result.stdout, "step")).toEqual([
      "step|archive|ok",
      "step|files|ok",
      "step|settings|ok",
      "step|pull|ok",
      "step|check-env|ok",
      "step|switch|ok",
      "step|tag|ok",
      "step|cron|ok",
      "step|publish|ok",
    ]);
    // A hook's own output never counts as the release's result line.
    expect(readLines(result.stdout, "result")).toEqual(["result|ok"]);
    expect(result.stderr).toBe("result|ok\n");
    expect(readFileSync(hookLog, "utf8").trim().split("\n")).toEqual([
      `tag=v1 image=ghcr.io/acme/app previous= cwd=${server}`,
      `tag=v2 image=ghcr.io/acme/app previous=v1 cwd=${server}`,
    ]);
    expect(readDockerLog()).toContain("compose --env-file .env.prod --file docker-compose.yml exec -T app node publish.mjs --commit");
  });

  it("keeps a hook that reads stdin from swallowing the hooks after it", () => {
    setHooks({
      "pre-migrate": [
        { name: "drain", run: ["bash", "-c", "cat > /dev/null"] },
        { name: "check-env", run: ["bash", "hooks/check.sh"] },
      ],
    });
    const result = deployWithHooks("v1");
    expect(result.status, result.stdout).toBe(0);
    expect(readLines(result.stdout, "step")).toContain("step|drain|ok");
    expect(readLines(result.stdout, "step")).toContain("step|check-env|ok");
  });

  it("gives a scheduled maintain hook its own crontab line and runs only it on maintain <hook>", () => {
    expect(deployWithHooks("v1").status).toBe(0);
    expect(readFileSync(crontabFile, "utf8").split("\n").filter((line) => line !== "")).toEqual([
      `17 3 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin SSH_ORIGINAL_COMMAND=maintain ${server}/deploy.sh 2>&1 | logger -t acme-app-maintain # softure-deploy:acme-app`,
      `*/15 * * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin SSH_ORIGINAL_COMMAND='maintain purge' ${server}/deploy.sh 2>&1 | logger -t acme-app-purge # softure-deploy:acme-app`,
    ]);
    rmSync(dockerLog);
    rmSync(hookLog);
    const scheduled = runServer("maintain purge", "", { HOOK_LOG: hookLog });
    expect(scheduled.status).toBe(0);
    expect(scheduled.stdout).toBe("step|settings|ok\nstep|purge|ok\nresult|ok\n");
    expect(readDockerLog()).toEqual(["compose --env-file .env.prod --file docker-compose.yml exec -T app node purge.mjs"]);
    expect(existsSync(hookLog)).toBe(false);

    const daily = runServer("maintain", "", { HOOK_LOG: hookLog });
    expect(daily.status).toBe(0);
    expect(readLines(daily.stdout, "step")).toEqual(["step|settings|ok", "step|images|ok|removed 0", "step|daily-report|ok"]);
    expect(readFileSync(hookLog, "utf8")).toBe(`tag=v1 image=ghcr.io/acme/app previous=v1 cwd=${server}\n`);
  });

  it("refuses maintain of a hook the installed deploy.json does not schedule, and a name that is not one", () => {
    expect(deployWithHooks("v1").status).toBe(0);
    const unknown = runServer("maintain daily-report", "");
    expect(unknown.status).toBe(1);
    expect(unknown.stdout).toContain("result|failed|settings|deploy.json has no scheduled maintain hook daily-report.");
    const invalid = runServer("maintain ../x", "");
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toBe("deploy: the hook name is not a lower-case word of letters, digits and -.\n");
  });

  it("puts the previous files back when a pre-migrate hook fails", () => {
    expect(deployWithHooks("v1").status).toBe(0);
    rmSync(dockerLog);
    writeFileSync(join(checkout, ".env.prod"), "AUTH_SECRET='new'\n");
    const result = deployWithHooks("v2", { HOOK_EXIT: "3" });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").slice(-2)).toEqual([
      "step|restore|ok",
      "result|failed|check-env|the hook check-env failed with exit status 3.",
    ]);
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe(`${ENV_PROD}TAG=v1\n`);
    expect(readDockerLog().filter((line) => line.includes(" up "))).toEqual([]);
  });

  it("fails the release on a failing post-up hook with the tag recorded and nothing rolled back", () => {
    expect(deployWithHooks("v1").status).toBe(0);
    const result = deployWithHooks("v2", { FAIL_DOCKER_ON: "publish.mjs" });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|publish|the hook publish failed with exit status 1.");
    expect(result.stdout).not.toContain("step|restore");
    expect(readFileSync(join(server, ".deployed-tag"), "utf8")).toBe("v2\n");
  });

  it("stops at the settings step, files restored, when a hook takes a name of deploy.sh's own steps", () => {
    expect(deployWithHooks("v1").status).toBe(0);
    setHooks({ "post-up": [{ name: "switch", run: ["true"] }] });
    const result = deployWithHooks("v2");
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").slice(-2)).toEqual([
      "step|restore|ok",
      "result|failed|settings|cannot read the release's deploy.json, or it is not valid; nothing was restarted.",
    ]);
    expect(result.stderr).toContain("hooks.post-up.0");
  });

  it("does not need the CLI when a release without a database ships no hooks", () => {
    const path = join(checkout, "deploy.json");
    const config = JSON.parse(readFileSync(path, "utf8")) as { hooks?: unknown };
    delete config.hooks;
    writeFileSync(path, JSON.stringify(config));
    expect(deployWithHooks("v1").status).toBe(0);
    expect(existsSync(npxLog)).toBe(false);
  });
});

describe("deploy.sh with database.access compose-exec", () => {
  const WITH_DATABASE: AppFacts = { ...NO_DATABASE, hasDatabase: true };
  // No POSTGRES_PASSWORD: compose-exec runs as the service's own user over its socket.
  const DATABASE_ENV = "POSTGRES_USER='appuser'\nPOSTGRES_DB='app_db'\nSOFTURE_MIGRATOR_PASSWORD='m'\nSOFTURE_APP_PASSWORD='a'\n";

  beforeEach(() => {
    writeCheckout({ facts: WITH_DATABASE, tables: ["users"], envProd: DATABASE_ENV });
    write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
    const path = join(checkout, "deploy.json");
    const config = JSON.parse(readFileSync(path, "utf8")) as { database: object };
    config.database = {
      ...config.database,
      access: "compose-exec",
      appMigrations: { journal: "/app/drizzle/meta/_journal.json" },
      excludeTableData: ["security.rate_limits"],
    };
    writeFileSync(path, JSON.stringify(config));
  });

  function readNpxCalls(): string[] {
    return readFileSync(npxLog, "utf8").trim().split("\n").map((line) => line.replace(/^--yes @softure-ai\/deploy@9\.9\.9 /, ""));
  }

  it("dumps, guards and counts through the postgres service as POSTGRES_USER on POSTGRES_DB", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    rmSync(dockerLog);
    rmSync(npxLog);
    const result = deploy("v2", packArchive());
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readLines(result.stdout, "step")).toContain("step|backup|ok|db-20261006-120000.dump");
    expect(readLines(result.stdout, "step")).toContain("step|row-counts-after|ok|users=3,billing.subscriptions=2");

    const compose = "compose --env-file .env.prod --file docker-compose.yml";
    const docker = readDockerLog();
    expect(docker).toContain(
      `${compose} exec -T postgres pg_dump --format=custom --no-password -U appuser -d app_db --exclude-table-data=security.rate_limits`,
    );
    expect(docker.filter((line) => line.startsWith(`${compose} exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -At -U appuser -d app_db -c SELECT `))).toHaveLength(3);
    expect(docker.some((line) => /^cp c0ffee:\/app\/drizzle\/meta\/_journal\.json \S+\/app-journal\.json$/.test(line))).toBe(true);

    const calls = readNpxCalls();
    const work = /--migrations-dir=(\S+)\/migrations/.exec(calls.find((call) => call.startsWith("schema-guard --stdin")) ?? "")?.[1] ?? "";
    const config = `${server}/releases/v2/deploy.json`;
    expect(calls).toEqual([
      `server-settings --config=${config} --out-dir=${work}/settings`,
      `backup --stdin --dir=${server}/backups --prefix=db --keep=7 --max-age-days=30`,
      "schema-guard --print-query --app-ledger=drizzle.__drizzle_migrations",
      `schema-guard --stdin --migrations-dir=${work}/migrations --app-journal=${work}/app-journal.json --app-ledger=drizzle.__drizzle_migrations`,
      `row-counts --print-query --config=${config}`,
      `row-counts --stdin --config=${config} --out=${work}/counts-before.json`,
      `row-counts --print-query --config=${config}`,
      `row-counts --stdin --config=${config} --compare=${work}/counts-before.json --out=${work}/counts-after.json`,
    ]);
    expect(readdirSync(join(server, "backups"))).toEqual([]);
  });

  it("stops at the backup when pg_dump fails, keeping no partial dump and calling no CLI to keep one", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    rmSync(npxLog);
    const result = deploy("v2", packArchive(), { FAIL_DOCKER_ON: "pg_dump" });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|backup|the backup failed; nothing was restarted.");
    expect(readNpxCalls().filter((call) => call.startsWith("backup"))).toEqual([]);
    expect(readdirSync(join(server, "backups"))).toEqual([]);
  });

  it("stops at the schema step when the image has no app journal", () => {
    const result = deploy("v1", packArchive(), { FAIL_DOCKER_ON: "cp c0ffee:/app/drizzle" });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe(
      "result|failed|schema|the image v1 has no /app/drizzle/meta/_journal.json (database.appMigrations.journal); nothing was restarted.",
    );
  });
});

describe("deploy.sh refuses a release archive", () => {
  function expectRefused(result: BashResult, message: string): void {
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expectNothingInstalled();
  }

  it("when nothing arrives on stdin", () => {
    expectRefused(deploy("v1", ""), "deploy: no release archive arrived on stdin.");
  });

  it("when stdin is not an archive", () => {
    expectRefused(deploy("v1", ENV_PROD), "deploy: the release archive cannot be read.");
  });

  it("with a symlink in it", () => {
    const dir = join(root, "evil");
    write(join(dir, ".env.prod"), ENV_PROD);
    symlinkSync("/etc/passwd", join(dir, "traefik.yml"));
    expectRefused(deploy("v1", tarDirectory(dir, ["."])), "deploy: the release archive holds something other than files and folders.");
  });

  it("with a member outside the release folder", () => {
    const dir = join(root, "evil", "inner");
    write(join(dir, ".env.prod"), ENV_PROD);
    write(join(root, "evil", "escape"), "x");
    expectRefused(deploy("v1", tarDirectory(dir, ["./.env.prod", "../escape"], ["-P"])), "deploy: the release archive holds a path that is not allowed: ../escape");
  });

  it("without .env.prod", () => {
    const dir = join(root, "partial");
    write(join(dir, "docker-compose.yml"), "services: {}\n");
    write(join(dir, "deploy.sh"), "#!/usr/bin/env bash\n");
    expectRefused(deploy("v1", tarDirectory(dir, ["."])), "deploy: the release archive has no .env.prod.");
  });

  it("that carries a name the server keeps for itself", () => {
    const dir = join(root, "reserved");
    write(join(dir, ".env.prod"), ENV_PROD);
    write(join(dir, "deploy.sh"), "#!/usr/bin/env bash\n");
    write(join(dir, "docker-compose.yml"), "services: {}\n");
    write(join(dir, ".env.prod.prev"), "AUTH_SECRET='old'\n");
    expectRefused(deploy("v1", tarDirectory(dir, ["."])), "deploy: the release archive holds .env.prod.prev, a name this server keeps for itself.");
  });

  it("when its compose file does not parse", () => {
    expectRefused(deploy("v1", packArchive(), { FAIL_COMPOSE_CONFIG: "1" }), "deploy: the compose file of v1 is not valid; nothing was installed.");
  });
});

describe("the registry token of a release (DF-11)", () => {
  const TOKEN = "ghs_short-lived-token";

  function packWithToken(): Buffer {
    const result = pack({ REGISTRY_TOKEN: TOKEN });
    expect(result.stdout).not.toContain("::error::");
    expect(result.status).toBe(0);
    return readFileSync(join(checkout, "release.tar.gz"));
  }

  function readDockerConfigLog(): string[] {
    const path = join(root, "docker-config.log");
    return existsSync(path) ? readFileSync(path, "utf8").trim().split("\n") : [];
  }

  it("rides in the archive as .registry-token, readable by its owner only", () => {
    const listing = spawnSync("tar", ["-tvzf", "-"], { input: packWithToken(), encoding: "utf8" }).stdout;
    // GNU tar lists the owner as `0/0`, bsdtar (macOS) as `0 0` in two columns after the link count.
    expect(listing).toMatch(/^-rw------- +(0\/0|\d+ +0 +0) .* \.\/\.registry-token$/m);
    expect(pack().status).toBe(0);
    const without = spawnSync("tar", ["-tzf", join(checkout, "release.tar.gz")], { encoding: "utf8" }).stdout;
    expect(without).not.toContain(".registry-token");
  });

  it("logs in and pulls through a throwaway Docker config, and is installed nowhere", () => {
    const result = deploy("v1.2.3", packWithToken());
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readDockerLog()).toEqual([
      expect.stringMatching(/ config --quiet$/) as unknown,
      "login ghcr.io --username softure-deploy --password-stdin",
      "pull --quiet ghcr.io/acme/app:v1.2.3",
      "compose --env-file .env.prod --file docker-compose.yml up --detach --wait --remove-orphans traefik app",
    ]);
    expect(readFileSync(join(root, "login-stdin"), "utf8")).toBe(`${TOKEN}\n`);
    const configs = readDockerConfigLog();
    expect(configs.map((line) => line.split(" ")[0])).toEqual(["login", "pull"]);
    const config = configs[0]?.split(" ")[1] ?? "";
    expect(config).toMatch(/\/docker-config$/);
    expect(configs[1]?.split(" ")[1]).toBe(config);
    expect(existsSync(config)).toBe(false);
    expect(existsSync(join(server, ".registry-token"))).toBe(false);
    expect(existsSync(join(server, "releases/v1.2.3/.registry-token"))).toBe(false);
  });

  it("pulls with the host's own login when the release carries none", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    expect(readDockerLog().filter((line) => line.startsWith("login"))).toEqual([]);
    expect(readDockerConfigLog()).toEqual([]);
  });

  it("stops the release when the login fails, before anything is pulled", () => {
    const result = deploy("v1", packWithToken(), { FAIL_DOCKER_ON: "login " });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("deploy: cannot log in to ghcr.io with the release's registry token.");
    expect(readDockerLog().filter((line) => line.startsWith("pull"))).toEqual([]);
  });

  it("refuses an empty token with nothing installed", () => {
    const dir = join(root, "empty-token");
    mkdirSync(dir);
    for (const name of ["docker-compose.yml", "traefik.yml"]) {
      write(join(dir, name), readFileSync(join(checkout, "docker/prod", name), "utf8"));
    }
    write(join(dir, "deploy.sh"), "#!/usr/bin/env bash\n");
    write(join(dir, ".env.prod"), ENV_PROD, 0o600);
    write(join(dir, ".registry-token"), "", 0o600);
    const result = deploy("v1", tarDirectory(dir, ["."]));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("deploy: the release archive's .registry-token is empty or not a file.");
    expectNothingInstalled();
  });

  it("is a name the compose folder may not use", () => {
    write(join(checkout, "docker/prod/.registry-token"), "x\n");
    const result = pack();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::docker/prod/.registry-token is reserved on the server; rename it.");
  });
});

describe("the pack step of deploy-app.yml refuses the tag's files", () => {
  it("when the compose folder holds a symlink", () => {
    symlinkSync("/etc/passwd", join(checkout, "docker/prod/passwd"));
    const result = pack();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::docker/prod holds something other than files and folders: docker/prod/passwd");
  });

  it("when the compose folder holds a name the server reserves", () => {
    write(join(checkout, "docker/prod/deploy.sh"), "#!/usr/bin/env bash\n");
    const result = pack();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::docker/prod/deploy.sh is reserved on the server; rename it.");
  });

  it("when the compose folder holds .env.prod.prev, which the server keeps", () => {
    write(join(checkout, "docker/prod/.env.prod.prev"), ENV_PROD);
    const result = pack();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::docker/prod/.env.prod.prev is reserved on the server; rename it.");
  });

  it("when the server script or deploy.json is missing from the tag", () => {
    rmSync(join(checkout, "deploy.json"));
    const result = pack();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::deploy.json is not a file in the tag.");
  });
});

describe("deploy.sh puts the previous files back when a release fails before the switch", () => {
  function snapshotServer(): Map<string, string> {
    const files = new Map<string, string>();
    for (const name of ["docker-compose.yml", "traefik.yml", "deploy.json", "deploy.sh", ".env.prod", ".deployed-tag"]) {
      files.set(name, readFileSync(join(server, name), "utf8"));
    }
    return files;
  }

  function changeEveryShippedFile(): void {
    for (const path of ["docker/prod/docker-compose.yml", "docker/prod/traefik.yml", "deploy.json", "docker/server/deploy.sh"]) {
      const file = join(checkout, path);
      const text = readFileSync(file, "utf8");
      if (!path.endsWith(".json")) {
        writeFileSync(file, `${text}# v2\n`);
        continue;
      }
      // deploy.json is validated (strict keys), so its change is a different $schema text.
      const config = JSON.parse(text) as { $schema?: string };
      writeFileSync(file, JSON.stringify({ ...config, $schema: `${config.$schema ?? ""}#v2` }));
    }
    write(join(checkout, "docker/prod/extra/added.yml"), "added: true\n");
  }

  it("restores every installed file, keeps the rules' inode and removes what the release added", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    const before = snapshotServer();
    const rulesInode = statSync(join(server, "traefik.yml")).ino;
    changeEveryShippedFile();
    writeFileSync(join(checkout, ".env.prod"), "AUTH_SECRET='new'\n");

    const result = deploy("v2", packArchive(), { FAIL_DOCKER_ON: "pull " });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|pull|cannot pull ghcr.io/acme/app:v2.");
    expect(readLines(result.stdout, "step")).toEqual(["step|archive|ok", "step|files|ok", "step|settings|ok", "step|restore|ok"]);
    expect(result.stderr).toContain("deploy: the previous files and .env.prod are back in place.");
    expect(result.stderr).toContain("deploy: the previous release is v1; redeploy it to roll back.");
    expect(snapshotServer()).toEqual(before);
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe(`${ENV_PROD}TAG=v1\n`);
    expect(statSync(join(server, "traefik.yml")).ino).toBe(rulesInode);
    expect(existsSync(join(server, "extra"))).toBe(false);
    expect(existsSync(join(server, ".env.prod.prev"))).toBe(false);
    expect(readDockerLog().filter((line) => line.includes(" up "))).toHaveLength(1);
  });

  it("restores the files when the schema guard refuses the image, with a database", () => {
    writeCheckout({ facts: { ...NO_DATABASE, hasDatabase: true }, envProd: "POSTGRES_PASSWORD='pw'\n" });
    write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
    expect(deploy("v1", packArchive()).status).toBe(0);
    const before = snapshotServer();
    changeEveryShippedFile();

    const result = deploy("v2", packArchive(), { FAIL_NPX_ON: " schema-guard " });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|schema|the schema guard refused v2; nothing was restarted.");
    expect(snapshotServer()).toEqual(before);
    expect(readDockerLog().filter((line) => line.includes("traefik app"))).toHaveLength(1);
  });

  it("restores nothing once the switch started, and keeps the replaced .env.prod as .env.prod.prev", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    writeFileSync(join(checkout, ".env.prod"), "AUTH_SECRET='new'\n");
    const result = deploy("v2", packArchive(), { FAIL_DOCKER_ON: "traefik app" });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|switch|the stack did not become healthy on v2.");
    expect(readLines(result.stdout, "step")).not.toContain("step|restore|ok");
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe("AUTH_SECRET='new'\nTAG=v2\n");
    expect(readFileSync(join(server, ".env.prod.prev"), "utf8")).toBe(`${ENV_PROD}TAG=v1\n`);
    expect(statSync(join(server, ".env.prod.prev")).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(server, ".deployed-tag"), "utf8")).toBe("v1\n");
  });

  it("keeps the .env.prod of the release before the last switch as .env.prod.prev", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    writeFileSync(join(checkout, ".env.prod"), "AUTH_SECRET='v2'\n");
    expect(deploy("v2", packArchive()).status).toBe(0);
    writeFileSync(join(checkout, ".env.prod"), "AUTH_SECRET='v3'\n");
    expect(deploy("v3", packArchive()).status).toBe(0);
    expect(readFileSync(join(server, ".env.prod.prev"), "utf8")).toBe("AUTH_SECRET='v2'\nTAG=v2\n");
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe("AUTH_SECRET='v3'\nTAG=v3\n");
  });

  it("replaces a TAG line the rendered .env.prod already carries", () => {
    writeFileSync(join(checkout, ".env.prod"), "TAG=stale\nAUTH_SECRET='s3cret'\n");
    expect(deploy("v1", packArchive()).status).toBe(0);
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe("AUTH_SECRET='s3cret'\nTAG=v1\n");
  });
});

describe("deploy.sh keeps one maintenance line of its app in the crontab", () => {
  it("rewrites its own line on every release and keeps the other lines, another app's too", () => {
    const foreign = "0 1 * * * /usr/local/bin/other-job # softure-deploy:acme-app-2\n5 * * * * echo keep\n";
    writeFileSync(crontabFile, foreign);
    expect(deploy("v1", packArchive()).status).toBe(0);
    expect(deploy("v2", packArchive()).status).toBe(0);
    const lines = readFileSync(crontabFile, "utf8").trimEnd().split("\n");
    expect(lines.slice(0, 2)).toEqual(foreign.trimEnd().split("\n"));
    expect(lines.filter((line) => line.endsWith(" # softure-deploy:acme-app"))).toHaveLength(1);
    expect(lines).toHaveLength(3);
  });

  it("leaves the crontab alone when it cannot be read", () => {
    writeFileSync(crontabFile, "5 * * * * echo keep\n");
    write(join(stubBin, "crontab"), '#!/usr/bin/env bash\nif [ "$1" = "-l" ]; then echo "crontab: permission denied" >&2; exit 1; fi\ncat > "$CRONTAB_FILE"\n', 0o755);
    const result = deploy("v1", packArchive());
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|cron|cannot read the crontab; v1 is live.");
    expect(readFileSync(crontabFile, "utf8")).toBe("5 * * * * echo keep\n");
  });

  it("reports a failed cron step after the switch, with the tag already recorded", () => {
    write(join(stubBin, "crontab"), '#!/usr/bin/env bash\nif [ "$1" = "-l" ]; then echo "no crontab for deploy" >&2; fi\nexit 1\n', 0o755);
    const result = deploy("v1", packArchive());
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|failed|cron|cannot install the maintenance cron; v1 is live.");
    expect(readFileSync(join(server, ".deployed-tag"), "utf8")).toBe("v1\n");
  });
});

describe("deploy.sh status", () => {
  function listServer(): string[] {
    return readdirSync(server, { recursive: true, encoding: "utf8" })
      .map((path) => `${path}:${String(statSync(join(server, path)).mtimeMs)}`)
      .sort();
  }

  it("reports none before the first release and writes nothing", () => {
    const before = listServer();
    const result = runServer("status", "");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("status|tag|none\nstatus|env-tag|none\nstatus|containers|none\nstatus|health|none\n");
    expect(listServer()).toEqual(before);
  });

  it("reports the live tag, the tag in .env.prod, the containers and the app's health, read only", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    const before = listServer();
    rmSync(dockerLog);
    const result = runServer("status", "");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "status|tag|v1\nstatus|env-tag|v1\nstatus|containers|traefik:Up 2 hours app:Up 2 hours (healthy)\nstatus|health|healthy\n",
    );
    expect(listServer()).toEqual(before);
    expect(readDockerLog().every((line) => / ps | inspect /.test(` ${line} `))).toBe(true);
  });
});

describe("deploy.sh maintain", () => {
  it("removes this app's images without a release folder and the dangling ones", () => {
    const archive = packArchive();
    for (const tag of ["v1", "v2", "v3", "v4", "v5", "v6"]) expect(deploy(tag, archive).status).toBe(0);
    rmSync(dockerLog);
    const result = runServer("maintain", "", { DOCKER_IMAGE_TAGS: "v1\nv2\nv6\n<none>\nlatest\n" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("step|settings|ok\nstep|images|ok|removed 2\nresult|ok\n");
    expect(readDockerLog()).toEqual([
      "image ls ghcr.io/acme/app --format {{.Tag}}",
      "image rm ghcr.io/acme/app:v1",
      "image rm ghcr.io/acme/app:latest",
      "image prune --force",
    ]);
  });

  it("backs up with the release's retention first when there is a database", () => {
    writeCheckout({ facts: { ...NO_DATABASE, hasDatabase: true }, envProd: "POSTGRES_PASSWORD='pw'\n" });
    write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
    expect(deploy("v1", packArchive()).status).toBe(0);
    rmSync(npxLog);
    const result = runServer("maintain", "");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      `step|settings|ok\nbackup: wrote ${server}/backups/db-20261006-120000.dump (2048 bytes)\nstep|backup|ok|db-20261006-120000.dump\nstep|images|ok|removed 0\nresult|ok\n`,
    );
    expect(readFileSync(npxLog, "utf8")).toMatch(
      new RegExp(`--yes @softure-ai/deploy@9\\.9\\.9 backup --dir=${server}/backups --prefix=db --keep=7 --max-age-days=30\n$`),
    );
  });

  it("fails before anything is deployed", () => {
    const result = runServer("maintain", "");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("result|failed|env|nothing is deployed here yet.\n");
  });
});

describe("deploy.sh refuses a command", () => {
  it.each([["", "command"], ["deploy", "command"], ["status now", "command"], ["rm -rf /", "command"], ["deploy v1\nstatus", "command"]])(
    "%j with exit 2 and a failed result",
    (command, step) => {
      const result = runServer(command, "");
      expect(result.status).toBe(2);
      expect(result.stdout).toMatch(new RegExp(`^result\\|failed\\|${step}\\|expected `));
      expect(readDockerLog()).toEqual([]);
    },
  );

  it("with a tag that is not a Docker tag", () => {
    const result = runServer("deploy ../v1", "");
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("result|failed|command|the tag is not a Docker tag (letters, digits, _ . -; at most 128).\n");
  });
});

describe("the send step of deploy-app.yml", () => {
  // The step as GitHub runs it by default (bash -e), with an ssh stub that prints what a server would.
  function send(serverOutput: string, exitCode = 0): BashResult {
    write(join(stubBin, "ssh"), `#!/usr/bin/env bash\ncat > /dev/null\nprintf '%s' "$SERVER_OUTPUT"\nexit ${String(exitCode)}\n`, 0o755);
    writeFileSync(join(checkout, "release.tar.gz"), "archive");
    const result = spawnSync("bash", ["-e", "-c", SEND_SCRIPT], {
      cwd: checkout,
      encoding: "utf8",
      env: {
        PATH: `${stubBin}:${process.env.PATH ?? ""}`,
        RUNNER_TEMP: root,
        SSH_HOST: "203.0.113.7",
        SSH_USER: "deploy",
        SSH_PRIVATE_KEY: "key",
        SSH_KNOWN_HOSTS: "host",
        SSH_PORT: "22",
        REMOTE_COMMAND: "deploy",
        TAG: "v1",
        SERVER_OUTPUT: serverOutput,
      },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it("passes when the server reports result|ok and keeps its lines", () => {
    const result = send("step|archive|ok\nresult|ok\n");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("step|archive|ok\nresult|ok\n");
    expect(readFileSync(join(root, "deploy-output.txt"), "utf8")).toBe("step|archive|ok\nresult|ok\n");
  });

  it("fails when the session ends without result|ok, even with exit status 0", () => {
    const result = send("step|archive|ok\nstep|files|ok\n");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::The server did not report result|ok");
  });

  it("fails with the server's status when ssh fails", () => {
    const result = send("result|failed|pull|cannot pull ghcr.io/acme/app:v1.\n", 1);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("::error::");
  });
});
