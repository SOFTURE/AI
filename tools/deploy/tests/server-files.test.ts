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

const STUB_DOCKER = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
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

function write(path: string, text: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  chmodSync(path, mode);
}

function writeCheckout(): void {
  const files = planInitFiles({ answers: ANSWERS, facts: NO_DATABASE, cliVersion: "9.9.9" });
  for (const file of files) write(join(checkout, file.path), file.text, file.mode);
  writeFileSync(join(checkout, ".env.prod"), ENV_PROD);
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
  writeCheckout();
  // The first setup: the owner copies deploy.sh once and binds the deploy key to it.
  write(join(server, "deploy.sh"), readFileSync(join(checkout, "docker/server/deploy.sh"), "utf8"), 0o755);
  write(join(stubBin, "docker"), STUB_DOCKER, 0o755);
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
