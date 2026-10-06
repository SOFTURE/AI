import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { E2E_APP_DIR, planE2eAppFiles } from "../scripts/write-e2e-app.js";

// DF-3: the end-to-end test of deploy-app.yml (.github/workflows/e2e-deploy.yml) sends a release to a throwaway SSH
// server whose forced command (record.sh) records what it received; check-received.sh then compares that with the
// tag. Here the three pieces run together without SSH: the workflow's pack step in a fake checkout of the committed
// e2e app, record.sh with the archive on stdin, and check-received.sh on what it recorded.

const REPO_ROOT = join(import.meta.dirname, "../../..");
const WORKFLOW = join(REPO_ROOT, ".github/workflows/deploy-app.yml");
const RECORD = join(import.meta.dirname, "../e2e/server/record.sh");
const CHECK = join(import.meta.dirname, "../e2e/check-received.sh");

const APP = "tools/deploy/e2e/app";
const COMPOSE_FILE = `${APP}/docker/prod/docker-compose.yml`;
const SERVER_SCRIPT = `${APP}/docker/server/deploy.sh`;
const DEPLOY_CONFIG = `${APP}/deploy.json`;
const TAG = "0123456789abcdef0123456789abcdef01234567";
const IMAGE = "ghcr.io/softure/ai-deploy-e2e";
const ENV_NAMES = ["AUTH_SECRET", "POSTGRES_PASSWORD", "SOFTURE_APP_PASSWORD", "SOFTURE_MIGRATOR_PASSWORD"];
const ENV_PROD = ENV_NAMES.map((name) => `${name}=placeholder-${name.toLowerCase()}\n`).join("");

interface Step {
  name?: string;
  run?: string;
}

interface Result {
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

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => statSync(join(dir, path)).isFile())
    .map((path) => relative(dir, join(dir, path)))
    .sort();
}

let root: string;
let checkout: string;
let received: string;

function run(command: string, args: string[], options: { cwd: string; env: Record<string, string>; input?: Buffer }): Result {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { PATH: process.env.PATH ?? "", ...options.env },
    input: options.input,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function pack(): Buffer {
  const result = run("bash", ["-euo", "pipefail", "-c", getPackScript()], {
    cwd: checkout,
    env: { RUNNER_TEMP: root, COMPOSE_FILE, SERVER_SCRIPT, DEPLOY_CONFIG, REGISTRY_TOKEN: "placeholder-token" },
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return readFileSync(join(checkout, "release.tar.gz"));
}

function record(input: Buffer, command = `deploy ${TAG}`): Result {
  return run("sh", [RECORD], { cwd: root, env: { RECEIVED_DIR: received, SSH_ORIGINAL_COMMAND: command }, input });
}

function check(overrides: Record<string, string> = {}): Result {
  return run("bash", [CHECK], {
    cwd: checkout,
    env: {
      RECEIVED_DIR: received,
      COMPOSE_FILE,
      SERVER_SCRIPT,
      DEPLOY_CONFIG,
      TAG,
      IMAGE: `${IMAGE}:${TAG}`,
      EXPECTED_IMAGE: IMAGE,
      EXPECTED_ENV_NAMES: ENV_NAMES.join(" "),
      ...overrides,
    },
  });
}

function readRecorded(name: string): string {
  return readFileSync(join(received, name), "utf8");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "deploy-e2e-"));
  checkout = join(root, "checkout");
  received = join(root, "received");
  cpSync(E2E_APP_DIR, join(checkout, APP), { recursive: true });
  writeFileSync(join(checkout, ".env.prod"), ENV_PROD, { mode: 0o600 });
  mkdirSync(received);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the committed e2e app", () => {
  it("is what init writes for the example app; run `npm run e2e-app -w @softure-ai/deploy` after a template change", () => {
    const planned = planE2eAppFiles();
    expect(listFiles(E2E_APP_DIR)).toEqual(planned.map((file) => file.path).sort());
    for (const file of planned) expect(readFileSync(join(E2E_APP_DIR, file.path), "utf8"), file.path).toBe(file.text);
  });

  it("requires exactly the env names e2e-deploy.yml expects", () => {
    const compose = readFileSync(join(REPO_ROOT, COMPOSE_FILE), "utf8");
    const required = [...new Set([...compose.matchAll(/\$\{([A-Z_][A-Z0-9_]*):?\?\}/g)].map((match) => match[1]))].sort();
    expect(required).toEqual(ENV_NAMES);
  });
});

