import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

const PACKAGE_VERSION = (JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8")) as { version: string }).version;
const REQUIRED = ["--domain=example.com", "--image=ghcr.io/acme/app"];
const WORKFLOWS_SHA = "8d8b8e5a7c246b9afe4e92dc055105f042af37ab";
const MASTER_REF_WARNING = `warning .github/workflows call SOFTURE/AI's workflows at master; pin the commit of the deploy@${PACKAGE_VERSION} release instead (git ls-remote https://github.com/SOFTURE/AI 'refs/tags/deploy@${PACKAGE_VERSION}^{}' prints it) with --workflows-ref=<sha>, or edit their uses: lines`;

let dir: string;
let out: string[];
let err: string[];

function makeIo(): CliIo {
  return { cwd: dir, env: {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

const NEXT_CONFIG = 'export default { output: "standalone", serverExternalPackages: ["@softure-ai/db", "pg"] };\n';

function writeApp(pkg: object, nextConfig = NEXT_CONFIG): void {
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
        "wrote   .github/workflows/release.yml",
        "wrote   deploy.json",
        MASTER_REF_WARNING,
        "init: 10 written, 0 kept, database part on (@softure-ai/db found in package.json).",
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
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/release.yml"), "name: own-release\n");
    expect(await runCli(["init", ...REQUIRED], makeIo())).toBe(0);
    expect(readFileSync(join(dir, "Dockerfile"), "utf8")).toBe("FROM scratch\n");
    expect(readFileSync(join(dir, ".github/workflows/release.yml"), "utf8")).toBe("name: own-release\n");
    expect(out.join("")).toContain("kept    Dockerfile (exists; --force overwrites it)\n");
    expect(out.join("")).toContain("kept    .github/workflows/release.yml (exists; --force overwrites it)\n");
    expect(out.join("")).toContain("init: 6 written, 2 kept, database part off (@softure-ai/db not found in package.json).\n");
    out = [];
    expect(await runCli(["init", ...REQUIRED, "--force"], makeIo())).toBe(0);
    expect(readFileSync(join(dir, "Dockerfile"), "utf8")).toContain("FROM ${NODE_IMAGE} AS builder");
    expect(readFileSync(join(dir, ".github/workflows/release.yml"), "utf8")).toContain("deploy-cut-release.yml");
    expect(out.join("")).toContain("init: 8 written, 0 kept");
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

  describe("serverExternalPackages of a database app", () => {
    const DATABASE_APP = { name: "shop", dependencies: { "@softure-ai/db": "^0.1.2" } };
    const SERVER_EXTERNAL_WARNING =
      'warning next.config.ts does not list "@softure-ai/db" in serverExternalPackages; next build cannot resolve the database driver the app does not install (see serverExternalPackages in the @softure-ai/db README, §2 Installation)\n';

    async function warningsFor(pkg: object, nextConfig: string): Promise<string[]> {
      writeApp(pkg, nextConfig);
      expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
      return out
        .join("")
        .split("\n")
        .filter((line) => line.startsWith("warning "))
        .map((line) => `${line}\n`);
    }

    it("gives no warning when the list names @softure-ai/db", async () => {
      const config = 'export default { output: "standalone", serverExternalPackages: ["@softure-ai/db", "pg"] };\n';
      expect(await warningsFor(DATABASE_APP, config)).toEqual([]);
    });

    it("warns when the list lacks @softure-ai/db", async () => {
      const config = 'export default { output: "standalone", serverExternalPackages: ["pg"] /* @softure-ai/db */ };\n';
      expect(await warningsFor(DATABASE_APP, config)).toEqual([SERVER_EXTERNAL_WARNING]);
    });

    it("warns when the config has no serverExternalPackages", async () => {
      expect(await warningsFor(DATABASE_APP, 'export default { output: "standalone" };\n')).toEqual([SERVER_EXTERNAL_WARNING]);
    });

    it("gives no warning when the list is a variable that names @softure-ai/db", async () => {
      const config = "const external = ['@softure-ai/db', 'pg'];\nexport default { output: \"standalone\", serverExternalPackages: external };\n";
      expect(await warningsFor(DATABASE_APP, config)).toEqual([]);
    });

    it("gives no warning in an app without @softure-ai/db", async () => {
      expect(await warningsFor({ name: "shop" }, 'export default { output: "standalone" };\n')).toEqual([]);
    });

    it("prints it after the standalone warning", async () => {
      expect(await warningsFor(DATABASE_APP, "export default {};\n")).toEqual([
        'warning next.config.ts does not mention "standalone"; the Dockerfile needs output: "standalone"\n',
        SERVER_EXTERNAL_WARNING,
      ]);
    });
  });

  describe("an app that keeps its own compose file", () => {
    const DATABASE_APP = { name: "fire-tracker", dependencies: { "@softure-ai/db": "^0.1.2" } };

    function writeCompose(postgresImage: string, databaseUrl: string): void {
      mkdirSync(join(dir, "docker/prod"), { recursive: true });
      writeFileSync(
        join(dir, "docker/prod/docker-compose.yml"),
        [
          "services:",
          "  app:",
          "    image: ghcr.io/acme/fire:${TAG}",
          "    environment:",
          `      DATABASE_URL: ${databaseUrl}`,
          "  postgres:",
          `    image: ${postgresImage}`,
          "",
        ].join("\n"),
      );
    }

    async function runInit(...flags: string[]): Promise<{ script: string; warnings: string[] }> {
      writeApp(DATABASE_APP);
      expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`, ...flags], makeIo())).toBe(0);
      const warnings = out
        .join("")
        .split("\n")
        .filter((line) => line.startsWith("warning "));
      return { script: readFileSync(join(dir, "docker/server/deploy.sh"), "utf8"), warnings };
    }

    it("builds the tools image with its Postgres major and reports as its app role", async () => {
      writeCompose("postgres:17-alpine", "postgresql://fire_tracker_app:${FIRE_APP_PASSWORD:?}@postgres:5432/fire_tracker");
      const { script, warnings } = await runInit();
      expect(script).toContain(`TOOLS_IMAGE="softure-deploy-tools:${PACKAGE_VERSION}-pg17"`);
      expect(script).toContain("apk add --no-cache postgresql17-client");
      expect(script).toContain("REPORT_ROLE=fire_tracker_app\n");
      expect(script).not.toContain("pg16");
      expect(warnings).toEqual([]);
      expect(out.join("")).toContain("kept    docker/prod/docker-compose.yml (exists; --force overwrites it)\n");
    });

    it("warns and keeps the defaults when the image or the role cannot be read", async () => {
      writeCompose("postgres:latest", "postgresql://${DB_USER:?}:${DB_PASSWORD:?}@postgres:5432/fire_tracker");
      const { script, warnings } = await runInit();
      expect(script).toContain(`TOOLS_IMAGE="softure-deploy-tools:${PACKAGE_VERSION}-pg16"`);
      expect(script).toContain("REPORT_ROLE=softure_app\n");
      expect(warnings).toEqual([
        "warning docker/prod/docker-compose.yml: no Postgres major version in the postgres service's image; deploy.sh's tools image carries pg_dump 16",
        "warning docker/prod/docker-compose.yml: no role in the app service's DATABASE_URL; deploy.sh's report reads as softure_app",
      ]);
    });

    it("keeps the major but reports as softure_app when --force replaces the compose file", async () => {
      writeCompose("postgres:17-alpine", "postgresql://fire_tracker_app:${FIRE_APP_PASSWORD:?}@postgres:5432/fire_tracker");
      const { script, warnings } = await runInit("--force");
      const composeText = readFileSync(join(dir, "docker/prod/docker-compose.yml"), "utf8");
      expect(composeText).toContain("    image: postgres:17\n");
      expect(composeText).toContain("DATABASE_URL: postgresql://softure_app:");
      expect(script).toContain(`TOOLS_IMAGE="softure-deploy-tools:${PACKAGE_VERSION}-pg17"`);
      expect(script).toContain("REPORT_ROLE=softure_app\n");
      expect(warnings).toEqual([]);
    });

    it("reads nothing from the compose file of an app without a database", async () => {
      writeCompose("postgres:latest", "postgresql://${DB_USER:?}@postgres:5432/x");
      writeApp({ name: "fire-tracker" });
      expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
      expect(out.join("")).not.toContain("warning ");
    });
  });

  describe("the ref of SOFTURE/AI's workflows", () => {
    it("pins both callers to --workflows-ref without a warning", async () => {
      writeApp({ name: "shop" });
      expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
      expect(readFileSync(join(dir, ".github/workflows/deploy.yml"), "utf8")).toContain(
        `uses: SOFTURE/AI/.github/workflows/deploy-app.yml@${WORKFLOWS_SHA}\n`,
      );
      expect(readFileSync(join(dir, ".github/workflows/release.yml"), "utf8")).toContain(
        `uses: SOFTURE/AI/.github/workflows/deploy-cut-release.yml@${WORKFLOWS_SHA}\n`,
      );
      expect(out.join("")).not.toContain("warning ");
    });

    it("calls master and says how to pin the release commit without it", async () => {
      writeApp({ name: "shop" });
      expect(await runCli(["init", ...REQUIRED], makeIo())).toBe(0);
      expect(readFileSync(join(dir, ".github/workflows/deploy.yml"), "utf8")).toContain(
        "uses: SOFTURE/AI/.github/workflows/deploy-app.yml@master\n",
      );
      expect(out.join("")).toContain(`${MASTER_REF_WARNING}\n`);
    });

    it("gives no ref warning when the app keeps both callers", async () => {
      writeApp({ name: "shop" });
      mkdirSync(join(dir, ".github/workflows"), { recursive: true });
      writeFileSync(join(dir, ".github/workflows/deploy.yml"), "name: own-deploy\n");
      writeFileSync(join(dir, ".github/workflows/release.yml"), "name: own-release\n");
      expect(await runCli(["init", ...REQUIRED], makeIo())).toBe(0);
      expect(out.join("")).not.toContain("warning ");
    });

    it("refuses a ref that is not a full commit SHA", async () => {
      writeApp({ name: "shop" });
      expect(await runCli(["init", ...REQUIRED, "--workflows-ref=deploy-workflows-v1"], makeIo())).toBe(1);
      expect(err.join("")).toBe("init: nothing written; workflowsRef: a full commit SHA of SOFTURE/AI (40 hex characters).\n");
      expect(existsSync(join(dir, "Dockerfile"))).toBe(false);
    });
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
