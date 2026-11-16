// `softure-deploy init --host=cloudflare` (RP-8): the Worker's files instead of the server's, and every VPS flag refused.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

const PACKAGE_VERSION = (JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8")) as { version: string }).version;
const CLOUDFLARE = ["--host=cloudflare", "--domain=shop.example.com"];
const WORKFLOWS_SHA = "8d8b8e5a7c246b9afe4e92dc055105f042af37ab";
const HYPERDRIVE_ID = "0123456789abcdef0123456789abcdef";
const NEXT_CONFIG =
  'import { withDatabaseBuild } from "@softure-ai/db/next-config";\nexport default withDatabaseBuild({}, { host: "cloudflare", appDir: import.meta.dirname });\n';
const DATABASE_APP = { name: "@acme/shop", dependencies: { "@softure-ai/db": "^0.1.15", "@softure-ai/ops": "^0.1.2" } };
const JOBS_APP = { name: "@acme/shop", dependencies: { "@softure-ai/db": "^0.1.15", "@softure-ai/jobs": "^0.1.11" } };

let dir: string;
let out: string[];
let err: string[];

function makeIo(): CliIo {
  return { cwd: dir, env: {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

function writeApp(pkg: object, nextConfig = NEXT_CONFIG): void {
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(dir, "next.config.ts"), nextConfig);
}

function listWarnings(): string[] {
  return out
    .join("")
    .split("\n")
    .filter((line) => line.startsWith("warning "));
}

function read(path: string): string {
  return readFileSync(join(dir, path), "utf8");
}

/** wrangler.jsonc without its comment lines, which is all the JSONC the template uses. */
function readWrangler(): Record<string, unknown> {
  const json = read("wrangler.jsonc")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(json) as Record<string, unknown>;
}

interface CallerStep {
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

interface Caller {
  permissions: unknown;
  jobs: Record<string, { "runs-on"?: string; environment?: string; steps?: CallerStep[]; uses?: string; permissions?: unknown; with?: Record<string, unknown> }>;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-init-cloudflare-"));
  out = [];
  err = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy init --host=cloudflare", () => {
  it("writes the Worker's files for an app with a database and none of the server's", async () => {
    writeApp(DATABASE_APP);
    const code = await runCli(["init", ...CLOUDFLARE, `--hyperdrive-id=${HYPERDRIVE_ID}`, `--workflows-ref=${WORKFLOWS_SHA}`, "--env=AUTH_SECRET,RESEND_API_KEY"], makeIo());
    expect(err).toEqual([]);
    expect(code).toBe(0);
    const text = out.join("");
    expect(text.split("\n").filter((line) => line.startsWith("wrote"))).toEqual([
      "wrote   wrangler.jsonc",
      "wrote   open-next.config.ts",
      "wrote   worker.ts",
      "wrote   cloudflare-sockets.d.ts",
      "wrote   scripts/migrate.ts",
      "wrote   .github/workflows/deploy.yml",
      "wrote   .github/workflows/backup.yml",
      "wrote   .github/workflows/backup-verify.yml",
      "wrote   deploy.json",
    ]);
    expect(text).toContain("init: 9 written, 0 kept, host cloudflare, database part on (@softure-ai/db found in package.json).\n");
    for (const path of ["Dockerfile", "docker/prod/docker-compose.yml", "docker/server/deploy.sh", ".github/workflows/release.yml"]) {
      expect(existsSync(join(dir, path)), path).toBe(false);
    }
    expect(text).not.toContain("Hyperdrive configuration (npx wrangler hyperdrive create");
    expect(text).toContain("next    set the MIGRATE_DATABASE_URL secret (production)");
    expect(text).toContain("next    set the secrets AUTH_SECRET, RESEND_API_KEY (production); the deploy uploads them with the Worker\n");
  });

  it("writes a wrangler.jsonc with nodejs_compat, the custom domain, Hyperdrive, Smart Placement and the required secrets", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", ...CLOUDFLARE, `--hyperdrive-id=${HYPERDRIVE_ID}`, "--env=AUTH_SECRET"], makeIo())).toBe(0);
    expect(readWrangler()).toEqual({
      $schema: "node_modules/wrangler/config-schema.json",
      name: "shop",
      main: "worker.ts",
      compatibility_date: "2026-11-01",
      compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
      assets: { directory: ".open-next/assets", binding: "ASSETS" },
      routes: [{ pattern: "shop.example.com", custom_domain: true }],
      observability: { enabled: true },
      placement: { mode: "smart" },
      hyperdrive: [{ binding: "HYPERDRIVE", id: HYPERDRIVE_ID }],
      vars: { APP_ORIGIN: "https://shop.example.com" },
      secrets: { required: ["AUTH_SECRET"] },
    });
    expect(read("wrangler.jsonc")).toContain(`(@softure-ai/deploy ${PACKAGE_VERSION})`);
  });

  it("adds the jobs Cron Trigger and the scheduled handler for an app with jobs, and a placement hint when asked", async () => {
    writeApp(JOBS_APP);
    expect(await runCli(["init", ...CLOUDFLARE, "--placement-region=aws:eu-central-1", `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    const wrangler = readWrangler();
    expect(wrangler.triggers).toEqual({ crons: ["* * * * *"] });
    expect(wrangler.placement).toEqual({ region: "aws:eu-central-1" });
    expect(wrangler.secrets).toEqual({ required: [] });
    const worker = read("worker.ts");
    expect(worker).toContain('import { createScheduledHandler } from "@softure-ai/jobs/workers";');
    expect(worker).toContain('import { handlers } from "./src/jobs/handlers";');
    expect(worker).toContain("scheduled: createScheduledHandler<Env>({ config, handlers, databaseUrl: (env) => env.HYPERDRIVE.connectionString }),");
    expect(worker).toContain("withRequestDatabase({ url: env.HYPERDRIVE.connectionString");
    // The proxy's bundle reaches workerd's sockets through the entry (withDatabaseBuild aliases cloudflare:sockets).
    expect(worker).toContain('import { connect } from "cloudflare:sockets";');
    expect(read("cloudflare-sockets.d.ts")).toContain('declare module "cloudflare:sockets"');
    expect(worker).toContain("registerCloudflareSockets(connect);");
    // Next's after() work reaches the scope's waitUntil, which keeps the request's handle open until it settles.
    expect(worker).toContain("handler.fetch(request, env, { waitUntil: scope.waitUntil, passThroughOnException: () => ctx.passThroughOnException?.() })");
    expect(worker).toContain("  fetch: handleRequest,\n");
    expect(worker).not.toContain("@softure-ai/observability");
    expect(out.join("")).toContain(", jobs tick on (@softure-ai/jobs found).\n");
    expect(listWarnings()).toEqual([]);
  });

  it("wraps the Worker's fetch with the observability Workers entry when the app depends on @softure-ai/observability", async () => {
    writeApp({ ...DATABASE_APP, dependencies: { ...DATABASE_APP.dependencies, "@softure-ai/observability": "^0.8.6" } });
    expect(await runCli(["init", ...CLOUDFLARE, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    const worker = read("worker.ts");
    expect(worker).toContain('import { withObservability } from "@softure-ai/observability/workers";');
    // The app has ops, so its health route stays out of the traces, as on Node.
    expect(worker).toContain('  fetch: withObservability<Env>(handleRequest, { ignorePaths: ["/api/health"] }),\n');
    expect(worker).not.toContain("  fetch: handleRequest,");
    expect(listWarnings()).toEqual([]);
  });

  it("warns that an app with observability but no database gets no worker.ts to wrap", async () => {
    writeApp({ name: "@acme/site", dependencies: { "@softure-ai/observability": "^0.8.6" } }, "export default {};\n");
    expect(await runCli(["init", ...CLOUDFLARE, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(existsSync(join(dir, "worker.ts"))).toBe(false);
    expect(listWarnings()).toEqual([
      "warning @softure-ai/observability is a dependency but @softure-ai/db is not, so no worker.ts was written; wrap the Worker's fetch with withObservability from @softure-ai/observability/workers for its spans and logs",
    ]);
  });

  it("warns when a database app's Next config does not use withDatabaseBuild, which a Worker needs", async () => {
    writeApp(DATABASE_APP, 'export default { serverExternalPackages: ["@softure-ai/db", "pg"] };\n');
    expect(await runCli(["init", ...CLOUDFLARE, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo())).toBe(0);
    expect(listWarnings()).toEqual([
      'warning next.config.ts does not wrap its config with withDatabaseBuild(config, { host: "cloudflare", appDir }) from @softure-ai/db/next-config; a Worker needs pg bundled with its socket and PGlite left out (see "Running on Cloudflare Workers" in the @softure-ai/db README)',
    ]);
  });

  it("writes a Hyperdrive placeholder and the step that creates it when no ID is given", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", ...CLOUDFLARE], makeIo())).toBe(0);
    expect(readWrangler().hyperdrive).toEqual([{ binding: "HYPERDRIVE", id: "<hyperdrive-id: wrangler hyperdrive create>" }]);
    expect(out.join("")).toContain("next    create the Hyperdrive configuration (npx wrangler hyperdrive create shop --connection-string=<postgres URL of the app role>)");
  });

  it("deploys OpenNext's worker directly without a database: no worker.ts, Hyperdrive, Cron Trigger or migrate step", async () => {
    writeApp({ name: "landing" });
    expect(await runCli(["init", ...CLOUDFLARE], makeIo())).toBe(0);
    const wrangler = readWrangler();
    expect(wrangler.main).toBe(".open-next/worker.js");
    expect(wrangler).not.toHaveProperty("hyperdrive");
    expect(wrangler).not.toHaveProperty("triggers");
    expect(existsSync(join(dir, "worker.ts"))).toBe(false);
    expect(existsSync(join(dir, "cloudflare-sockets.d.ts"))).toBe(false);
    expect(existsSync(join(dir, "scripts/migrate.ts"))).toBe(false);
    expect(existsSync(join(dir, ".github/workflows/backup.yml"))).toBe(false);
    expect(existsSync(join(dir, ".github/workflows/backup-verify.yml"))).toBe(false);
    const caller = parse(read(".github/workflows/deploy.yml")) as Caller;
    const action = caller.jobs.deploy?.steps?.at(-1);
    expect(action?.with).not.toHaveProperty("migrate-database-url");
    expect(action).not.toHaveProperty("env");
    expect(action?.with).not.toHaveProperty("secret-names");
  });

  it("writes a caller that deploys from the production environment on GitHub's runner with each secret by name", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", ...CLOUDFLARE, `--workflows-ref=${WORKFLOWS_SHA}`, "--env=AUTH_SECRET,RESEND_API_KEY"], makeIo())).toBe(0);
    const text = read(".github/workflows/deploy.yml");
    expect(text).not.toMatch(/secrets: inherit|toJSON\(secrets\)/);
    const caller = parse(text) as Caller;
    expect(caller.permissions).toEqual({ contents: "read" });
    const deploy = caller.jobs.deploy;
    expect(deploy?.["runs-on"]).toBe("ubuntu-latest");
    expect(deploy?.environment).toBe("production");
    const action = deploy?.steps?.at(-1);
    expect(action?.uses).toBe(`SOFTURE/AI/.github/actions/deploy-cloudflare@${WORKFLOWS_SHA}`);
    expect(action?.env).toEqual({ AUTH_SECRET: "${{ secrets.AUTH_SECRET }}", RESEND_API_KEY: "${{ secrets.RESEND_API_KEY }}" });
    expect(action?.with).toEqual({
      tag: "${{ github.event.release.tag_name || inputs.tag }}",
      "release-branch": "${{ github.event.repository.default_branch }}",
      "app-url": "https://shop.example.com",
      "api-token": "${{ secrets.CLOUDFLARE_API_TOKEN }}",
      "account-id": "${{ vars.CLOUDFLARE_ACCOUNT_ID }}",
      "migrate-database-url": "${{ secrets.MIGRATE_DATABASE_URL }}",
      "secret-names": "AUTH_SECRET RESEND_API_KEY",
      "deploy-cli-version": PACKAGE_VERSION,
      environment: "production",
    });
    expect(caller.jobs.report?.uses).toBe(`SOFTURE/AI/.github/workflows/deploy-report.yml@${WORKFLOWS_SHA}`);
    expect(caller.jobs.report?.permissions).toEqual({ contents: "write" });
  });

  it("writes a nightly backup on GitHub's runner that dumps, uploads and records like a VPS's maintain", async () => {
    writeApp(DATABASE_APP);
    const code = await runCli(["init", ...CLOUDFLARE, `--workflows-ref=${WORKFLOWS_SHA}`], makeIo());
    expect(code).toBe(0);
    const text = read(".github/workflows/backup.yml");
    expect(text).not.toMatch(/secrets: inherit|toJSON\(secrets\)/);
    const caller = parse(text) as Caller & { on: Record<string, unknown> };
    expect(caller.on).toEqual({ schedule: [{ cron: "17 3 * * *" }], workflow_dispatch: null });
    expect(caller.permissions).toEqual({ contents: "read" });
    const job = caller.jobs.backup;
    expect(job?.["runs-on"]).toBe("ubuntu-latest");
    expect(job?.environment).toBe("production");
    const action = job?.steps?.at(-1);
    expect(action?.uses).toBe(`SOFTURE/AI/.github/actions/backup-cloudflare@${WORKFLOWS_SHA}`);
    expect(action?.env).toEqual({
      BACKUP_S3_ENDPOINT: "${{ vars.BACKUP_S3_ENDPOINT }}",
      BACKUP_S3_REGION: "${{ vars.BACKUP_S3_REGION }}",
      BACKUP_S3_BUCKET: "${{ vars.BACKUP_S3_BUCKET }}",
      BACKUP_S3_PREFIX: "${{ vars.BACKUP_S3_PREFIX }}",
      BACKUP_AGE_RECIPIENT: "${{ vars.BACKUP_AGE_RECIPIENT }}",
      BACKUP_S3_ACCESS_KEY_ID: "${{ secrets.BACKUP_S3_ACCESS_KEY_ID }}",
      BACKUP_S3_SECRET_ACCESS_KEY: "${{ secrets.BACKUP_S3_SECRET_ACCESS_KEY }}",
    });
    expect(action?.with).toEqual({
      app: "shop",
      "database-url": "${{ secrets.MIGRATE_DATABASE_URL }}",
      "postgres-major": "17",
      "backup-cli-version": "0.1.1",
    });
    expect(out.join("")).toContain("next    for the nightly off-site backup (backup.yml), set the variables BACKUP_S3_ENDPOINT");
  });

  it("writes a weekly restore check that reads with the read-only token in its own environment", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", ...CLOUDFLARE], makeIo())).toBe(0);
    const text = read(".github/workflows/backup-verify.yml");
    const caller = parse(text) as Caller & { on: Record<string, unknown> };
    expect(caller.on).toEqual({ schedule: [{ cron: "40 5 * * 1" }], workflow_dispatch: null });
    const job = caller.jobs.verify;
    expect(job?.["runs-on"]).toBe("ubuntu-latest");
    expect(job?.environment).toBe("backup-verify");
    expect(text).toContain("image: postgres:17\n");
    expect(text).toContain("npx softure migrate --export-migrations ./softure-migrations");
    expect(text).toContain(
      "npx --yes --package=@softure-ai/backup@0.1.1 softure-backup verify --app=shop --identity=- --config=deploy.json --migrations-dir=softure-migrations",
    );
    expect(text).not.toContain("BACKUP_S3_SECRET_ACCESS_KEY");
    expect(text).not.toContain("MIGRATE_DATABASE_URL");
  });

  it("writes a deploy.json without the server's hooks or row counts", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", ...CLOUDFLARE], makeIo())).toBe(0);
    const config = JSON.parse(read("deploy.json")) as Record<string, unknown>;
    expect(config).not.toHaveProperty("hooks");
    expect(config).not.toHaveProperty("database");
    expect(config.verify).toEqual({
      headers: { "strict-transport-security": "max-age=", "x-powered-by": null },
      routes: [
        { path: "/api/health", contains: ['"status":"ok"'] },
        { path: "/", excludes: ["Application error"] },
      ],
    });
  });

  it.each([
    [["--image=ghcr.io/acme/app"], "host: --image is a VPS flag: wrangler uploads the bundle, there is no image"],
    [["--edge=proxy"], "host: --edge is a VPS flag: a Worker has no Traefik"],
    [["--tunnel"], "host: --tunnel is a VPS flag"],
    [["--cdn=cloudflare"], "host: --cdn is a VPS flag"],
    [["--acme-email=ops@example.com"], "host: --acme-email is a VPS flag"],
    [["--www"], "host: --www is a Traefik redirect"],
    [["--paths=/blog"], "host: --paths is a Traefik rule"],
    [["--tables=users"], "host: --tables are counted by deploy.sh"],
    [["--data-volume=/app/data"], "host: --data-volume is a VPS flag: a Worker has no disk"],
    [["--worker-memory=512m"], "host: --worker-memory is a VPS flag"],
  ])("refuses %j and writes nothing", async (flags, problem) => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", ...CLOUDFLARE, ...flags], makeIo())).not.toBe(0);
    expect(err.join("")).toContain(problem);
    expect(existsSync(join(dir, "wrangler.jsonc"))).toBe(false);
  });

  it("refuses an unknown host, a malformed Hyperdrive ID and a placement hint of an unknown provider", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", "--host=azure", "--domain=shop.example.com", "--image=ghcr.io/acme/app"], makeIo())).not.toBe(0);
    expect(err.join("")).toContain("host: vps or cloudflare");
    err = [];
    expect(await runCli(["init", ...CLOUDFLARE, "--hyperdrive-id=abc", "--placement-region=ovh:waw"], makeIo())).not.toBe(0);
    expect(err.join("")).toContain("hyperdriveId: a Hyperdrive configuration ID: 32 lower-case hex characters");
    expect(err.join("")).toContain("placementRegion: <provider>:<region> such as aws:eu-central-1");
  });

  it("keeps --image required on a VPS and refuses the Worker flags there", async () => {
    writeApp(DATABASE_APP);
    expect(await runCli(["init", "--domain=shop.example.com"], makeIo())).not.toBe(0);
    expect(err.join("")).toContain("init: missing --image.");
    err = [];
    expect(await runCli(["init", "--domain=shop.example.com", "--image=ghcr.io/acme/app", `--hyperdrive-id=${HYPERDRIVE_ID}`], makeIo())).not.toBe(0);
    expect(err.join("")).toContain("host: --hyperdrive-id configures a Cloudflare Worker; add --host=cloudflare");
  });
});