describe("record.sh, the e2e server's forced command", () => {
  it("records the command line, the files, their hashes, the modes of .env.prod and the token, never a value", () => {
    const result = record(pack());
    expect(result.status, result.stderr).toBe(0);
    // deploy-app.yml's send step requires this line, as from init's deploy.sh.
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("result|ok");
    expect(readRecorded("command")).toBe(`deploy ${TAG}\n`);
    expect(readRecorded("files")).toBe(
      [
        "./.env.prod",
        "./.registry-token",
        "./deploy.json",
        "./deploy.sh",
        "./docker-compose.yml",
        "./initdb/01-roles.sql",
        "./traefik.yml",
      ].join("\n") + "\n",
    );
    const hashes = readRecorded("sha256").trim().split("\n");
    expect(hashes.map((line) => line.replace(/^[0-9a-f]{64} {2}/, ""))).toEqual([
      "./deploy.json",
      "./deploy.sh",
      "./docker-compose.yml",
      "./initdb/01-roles.sql",
      "./traefik.yml",
    ]);
    expect(readRecorded("env-mode")).toBe("-rw-------\n");
    expect(readRecorded("token-mode")).toBe("-rw-------\n");
    expect(readRecorded("env-names")).toBe(`${ENV_NAMES.join("\n")}\n`);
    for (const name of readdirSync(received)) expect(readRecorded(name)).not.toContain("placeholder-");
  });

  it("refuses an empty stdin", () => {
    const result = record(Buffer.alloc(0));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stdin was empty");
  });

  it("refuses a stdin that is not a gzip tar archive", () => {
    const result = record(Buffer.from(ENV_PROD));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not a gzip tar archive");
  });
});

describe("check-received.sh", () => {
  beforeEach(() => {
    expect(record(pack()).status).toBe(0);
  });

  it("passes when the server received the tag's files, command line and env names", () => {
    const result = check();
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout.match(/^ok: /gm)).toHaveLength(7);
  });

  it.each([
    ["a wrong command line", () => writeFileSync(join(received, "command"), "deploy other\n"), "command line"],
    ["a 0644 .env.prod", () => writeFileSync(join(received, "env-mode"), "-rw-r--r--\n"), ".env.prod mode"],
    ["a 0644 registry token", () => writeFileSync(join(received, "token-mode"), "-rw-r--r--\n"), ".registry-token mode"],
    [
      "no registry token",
      () => writeFileSync(join(received, "files"), readRecorded("files").replace("./.registry-token\n", "")),
      "files",
    ],
    ["a missing env name", () => writeFileSync(join(received, "env-names"), "AUTH_SECRET\n"), "env names"],
    [
      "an extra env name",
      () => writeFileSync(join(received, "env-names"), `${ENV_NAMES.join("\n")}\nUNUSED_SECRET\n`),
      "env names",
    ],
    [
      "a missing file",
      () => writeFileSync(join(received, "files"), readRecorded("files").replace("./traefik.yml\n", "")),
      "files",
    ],
    ["an extra file", () => writeFileSync(join(received, "files"), `${readRecorded("files")}./extra.txt\n`), "files"],
    [
      "a changed byte",
      () => writeFileSync(join(received, "sha256"), readRecorded("sha256").replace(/^[0-9a-f]/, (digit) => (digit === "0" ? "1" : "0"))),
      "differs from the tag",
    ],
    ["no recorded files at all", () => rmSync(join(received, "files")), "recorded no files"],
  ])("fails on %s, naming the check", (_case, mutate, message) => {
    mutate();
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(message);
  });

  it("fails on a wrong image reference", () => {
    const result = check({ IMAGE: `${IMAGE}:latest` });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("image");
  });
});
