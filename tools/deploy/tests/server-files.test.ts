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

// The database steps run the CLI through npx; the stub only records the call.
const STUB_NPX = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$NPX_LOG"
exit 0
`;

// DF-11: a command run under a DOCKER_CONFIG is also logged with that folder, and the login's stdin is kept.
const STUB_DOCKER = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ -n "\${DOCKER_CONFIG:-}" ]; then printf '%s %s\\n' "$1" "$DOCKER_CONFIG" >> "$DOCKER_CONFIG_LOG"; fi
if [ "$1" = "login" ]; then cat > "$LOGIN_STDIN"; fi
if [ -n "\${FAIL_COMPOSE_CONFIG:-}" ] && [[ " $* " == *" config "* ]]; then exit 1; fi
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

function getPackScript(): string {
  const workflow = parse(readFileSync(WORKFLOW, "utf8")) as { jobs: Record<string, { steps?: Step[] }> };
  const step = (workflow.jobs.deploy?.steps ?? []).find((candidate) => candidate.name === "Pack the release");
  if (step?.run === undefined) throw new Error("deploy-app.yml has no 'Pack the release' step");
  return step.run;
}

const PACK_SCRIPT = getPackScript();

let root: string;
let checkout: string;
let server: string;
let dockerLog: string;
let stubBin: string;
let npxLog: string;

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

function deploy(tag: string, input: Buffer | string, env: Record<string, string> = {}): BashResult {
  const result = spawnSync("bash", [join(server, "deploy.sh")], {
    input,
    encoding: "utf8",
    env: {
      PATH: `${stubBin}:${process.env.PATH ?? ""}`,
      SSH_ORIGINAL_COMMAND: `deploy ${tag}`,
      DOCKER_LOG: dockerLog,
      DOCKER_CONFIG_LOG: join(root, "docker-config.log"),
      LOGIN_STDIN: join(root, "login-stdin"),
      NPX_LOG: npxLog,
      ...env,
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
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
  expect(readdirSync(server).filter((name) => name !== "releases")).toEqual(["deploy.sh"]);
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
  writeCheckout();
  // The first setup: the owner copies deploy.sh once and binds the deploy key to it.
  write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
  write(join(stubBin, "docker"), STUB_DOCKER, 0o755);
  write(join(stubBin, "npx"), STUB_NPX, 0o755);
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
    expect(readFileSync(join(server, ".env.prod"), "utf8")).toBe(ENV_PROD);
    expect(statSync(join(server, ".env.prod")).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(server, ".deployed-tag"), "utf8")).toBe("v1.2.3\n");
    expect(readdirSync(join(server, "releases"))).toEqual(["v1.2.3"]);
    expect(existsSync(join(server, "releases/v1.2.3/.env.prod"))).toBe(false);
    expect(readDockerLog()).toEqual([
      expect.stringMatching(/^compose .*--file .*releases\/v1\.2\.3\/docker-compose\.yml config --quiet$/) as unknown,
      "pull --quiet ghcr.io/acme/app:v1.2.3",
      "compose --env-file .env.prod --file docker-compose.yml up --detach --wait --remove-orphans traefik app",
    ]);
  });

  it("keeps the rules' inode, restarts Traefik when they change and replaces deploy.sh by a rename", () => {
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
    expect(readDockerLog().at(-1)).toBe("compose --env-file .env.prod --file docker-compose.yml restart traefik");
    expect(readdirSync(join(server, "releases")).sort()).toEqual(["v1", "v2"]);
  });

  it("does not restart Traefik when its rules did not change", () => {
    expect(deploy("v1", packArchive()).status).toBe(0);
    expect(deploy("v2", packArchive()).status).toBe(0);
    expect(readDockerLog().filter((line) => line.includes("restart"))).toEqual([]);
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
      expect.stringMatching(new RegExp(`^--yes @softure-ai/deploy@9\\.9\\.9 row-counts --config=${config} --compare=\\S+/counts-before\\.json$`)) as unknown,
    ]);
    expect(readDockerLog()).toContain("compose --env-file .env.prod --file docker-compose.yml up --detach --wait --remove-orphans traefik app");
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
    expect(result.stderr).toContain("deploy: cannot read the row-count tables of the release's deploy.json.");
    expect(result.stderr).toContain("deploy: the previous release is v1; redeploy it to roll back.");
    expect(readDockerLog().filter((line) => line.includes("traefik app"))).toEqual([]);
    expect(readRowCountCalls()).toEqual([]);
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
    expect(listing).toMatch(/^-rw------- 0\/0 .* \.\/\.registry-token$/m);
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
    write(join(stubBin, "docker"), `${STUB_DOCKER.replace("exit 0\n", "")}if [ "$1" = "login" ]; then exit 1; fi\nexit 0\n`, 0o755);
    const result = deploy("v1", packWithToken());
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

  it("when the server script or deploy.json is missing from the tag", () => {
    rmSync(join(checkout, "deploy.json"));
    const result = pack();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::deploy.json is not a file in the tag.");
  });
});
