import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

const PACKAGE_VERSION = (JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8")) as { version: string }).version;
const REQUIRED = ["--domain=example.com", "--image=ghcr.io/acme/app"];

let dir: string;
let out: string[];
let err: string[];

function makeIo(): CliIo {
  return { cwd: dir, env: {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

function writeApp(pkg: object, nextConfig = 'export default { output: "standalone" };\n'): void {
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(dir, "next.config.ts"), nextConfig);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-init-cli-"));
  out = [];
  err = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy init", () => {
  it("writes every file of an app with a database and names each one", async () => {
    writeApp({ name: "@acme/shop", dependencies: { "@softure-ai/db": "^0.1.2", "@softure-ai/ops": "^0.1.2" } });
    const code = await runCli(["init", ...REQUIRED, "--env=AUTH_SECRET", "--tables=users"], makeIo());
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out.join("")).toBe(
      [
        "wrote   Dockerfile",
        "wrote   .dockerignore",
        "wrote   docker/prod/docker-compose.yml",
        "wrote   docker/prod/traefik.yml",
        "wrote   docker/prod/initdb/01-roles.sql",
        "wrote   docker/server/deploy.sh",
        "wrote   scripts/migrate.ts",
        "wrote   .github/workflows/deploy.yml",
        "wrote   deploy.json",
        "init: 9 written, 0 kept, database part on (@softure-ai/db found in package.json).",
        "",
      ].join("\n"),
    );
    expect(statSync(join(dir, "docker/server/deploy.sh")).mode & 0o777).toBe(0o755);
    const script = readFileSync(join(dir, "docker/server/deploy.sh"), "utf8");
    expect(script).toContain(`DEPLOY_CLI="@softure-ai/deploy@${PACKAGE_VERSION}"`);
    expect(script).toContain('command="/srv/shop/deploy.sh",restrict');
  });

  it("keeps the app's own files, then overwrites them with --force", async () => {
    writeApp({ name: "shop" });
    writeFileSync(join(dir, "Dockerfile"), "FROM scratch\n");
    expect(await runCli(["init", ...REQUIRED], makeIo())).toBe(0);
    expect(readFileSync(join(dir, "Dockerfile"), "utf8")).toBe("FROM scratch\n");
    expect(out.join("")).toContain("kept    Dockerfile (exists; --force overwrites it)\n");
    expect(out.join("")).toContain("init: 6 written, 1 kept, database part off (@softure-ai/db not found in package.json).\n");
    out = [];
    expect(await runCli(["init", ...REQUIRED, "--force"], makeIo())).toBe(0);
    expect(readFileSync(join(dir, "Dockerfile"), "utf8")).toContain("FROM ${NODE_IMAGE} AS builder");
    expect(out.join("")).toContain("init: 7 written, 0 kept");
  });

  it("generates into --dir relative to the working directory", async () => {
    const app = mkdtempSync(join(dir, "app-"));
    writeFileSync(join(app, "package.json"), JSON.stringify({ name: "shop" }));
    expect(await runCli(["init", ...REQUIRED, `--dir=${app}`], makeIo())).toBe(0);
    expect(existsSync(join(app, "deploy.json"))).toBe(true);
    expect(existsSync(join(dir, "deploy.json"))).toBe(false);
  });

  it("warns when next.config is missing or does not build standalone", async () => {
    writeApp({ name: "shop" }, "export default {};\n");
    expect(await runCli(["init", ...REQUIRED], makeIo())).toBe(0);
    expect(out.join("")).toContain('warning next.config.ts does not mention "standalone"; the Dockerfile needs output: "standalone"\n');
  });

  it("is a usage error without --domain and --image, or with an unknown flag", async () => {
    writeApp({ name: "shop" });
    expect(await runCli(["init"], makeIo())).toBe(2);
    expect(err.join("")).toBe("init: missing --domain and --image.\n");
    err = [];
    expect(await runCli(["init", ...REQUIRED, "--domian=x"], makeIo())).toBe(2);
    expect(err.join("")).toContain("init: Unknown option '--domian'");
  });

  it("refuses invalid answers with every problem and writes nothing", async () => {
    writeApp({ name: "shop" });
    const code = await runCli(["init", "--domain=Example.com", "--image=ghcr.io/acme/app:1", "--env=PATH"], makeIo());
    expect(code).toBe(1);
    expect(err.join("")).toBe(
      "init: nothing written; domain: a lower-case host name such as example.com; image: registry/name in lower case without a tag, such as ghcr.io/acme/app; env.0: reserved for the runner (PATH, HOME, NODE_*, NPM_CONFIG_*).\n",
    );
    expect(existsSync(join(dir, "Dockerfile"))).toBe(false);
  });

  it("refuses a folder without package.json", async () => {
    expect(await runCli(["init", ...REQUIRED], makeIo())).toBe(1);
    expect(err.join("")).toBe(`init: cannot read package.json in ${dir} (ENOENT); run init in the app's folder or pass --dir.\n`);
  });
});
