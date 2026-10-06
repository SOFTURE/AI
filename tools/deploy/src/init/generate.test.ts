import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { findRequiredNames } from "../env/required-names.js";
import { parseDeployConfig } from "../verify/schema.js";
import type { InitAnswers } from "./answers.js";
import type { AppFacts } from "./app-facts.js";
import { buildAppRule, planInitFiles, writeInitFiles, type PlannedFile } from "./generate.js";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

const ANSWERS: InitAnswers = {
  domain: "example.com",
  image: "ghcr.io/acme/app",
  name: "acme-app",
  paths: ["/"],
  www: false,
  env: ["AUTH_SECRET"],
  tables: ["users", "billing.subscriptions"],
};

const FACTS: AppFacts = {
  packageName: "acme-app",
  hasDatabase: true,
  hasHealthRoute: true,
  hasPublicDir: true,
  nextConfigFile: "next.config.ts",
  isStandalone: true,
};

const NO_DATABASE: AppFacts = { ...FACTS, hasDatabase: false, hasHealthRoute: false, hasPublicDir: false };

function plan(answers: Partial<InitAnswers> = {}, facts: Partial<AppFacts> = {}): Map<string, PlannedFile> {
  const files = planInitFiles({ answers: { ...ANSWERS, ...answers }, facts: { ...FACTS, ...facts }, cliVersion: "9.9.9" });
  return new Map(files.map((file) => [file.path, file]));
}

function textOf(files: Map<string, PlannedFile>, path: string): string {
  const file = files.get(path);
  if (!file) throw new Error(`${path} was not planned`);
  return file.text;
}

