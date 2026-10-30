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
        "wrote   docker/prod/hooks/lib.sh",
        "wrote   docker/server/deploy.sh",
        "wrote   scripts/migrate.ts",
        "wrote   .github/workflows/deploy.yml",
        "wrote   .github/workflows/release.yml",
        "wrote   .github/workflows/release-notes.yml",
        "wrote   .github/workflows/checks.yml",
        "wrote   deploy.json",
        MASTER_REF_WARNING,
        "init: 13 written, 0 kept, database part on (@softure-ai/db found in package.json).",
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
    expect(out.join("")).toContain("init: 9 written, 2 kept, database part off (@softure-ai/db not found in package.json).\n");
    out = [];
    expect(await runCli(["init", ...REQUIRED, "--force"], makeIo())).toBe(0);
    expect(readFileSync(join(dir, "Dockerfile"), "utf8")).toContain("FROM ${NODE_IMAGE} AS builder");
    expect(readFileSync(join(dir, ".github/workflows/release.yml"), "utf8")).toContain("deploy-cut-release.yml");
    expect(out.join("")).toContain("init: 11 written, 0 kept");
  });

  it("writes the Cloudflare origin lock with --cdn=cloudflare and names the steps it leaves to the owner", async () => {
    writeApp({ name: "shop" });
    expect(await runCli(["init", ...REQUIRED, "--cdn=cloudflare", `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(err).toEqual([]);
    const text = out.join("");
    expect(text).toContain("wrote   docker/prod/hooks/cloudflare-ranges.sh\n");
    expect(text).toContain("wrote   docker/server/cloudflare-only.sh\n");
    expect(statSync(join(dir, "docker/server/cloudflare-only.sh")).mode & 0o777).toBe(0o755);
    expect(text).toContain(
      "next    as root on the server, install docker/server/cloudflare-only.sh and its two units (the steps are in its header); the firewall lets only Cloudflare reach ports 80 and 443\n",
    );
    expect(text).toContain(
      "next    set the DEPLOY_ORIGIN_IP secret to the server's own address, so verify checks that a direct connection gets no answer\n",
    );
    expect(await runCli(["init", ...REQUIRED, "--cdn=akamai"], makeIo())).toBe(1);
    expect(err.join("")).toContain("cdn: cloudflare, the only CDN init knows");
  });

  it("joins an edge network with --edge, without Traefik's files, and warns about a second Postgres port", async () => {
    writeApp({ name: "shop", dependencies: { "@softure-ai/db": "^0.1.2" } });
    expect(await runCli(["init", ...REQUIRED, "--edge=proxy", `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(err).toEqual([]);
    const text = out.join("");
    expect(text).not.toContain("traefik.yml");
    expect(existsSync(join(dir, "docker/prod/traefik.yml"))).toBe(false);
    expect(readFileSync(join(dir, "docker/prod/docker-compose.yml"), "utf8")).toContain('      - "traefik.docker.network=proxy"\n');
    expect(text).toContain(
      "warning docker/prod/docker-compose.yml publishes Postgres on 127.0.0.1:5432, which another stack on this server may hold already; change the host port, or drop it and set database.access to compose-exec in deploy.json\n",
    );
    expect(await runCli(["init", ...REQUIRED, "--edge=proxy", "--cdn=cloudflare"], makeIo())).toBe(1);
    expect(err.join("")).toContain("edge: --cdn belongs to the stack that owns the edge Traefik; drop it with --edge");
  });

  it("publishes the app through a Cloudflare Tunnel with --tunnel and names the steps it leaves to the owner (issue #905)", async () => {
    writeApp({ name: "shop", dependencies: { "@softure-ai/db": "^0.1.2" } });
    expect(await runCli(["init", ...REQUIRED, "--tunnel", `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(err).toEqual([]);
    const text = out.join("");
    expect(existsSync(join(dir, "docker/prod/traefik.yml"))).toBe(false);
    expect(readFileSync(join(dir, "docker/prod/docker-compose.yml"), "utf8")).toContain("      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:?}\n");
    expect(readFileSync(join(dir, ".github/workflows/deploy.yml"), "utf8")).toContain("CLOUDFLARE_TUNNEL_TOKEN: ${{ secrets.CLOUDFLARE_TUNNEL_TOKEN }}");
    expect(text).toContain("warning docker/prod/docker-compose.yml publishes Postgres on 127.0.0.1:5432");
    expect(text).toContain(
      "next    in Cloudflare Zero Trust, create a remotely managed tunnel and give it the public hostname example.com with the service http://app:3000\n",
    );
    expect(text).toContain("next    set the CLOUDFLARE_TUNNEL_TOKEN secret (the production environment) to the tunnel's token\n");
    expect(text).toContain("next    send the security headers from the app (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)");
    expect(await runCli(["init", ...REQUIRED, "--tunnel", "--www"], makeIo())).toBe(1);
    expect(err.join("")).toContain("tunnel: --www is a Traefik redirect; with --tunnel add a Cloudflare redirect rule from www to the apex");
  });

  it("gives no Postgres port warning with --edge for an app without a database", async () => {
    writeApp({ name: "shop" });
    expect(await runCli(["init", ...REQUIRED, "--edge=proxy", `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(out.join("")).not.toContain("warning");
  });

  it("generates into --dir relative to the working directory", async () => {
    const app = mkdtempSync(join(dir, "app-"));
    writeFileSync(join(app, "package.json"), JSON.stringify({ name: "shop" }));
    expect(await runCli(["init", ...REQUIRED, `--dir=${app}`], makeIo())).toBe(0);
    expect(existsSync(join(app, "deploy.json"))).toBe(true);
    expect(existsSync(join(dir, "deploy.json"))).toBe(false);
  });

  it("writes the job worker for an app with @softure-ai/jobs and says so", async () => {
    writeApp({ name: "shop", dependencies: { "@softure-ai/db": "^0.1.9", "@softure-ai/jobs": "^0.1.0" } });
    expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    const output = out.join("");
    expect(output).toContain("wrote   scripts/worker.ts\n");
    expect(output).toContain("init: 14 written, 0 kept, database part on (@softure-ai/db found in package.json), worker part on (@softure-ai/jobs found).\n");
    expect(readFileSync(join(dir, "docker/prod/docker-compose.yml"), "utf8")).toContain('command: ["node", "worker.mjs"]');
  });

  it("checks the worker's loop when the installed jobs has the heartbeat, else warns that it checks only the process", async () => {
    writeApp({ name: "shop", dependencies: { "@softure-ai/db": "^0.1.9", "@softure-ai/jobs": "^0.1.2" } });
    expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(out.join("")).toContain(
      "warning @softure-ai/jobs 0.1.2 has no worker heartbeat; the worker service checks only that its process runs (upgrade to 0.1.3 or later and re-run init for a check of its loop)\n",
    );
    expect(readFileSync(join(dir, "docker/prod/docker-compose.yml"), "utf8")).toContain('test: ["CMD", "node", "-e", "process.kill(1, 0)"]');

    // The installed version wins over the range.
    mkdirSync(join(dir, "node_modules/@softure-ai/jobs"), { recursive: true });
    writeFileSync(join(dir, "node_modules/@softure-ai/jobs/package.json"), JSON.stringify({ name: "@softure-ai/jobs", version: "0.1.3" }));
    out.length = 0;
    expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`, "--force"], makeIo())).toBe(0);
    expect(out.join("")).not.toContain("no worker heartbeat");
    expect(readFileSync(join(dir, "docker/prod/docker-compose.yml"), "utf8")).toContain('test: ["CMD", "node", "worker.mjs", "--health"]');
    expect(readFileSync(join(dir, "scripts/worker.ts"), "utf8")).toContain('healthFile: "/tmp/softure-jobs-worker.alive"');
  });

  it("warns and writes no worker for @softure-ai/jobs without @softure-ai/db", async () => {
    writeApp({ name: "shop", dependencies: { "@softure-ai/jobs": "^0.1.0" } });
    expect(await runCli(["init", ...REQUIRED, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(out.join("")).toContain(
      "warning @softure-ai/jobs is a dependency but @softure-ai/db is not; the worker container needs the database part, so none was written\n",
    );
    expect(existsSync(join(dir, "scripts/worker.ts"))).toBe(false);
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
    const DATABASE_APP = { name: "ledger", dependencies: { "@softure-ai/db": "^0.1.2" } };

    function writeCompose(postgresImage: string, databaseUrl: string): void {
      mkdirSync(join(dir, "docker/prod"), { recursive: true });
      writeFileSync(
        join(dir, "docker/prod/docker-compose.yml"),
        [
          "services:",
          "  app:",
          "    image: ghcr.io/acme/ledger:${TAG}",
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
      writeCompose("postgres:17-alpine", "postgresql://ledger_app:${LEDGER_APP_PASSWORD:?}@postgres:5432/ledger");
      const { script, warnings } = await runInit();
      expect(script).toContain(`TOOLS_IMAGE="softure-deploy-tools:${PACKAGE_VERSION}-pg17"`);
      expect(script).toContain("apk add --no-cache postgresql17-client");
      expect(script).toContain("REPORT_ROLE=ledger_app\n");
      expect(script).not.toContain("pg16");
      expect(warnings).toEqual([]);
      expect(out.join("")).toContain("kept    docker/prod/docker-compose.yml (exists; --force overwrites it)\n");
    });

    it("warns and keeps the defaults when the image or the role cannot be read", async () => {
      writeCompose("postgres:latest", "postgresql://${DB_USER:?}:${DB_PASSWORD:?}@postgres:5432/ledger");
      const { script, warnings } = await runInit();
      expect(script).toContain(`TOOLS_IMAGE="softure-deploy-tools:${PACKAGE_VERSION}-pg16"`);
      expect(script).toContain("REPORT_ROLE=softure_app\n");
      expect(warnings).toEqual([
        "warning docker/prod/docker-compose.yml: no Postgres major version in the postgres service's image; deploy.sh's tools image carries pg_dump 16",
        "warning docker/prod/docker-compose.yml: no role in the app service's DATABASE_URL; deploy.sh's report reads as softure_app (name the role with --report-role=<role>)",
      ]);
    });

    it("reports as --report-role when the compose file's URL comes from a variable", async () => {
      writeCompose("postgres:17-alpine", "${DATABASE_URL:?}");
      const { script, warnings } = await runInit("--report-role=ledger_app");
      expect(script).toContain("REPORT_ROLE=ledger_app\n");
      expect(warnings).toEqual([]);
    });

    it("reports as --report-role over the compose file's role and over a replaced compose file", async () => {
      writeCompose("postgres:17-alpine", "postgresql://ledger_app:${LEDGER_APP_PASSWORD:?}@postgres:5432/ledger");
      expect((await runInit("--report-role=shop_app")).script).toContain("REPORT_ROLE=shop_app\n");
      expect((await runInit("--force", "--report-role=shop_app")).script).toContain("REPORT_ROLE=shop_app\n");
    });

    it("refuses a --report-role that is not a Postgres role name and writes nothing", async () => {
      writeApp(DATABASE_APP);
      expect(await runCli(["init", ...REQUIRED, "--report-role=ledger-app;id"], makeIo())).toBe(1);
      expect(err.join("")).toBe(
        "init: nothing written; reportRole: a Postgres role name: letters, digits and _, starting with a letter or _, at most 63.\n",
      );
      expect(existsSync(join(dir, "docker/server/deploy.sh"))).toBe(false);
    });

    it("keeps the major but reports as softure_app when --force replaces the compose file", async () => {
      writeCompose("postgres:17-alpine", "postgresql://ledger_app:${LEDGER_APP_PASSWORD:?}@postgres:5432/ledger");
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
      writeApp({ name: "ledger" });
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

    it("gives no ref warning when the app keeps every caller", async () => {
      writeApp({ name: "shop" });
      mkdirSync(join(dir, ".github/workflows"), { recursive: true });
      for (const name of ["deploy", "release", "release-notes", "checks"]) {
        writeFileSync(join(dir, `.github/workflows/${name}.yml`), `name: own-${name}\n`);
      }
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