describe("planInitFiles", () => {
  it("plans every file for an app with a database, deploy.sh executable", () => {
    const files = plan();
    expect([...files.keys()]).toEqual([
      "Dockerfile",
      ".dockerignore",
      "docker/prod/docker-compose.yml",
      "docker/prod/traefik.yml",
      "docker/prod/initdb/01-roles.sql",
      "docker/server/deploy.sh",
      "scripts/migrate.ts",
      ".github/workflows/deploy.yml",
      ".github/workflows/release.yml",
      "deploy.json",
    ]);
    expect(files.get("docker/server/deploy.sh")?.mode).toBe(0o755);
    expect(files.get("Dockerfile")?.mode).toBe(0o644);
  });

  it("leaves no template tag in any file", () => {
    for (const facts of [FACTS, NO_DATABASE]) {
      for (const file of plan({ www: true, acmeEmail: "ops@example.com", paths: ["/blog"] }, facts).values()) {
        expect(file.text, file.path).not.toMatch(/\{\{[#^/]?[a-zA-Z]+\}\}/);
      }
    }
  });

  it("requires in compose exactly the database passwords and the app's own secrets", () => {
    const compose = textOf(plan(), "docker/prod/docker-compose.yml");
    expect(findRequiredNames(compose).map((variable) => variable.name)).toEqual([
      "AUTH_SECRET",
      "POSTGRES_PASSWORD",
      "SOFTURE_APP_PASSWORD",
      "SOFTURE_MIGRATOR_PASSWORD",
    ]);
    expect(textOf(plan(), ".github/workflows/deploy.yml")).toContain(
      "reach .env.prod: AUTH_SECRET, POSTGRES_PASSWORD, SOFTURE_APP_PASSWORD, SOFTURE_MIGRATOR_PASSWORD.",
    );
  });

  it("writes a compose file with the app, migrate, postgres and traefik services", () => {
    const compose = parse(textOf(plan(), "docker/prod/docker-compose.yml")) as {
      name: string;
      services: Record<string, { image: string; environment?: Record<string, string>; ports?: string[]; depends_on?: unknown }>;
      volumes: Record<string, unknown>;
    };
    expect(compose.name).toBe("acme-app");
    expect(Object.keys(compose.services)).toEqual(["traefik", "app", "migrate", "postgres"]);
    expect(compose.services.app?.image).toBe("ghcr.io/acme/app:${TAG}");
    expect(compose.services.app?.environment).toEqual({
      APP_ORIGIN: "https://example.com",
      DATABASE_URL: "postgresql://softure_app:${SOFTURE_APP_PASSWORD:?}@postgres:5432/acme_app",
      AUTH_SECRET: "${AUTH_SECRET:?}",
    });
    expect(compose.services.app?.depends_on).toEqual({ migrate: { condition: "service_completed_successfully" } });
    expect(compose.services.migrate?.environment?.DATABASE_URL).toBe(
      "postgresql://softure_migrator:${SOFTURE_MIGRATOR_PASSWORD:?}@postgres:5432/acme_app",
    );
    expect(compose.services.postgres?.ports).toEqual(["127.0.0.1:5432:5432"]);
    expect(Object.keys(compose.volumes)).toEqual(["letsencrypt", "postgres-data"]);
  });

  it("writes only traefik and the app without a database, and no secrets but the app's", () => {
    const files = plan({ env: [] }, NO_DATABASE);
    expect([...files.keys()]).not.toContain("docker/prod/initdb/01-roles.sql");
    expect([...files.keys()]).not.toContain("scripts/migrate.ts");
    const compose = parse(textOf(files, "docker/prod/docker-compose.yml")) as { services: Record<string, { environment?: unknown; depends_on?: unknown }> };
    expect(Object.keys(compose.services)).toEqual(["traefik", "app"]);
    expect(compose.services.app?.environment).toEqual({ APP_ORIGIN: "https://example.com" });
    expect(compose.services.app?.depends_on).toBeUndefined();
    expect(textOf(files, ".github/workflows/deploy.yml")).toContain("reach .env.prod: none.");
    const script = textOf(files, "docker/server/deploy.sh");
    expect(script).not.toContain("deploy_cli");
    expect(script).toContain("# when its rules changed (traefik), record the tag (tag), install the cron (cron).");
    expect(script).not.toContain("BACKUP_DIR=");
  });

  it("writes the Dockerfile of the ops recipe, with public/ and the migrate step only when the app has them", () => {
    const full = textOf(plan(), "Dockerfile");
    expect(full).toContain("COPY --from=builder /app/public ./public");
    expect(full).toContain("npx --yes esbuild@0.28.2 scripts/migrate.ts --bundle");
    expect(full).toContain("COPY --from=builder /app/softure-migrations ./softure-migrations");
    expect(full).toContain("http://127.0.0.1:3000/api/health");
    const bare = textOf(plan({}, NO_DATABASE), "Dockerfile");
    expect(bare).not.toContain("public");
    expect(bare).not.toContain("migrate");
    expect(bare).toContain("http://127.0.0.1:3000/'");
  });

  it("runs the database steps of DP-3 in deploy.sh with this package's version", () => {
    const script = textOf(plan(), "docker/server/deploy.sh");
    expect(script).toContain('DEPLOY_CLI="@softure-ai/deploy@9.9.9"');
    expect(script).toContain('IMAGE="ghcr.io/acme/app"');
    const order = [
      "deploy_cli backup",
      "deploy_cli schema-guard",
      'row-counts --config="$release_config" --out=',
      "compose up --detach --wait --remove-orphans traefik app",
      'row-counts --config="$release_config" --compare=',
    ];
    const positions = order.map((marker) => script.indexOf(marker));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("takes the row-count tables from the shipped deploy.json, not from the script", () => {
    const script = textOf(plan(), "docker/server/deploy.sh");
    expect(script).toContain('release_config="$release_dir/deploy.json"');
    expect(script).not.toContain("ROW_COUNT_TABLES");
    expect(script).not.toContain("billing.subscriptions");
  });

  it("writes the tables into deploy.json only for an app with a database and a list", () => {
    const listed = parseDeployConfig(JSON.parse(textOf(plan(), "deploy.json")));
    expect(listed.ok && listed.config.database).toEqual({ rowCountTables: ["users", "billing.subscriptions"] });
    const none = parseDeployConfig(JSON.parse(textOf(plan({ tables: [] }), "deploy.json")));
    expect(none.ok && none.config.database).toBeUndefined();
    const noDatabase = parseDeployConfig(JSON.parse(textOf(plan({}, NO_DATABASE), "deploy.json")));
    expect(noDatabase.ok && noDatabase.config.database).toBeUndefined();
  });

  it("routes the whole apex for /, else / plus the allowed prefixes, Next assets and the health route", () => {
    expect(buildAppRule(ANSWERS, FACTS)).toBe("Host(`example.com`)");
    expect(buildAppRule({ ...ANSWERS, paths: ["/blog", "/pricing"] }, FACTS)).toBe(
      "Host(`example.com`) && (Path(`/`) || PathPrefix(`/_next/`) || PathPrefix(`/api/health`) || PathPrefix(`/blog`) || PathPrefix(`/pricing`))",
    );
    expect(buildAppRule({ ...ANSWERS, paths: ["/blog"] }, NO_DATABASE)).toBe(
      "Host(`example.com`) && (Path(`/`) || PathPrefix(`/_next/`) || PathPrefix(`/blog`))",
    );
  });

  it("writes Traefik rules with the www redirect only when asked", () => {
    const rules = parse(textOf(plan({ www: true }), "docker/prod/traefik.yml")) as {
      http: { routers: Record<string, { rule: string }>; middlewares: Record<string, { redirectRegex?: { regex: string; replacement: string } }> };
    };
    expect(rules.http.routers.www?.rule).toBe("Host(`www.example.com`)");
    expect(rules.http.middlewares["www-to-apex"]?.redirectRegex).toEqual({
      regex: String.raw`^https?://www\.example\.com/(.*)`,
      replacement: "https://example.com/${1}",
      permanent: true,
    });
    const plain = parse(textOf(plan(), "docker/prod/traefik.yml")) as { http: { routers: Record<string, unknown> } };
    expect(Object.keys(plain.http.routers)).toEqual(["app"]);
  });

  it("writes the ACME e-mail only when given", () => {
    expect(textOf(plan({ acmeEmail: "ops@example.com" }), "docker/prod/docker-compose.yml")).toContain(
      "--certificatesresolvers.letsencrypt.acme.email=ops@example.com",
    );
    expect(textOf(plan(), "docker/prod/docker-compose.yml")).not.toContain("acme.email");
  });

  it("writes a deploy.json that verify accepts, with the health route when the app has one", () => {
    const withHealth = parseDeployConfig(JSON.parse(textOf(plan(), "deploy.json")));
    expect(withHealth.ok && withHealth.config.verify?.routes.map((route) => route.path)).toEqual(["/api/health", "/"]);
    const without = parseDeployConfig(JSON.parse(textOf(plan({}, NO_DATABASE), "deploy.json")));
    expect(without.ok && without.config.verify?.routes.map((route) => route.path)).toEqual(["/"]);
  });

  it("copies the ops roles recipe unchanged", () => {
    const recipe = readFileSync(join(REPO_ROOT, "modules/ops/recipes/initdb/01-roles.sql"), "utf8");
    expect(textOf(plan(), "docker/prod/initdb/01-roles.sql")).toBe(recipe);
  });
});

describe("the generated caller workflow", () => {
  interface Job {
    uses?: string;
    with?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
  }
  interface Input {
    required?: boolean;
  }
  const called = parse(readFileSync(join(REPO_ROOT, ".github/workflows/deploy-app.yml"), "utf8")) as {
    on: { workflow_call: { inputs: Record<string, Input>; secrets: Record<string, unknown> } };
  };
  const caller = parse(textOf(plan(), ".github/workflows/deploy.yml")) as { permissions: unknown; jobs: Record<string, Job> };
  const job = caller.jobs.deploy as Job;

  it("calls deploy-app.yml at the moving tag with the same permissions as the example caller", () => {
    expect(job.uses).toBe("SOFTURE/AI/.github/workflows/deploy-app.yml@deploy-workflows-v1");
    expect(caller.permissions).toEqual({ contents: "read", packages: "write" });
  });

  it("passes only declared inputs, every required one, and the app's domain, image and health path", () => {
    const declared = Object.keys(called.on.workflow_call.inputs);
    for (const key of Object.keys(job.with ?? {})) expect(declared).toContain(key);
    for (const [key, input] of Object.entries(called.on.workflow_call.inputs)) {
      if (input.required === true) expect(Object.keys(job.with ?? {})).toContain(key);
    }
    expect(job.with).toMatchObject({ "app-url": "https://example.com", image: "ghcr.io/acme/app", "health-path": "/api/health" });
  });

  it("passes every declared secret by name", () => {
    expect(Object.keys(job.secrets ?? {}).sort()).toEqual(Object.keys(called.on.workflow_call.secrets).sort());
  });
});

describe("the generated release caller", () => {
  const generated = textOf(plan(), ".github/workflows/release.yml");

  it("is the example release caller, so its repository test covers it too", () => {
    const example = readFileSync(join(REPO_ROOT, "tools/deploy/examples/release.yml"), "utf8");
    expect(parse(generated)).toEqual(parse(example));
  });

  it("names the app and the CLI version in its header, mode 0644", () => {
    expect(generated.split("\n")[0]).toBe(
      "# Release of acme-app, generated by `softure-deploy init` (@softure-ai/deploy 9.9.9). It calls SOFTURE/AI's",
    );
    expect(plan().get(".github/workflows/release.yml")?.mode).toBe(0o644);
  });

  it("is written without a database too", () => {
    expect([...plan({}, NO_DATABASE).keys()]).toContain(".github/workflows/release.yml");
  });
});

describe("writeInitFiles", () => {
  let dir: string;
  const files: PlannedFile[] = [
    { path: "a/b.txt", text: "new b\n", mode: 0o644 },
    { path: "run.sh", text: "#!/bin/sh\n", mode: 0o755 },
  ];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "softure-deploy-init-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes new files with their folders and modes", () => {
    expect(writeInitFiles({ dir, files, force: false })).toEqual({ written: ["a/b.txt", "run.sh"], skipped: [] });
    expect(readFileSync(join(dir, "a/b.txt"), "utf8")).toBe("new b\n");
    expect(statSync(join(dir, "run.sh")).mode & 0o777).toBe(0o755);
  });

  it("keeps an existing file unless forced", () => {
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a/b.txt"), "own b\n");
    expect(writeInitFiles({ dir, files, force: false })).toEqual({ written: ["run.sh"], skipped: ["a/b.txt"] });
    expect(readFileSync(join(dir, "a/b.txt"), "utf8")).toBe("own b\n");
    expect(writeInitFiles({ dir, files, force: true })).toEqual({ written: ["a/b.txt", "run.sh"], skipped: [] });
    expect(readFileSync(join(dir, "a/b.txt"), "utf8")).toBe("new b\n");
  });

  it("replaces a link instead of writing through it when forced", () => {
    const outside = join(dir, "outside.txt");
    writeFileSync(outside, "outside\n");
    symlinkSync(outside, join(dir, "run.sh"));
    expect(writeInitFiles({ dir, files: [files[1] as PlannedFile], force: false }).skipped).toEqual(["run.sh"]);
    writeInitFiles({ dir, files: [files[1] as PlannedFile], force: true });
    expect(readFileSync(outside, "utf8")).toBe("outside\n");
    expect(lstatSync(join(dir, "run.sh")).isSymbolicLink()).toBe(false);
  });
});
