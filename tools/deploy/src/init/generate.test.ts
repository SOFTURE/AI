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
      "docker/prod/hooks/lib.sh",
      "docker/server/deploy.sh",
      "scripts/migrate.ts",
      ".github/workflows/deploy.yml",
      ".github/workflows/release.yml",
      ".github/workflows/release-notes.yml",
      ".github/workflows/checks.yml",
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

  describe("the role deploy.sh's report reads as", () => {
    const COMPOSE = { postgresMajor: "17", appDatabaseRole: "ledger_app" };

    it("is the reportRole answer, ahead of the kept compose file's role", () => {
      expect(textOf(plan({ reportRole: "shop_app" }, { compose: COMPOSE }), "docker/server/deploy.sh")).toContain("REPORT_ROLE=shop_app\n");
    });

    it("is the kept compose file's role without the answer, else softure_app", () => {
      expect(textOf(plan({}, { compose: COMPOSE }), "docker/server/deploy.sh")).toContain("REPORT_ROLE=ledger_app\n");
      expect(textOf(plan(), "docker/server/deploy.sh")).toContain("REPORT_ROLE=softure_app\n");
    });

    it("is the answer when the compose file is replaced", () => {
      const files = planInitFiles({
        answers: { ...ANSWERS, reportRole: "shop_app" },
        facts: { ...FACTS, compose: COMPOSE },
        cliVersion: "9.9.9",
        replacesCompose: true,
      });
      expect(files.find((file) => file.path === "docker/server/deploy.sh")?.text).toContain("REPORT_ROLE=shop_app\n");
    });
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
    expect(textOf(files, ".github/workflows/deploy.yml")).toContain("The compose file requires no secret, so none reaches .env.prod");
    const script = textOf(files, "docker/server/deploy.sh");
    expect(script).not.toContain("deploy_cli backup");
    expect(script).not.toContain("postgresql");
    expect(script).toContain("# an edge network), record the tag (tag), install the cron (cron), run the post-up hooks.");
    expect(script).toContain('TOOLS_IMAGE="softure-deploy-tools:9.9.9"');
    expect(script).not.toContain("BACKUP_DIR=");
  });

  it("writes the Dockerfile of the ops recipe, with public/ and the migrate step only when the app has them", () => {
    const full = textOf(plan(), "Dockerfile");
    expect(full).toContain("COPY --from=builder /app/public ./public");
    expect(full).toContain("npx --yes esbuild@0.28.2 scripts/migrate.ts --bundle");
    expect(full).toContain("COPY --from=builder /app/softure-migrations ./softure-migrations");
    expect(full).toContain("find scripts/ops -maxdepth 1 -name '*.ts' ! -name '*.test.ts'");
    expect(full).toContain("--outdir=ops --out-extension:.js=.mjs");
    expect(full).toContain("COPY --from=builder /app/ops ./ops");
    expect(full).toContain("http://127.0.0.1:3000/api/health");
    const bare = textOf(plan({}, NO_DATABASE), "Dockerfile");
    expect(bare).not.toContain("public");
    expect(bare).not.toContain("migrate");
    expect(bare).not.toContain("scripts/ops");
    expect(bare).not.toContain("./ops");
    expect(bare).toContain("http://127.0.0.1:3000/'");
  });

  it("bundles migrate.mjs and the ops scripts with server-only emptied and a require for CJS dependencies", () => {
    const full = textOf(plan(), "Dockerfile");
    expect(full).toContain("RUN mkdir -p .esbuild && printf 'export {};\\n' > .esbuild/empty.mjs");
    const banner = `--banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"`;
    expect(full.split("--alias:server-only=./.esbuild/empty.mjs")).toHaveLength(3);
    expect(full.split(banner)).toHaveLength(3);
  });

  it("adds the job worker only for an app with @softure-ai/jobs and a database", () => {
    const worker = plan({}, { hasJobs: true });
    expect([...worker.keys()]).toContain("scripts/worker.ts");
    for (const facts of [FACTS, { ...NO_DATABASE, hasJobs: true }]) {
      const files = plan({}, facts);
      expect([...files.keys()]).not.toContain("scripts/worker.ts");
      expect(textOf(files, "Dockerfile")).not.toContain("worker");
      expect((parse(textOf(files, "docker/prod/docker-compose.yml")) as { services: object }).services).not.toHaveProperty("worker");
    }
    expect(textOf(worker, "scripts/worker.ts")).toContain('import { runJobWorkerProcess } from "@softure-ai/jobs/worker";');
    for (const file of worker.values()) expect(file.text, file.path).not.toMatch(/\{\{[#^/]?[a-zA-Z]+\}\}/);
  });

  it("bundles worker.mjs like migrate.mjs and copies it into the image", () => {
    const dockerfile = textOf(plan({}, { hasJobs: true }), "Dockerfile");
    expect(dockerfile).toContain("scripts/worker.ts --bundle --platform=node --format=esm --target=node22");
    expect(dockerfile).toContain("--outfile=worker.mjs");
    expect(dockerfile).toContain("COPY --from=builder /app/worker.mjs ./worker.mjs");
    expect(dockerfile.split("--alias:server-only=./.esbuild/empty.mjs")).toHaveLength(4);
  });

  it("runs the worker from the app's image after the migrations, with the app's environment and no health check", () => {
    const compose = parse(textOf(plan({}, { hasJobs: true }), "docker/prod/docker-compose.yml")) as {
      services: Record<string, Record<string, unknown>>;
    };
    expect(compose.services.worker).toEqual({
      image: "ghcr.io/acme/app:${TAG}",
      restart: "unless-stopped",
      command: ["node", "worker.mjs"],
      environment: {
        APP_ORIGIN: "https://example.com",
        DATABASE_URL: "postgresql://softure_app:${SOFTURE_APP_PASSWORD:?}@postgres:5432/acme_app",
        AUTH_SECRET: "${AUTH_SECRET:?}",
      },
      healthcheck: { disable: true },
      stop_grace_period: "30s",
      depends_on: { migrate: { condition: "service_completed_successfully" } },
    });
    // The worker needs no secret the app does not already have.
    const required = (files: Map<string, PlannedFile>) => findRequiredNames(textOf(files, "docker/prod/docker-compose.yml")).map((variable) => variable.name);
    expect(required(plan({}, { hasJobs: true }))).toEqual(required(plan()));
  });

  it("writes hooks/lib.sh for every app and the Cloudflare files only with cdn cloudflare", () => {
    const cloudflareFiles = [
      "docker/prod/hooks/cloudflare-ranges.sh",
      "docker/server/cloudflare-only.sh",
      "docker/server/cloudflare-only.service",
      "docker/server/cloudflare-only.path",
    ];
    for (const facts of [FACTS, NO_DATABASE]) {
      const plain = plan({}, facts);
      expect(plain.get("docker/prod/hooks/lib.sh")?.mode).toBe(0o644);
      for (const path of cloudflareFiles) expect([...plain.keys()]).not.toContain(path);
      const locked = plan({ cdn: "cloudflare" }, facts);
      for (const path of cloudflareFiles) expect([...locked.keys()]).toContain(path);
    }
    const locked = plan({ cdn: "cloudflare" });
    expect(locked.get("docker/server/cloudflare-only.sh")?.mode).toBe(0o755);
    expect(textOf(locked, "docker/server/cloudflare-only.sh")).toContain('RANGES_FILE="${CLOUDFLARE_RANGES_FILE:-/srv/acme-app/cloudflare-ips.txt}"');
    expect(textOf(locked, "docker/server/cloudflare-only.service")).toContain("ExecStart=/usr/local/sbin/acme-app-cloudflare-only");
    const path = textOf(locked, "docker/server/cloudflare-only.path");
    expect(path).toContain("PathChanged=/srv/acme-app/cloudflare-ips.txt");
    expect(path).toContain("Unit=acme-app-cloudflare-only.service");
  });

  it("trusts forwarded headers from Cloudflare's ranges only with cdn cloudflare", () => {
    const traefikCommand = (files: Map<string, PlannedFile>): string[] =>
      (parse(textOf(files, "docker/prod/docker-compose.yml")) as { services: { traefik: { command: string[] } } }).services.traefik.command;
    expect(traefikCommand(plan()).filter((flag) => flag.includes("trustedIPs"))).toEqual([]);
    const flags = traefikCommand(plan({ cdn: "cloudflare" })).filter((flag) => flag.includes("trustedIPs"));
    expect(flags.map((flag) => flag.split("=")[0])).toEqual([
      "--entrypoints.web.forwardedHeaders.trustedIPs",
      "--entrypoints.websecure.forwardedHeaders.trustedIPs",
    ]);
    const ranges = flags[0]?.split("=")[1]?.split(",");
    expect(ranges).toHaveLength(22);
    expect(ranges).toContain("173.245.48.0/20");
    expect(ranges).toContain("2606:4700::/32");
  });

  it("runs the range refresh after every release and daily, in a deploy.json the schema accepts", () => {
    const parsed = parseDeployConfig(JSON.parse(textOf(plan({ cdn: "cloudflare" }), "deploy.json")));
    if (!parsed.ok) throw new Error(parsed.issues.join("; "));
    expect(parsed.config.hooks).toEqual({
      "post-up": [{ name: "cloudflare-ranges", run: ["bash", "hooks/cloudflare-ranges.sh"] }],
      maintain: [{ name: "cloudflare-ranges-daily", run: ["bash", "hooks/cloudflare-ranges.sh"] }],
    });
    const plain = parseDeployConfig(JSON.parse(textOf(plan(), "deploy.json")));
    expect(plain.ok && plain.config.hooks).toBeUndefined();
  });

  it("runs the database steps of DP-3 in deploy.sh with this package's version", () => {
    const script = textOf(plan(), "docker/server/deploy.sh");
    expect(script).toContain('DEPLOY_CLI="@softure-ai/deploy@9.9.9"');
    expect(script).toContain('IMAGE="ghcr.io/acme/app"');
    const order = [
      "load_settings \"$release_dir/deploy.json\"",
      "back_up_database || fail \"the backup failed; nothing was restarted.\"",
      "guard_schema || fail",
      'count_rows --config="$release_config" --out="$work/counts-before.json"',
      "run_hooks hooks-pre-migrate",
      "compose up --detach --wait --remove-orphans traefik app",
      'count_rows --config="$release_config" --compare="$work/counts-before.json"',
      'printf \'%s\\n\' "$TAG" > "$TAG_FILE"',
      'crontab - < "$work/crontab"',
      "run_hooks hooks-post-up",
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

describe("planInitFiles with edge, an app behind another stack's Traefik (issue #516)", () => {
  interface EdgeCompose {
    services: Record<string, { networks?: string[]; labels?: string[]; ports?: string[] }>;
    networks?: Record<string, unknown>;
    volumes?: Record<string, unknown>;
  }

  const composeOf = (files: Map<string, PlannedFile>): EdgeCompose => parse(textOf(files, "docker/prod/docker-compose.yml")) as EdgeCompose;

  it("writes no Traefik service, no rules file and no certificate volume", () => {
    for (const facts of [FACTS, NO_DATABASE]) {
      const files = plan({ edge: "proxy" }, facts);
      expect([...files.keys()]).not.toContain("docker/prod/traefik.yml");
      const compose = composeOf(files);
      expect(Object.keys(compose.services)).not.toContain("traefik");
      expect(Object.keys(compose.volumes ?? {})).not.toContain("letsencrypt");
      for (const file of files.values()) expect(file.text, file.path).not.toMatch(/\{\{[#^/]?[a-zA-Z]+\}\}/);
    }
    expect(composeOf(plan({ edge: "proxy" })).volumes).toEqual({ "postgres-data": null });
    expect(composeOf(plan({ edge: "proxy" }, NO_DATABASE))).not.toHaveProperty("volumes");
  });

  it("puts the app on the external edge network and its own, published by labels", () => {
    const compose = composeOf(plan({ edge: "proxy" }));
    expect(compose.networks).toEqual({ edge: { name: "proxy", external: true } });
    expect(compose.services.app?.networks).toEqual(["edge", "default"]);
    expect(compose.services.app?.labels).toEqual([
      "traefik.enable=true",
      "traefik.docker.network=proxy",
      "traefik.http.routers.acme-app.rule=Host(`example.com`)",
      "traefik.http.routers.acme-app.entrypoints=websecure",
      "traefik.http.routers.acme-app.tls.certresolver=letsencrypt",
      "traefik.http.routers.acme-app.service=acme-app",
      "traefik.http.routers.acme-app.middlewares=acme-app-security-headers",
      "traefik.http.services.acme-app.loadbalancer.server.port=3000",
      "traefik.http.middlewares.acme-app-security-headers.headers.stsSeconds=31536000",
      "traefik.http.middlewares.acme-app-security-headers.headers.stsIncludeSubdomains=true",
      "traefik.http.middlewares.acme-app-security-headers.headers.contentTypeNosniff=true",
      "traefik.http.middlewares.acme-app-security-headers.headers.referrerPolicy=strict-origin-when-cross-origin",
    ]);
    // Postgres and the migrate service stay on the project's own network only.
    expect(compose.services.postgres?.networks).toBeUndefined();
    expect(compose.services.migrate?.networks).toBeUndefined();
  });

  it("routes the allowed prefixes and redirects www through labels only when asked", () => {
    const labels = composeOf(plan({ edge: "proxy", www: true, paths: ["/blog"] })).services.app?.labels ?? [];
    expect(labels).toContain(`traefik.http.routers.acme-app.rule=${buildAppRule({ ...ANSWERS, paths: ["/blog"] }, FACTS)}`);
    expect(labels.filter((label) => label.includes("www"))).toEqual([
      "traefik.http.routers.acme-app-www.rule=Host(`www.example.com`)",
      "traefik.http.routers.acme-app-www.entrypoints=websecure",
      "traefik.http.routers.acme-app-www.tls.certresolver=letsencrypt",
      "traefik.http.routers.acme-app-www.service=noop@internal",
      "traefik.http.routers.acme-app-www.middlewares=acme-app-www-to-apex",
      String.raw`traefik.http.middlewares.acme-app-www-to-apex.redirectregex.regex=^https?://www\.example\.com/(.*)`,
      // Compose reads $$ as one $, so Traefik gets ${1}.
      "traefik.http.middlewares.acme-app-www-to-apex.redirectregex.replacement=https://example.com/$${1}",
      "traefik.http.middlewares.acme-app-www-to-apex.redirectregex.permanent=true",
    ]);
    expect((composeOf(plan({ edge: "proxy" })).services.app?.labels ?? []).filter((label) => label.includes("www"))).toEqual([]);
  });

  it("switches the app alone in deploy.sh, with no Traefik step", () => {
    const script = textOf(plan({ edge: "proxy" }), "docker/server/deploy.sh");
    expect(script).toContain("compose up --detach --wait --remove-orphans app ||");
    expect(script).not.toContain("begin_step traefik");
    expect(script).not.toContain("rules_changed");
  });

  it("leaves the files without edge as they were", () => {
    const script = textOf(plan(), "docker/server/deploy.sh");
    expect(script).toContain("compose up --detach --wait --remove-orphans traefik app ||");
    expect(script).toContain("begin_step traefik");
    const compose = composeOf(plan());
    expect(compose).not.toHaveProperty("networks");
    expect(compose.services.app).not.toHaveProperty("labels");
  });
});

describe("the switch of deploy.sh", () => {
  it("starts the worker with the app, so a release replaces it too", () => {
    expect(textOf(plan({}, { hasJobs: true }), "docker/server/deploy.sh")).toContain(
      "compose up --detach --wait --remove-orphans traefik app worker ||",
    );
    expect(textOf(plan({ edge: "proxy" }, { hasJobs: true }), "docker/server/deploy.sh")).toContain(
      "compose up --detach --wait --remove-orphans app worker ||",
    );
  });
});

describe("the generated caller workflow (issue #486)", () => {
  interface Step {
    uses?: string;
    env?: Record<string, string>;
    with?: Record<string, unknown>;
  }
  interface Job {
    uses?: string;
    needs?: unknown;
    environment?: string;
    permissions?: unknown;
    with?: Record<string, unknown>;
    secrets?: unknown;
    steps?: Step[];
  }
  interface Input {
    required?: boolean;
  }
  const called = parse(readFileSync(join(REPO_ROOT, ".github/workflows/deploy-app.yml"), "utf8")) as {
    on: { workflow_call: { inputs: Record<string, Input> } };
  };
  const action = parse(readFileSync(join(REPO_ROOT, ".github/actions/deploy/action.yml"), "utf8")) as { inputs: Record<string, Input> };
  const text = textOf(plan(), ".github/workflows/deploy.yml");
  const caller = parse(text) as { permissions: unknown; jobs: Record<string, Job> };
  const build = caller.jobs.build as Job;
  const deploy = caller.jobs.deploy as Job;
  const step = deploy.steps?.[0] as Step;

  function readCaller(answers: Partial<InitAnswers>, facts: Partial<AppFacts> = {}): Record<string, Job> {
    return (parse(textOf(plan(answers, facts), ".github/workflows/deploy.yml")) as { jobs: Record<string, Job> }).jobs;
  }

  it("builds through deploy-app.yml and deploys from a job in the production environment", () => {
    expect(Object.keys(caller.jobs)).toEqual(["build", "deploy"]);
    expect(build.uses).toBe("SOFTURE/AI/.github/workflows/deploy-app.yml@master");
    expect(build.with?.deploy).toBe(false);
    expect(build.secrets).toBeUndefined();
    expect(deploy.needs).toBe("build");
    expect(deploy.environment).toBe("production");
    expect(deploy.steps).toHaveLength(1);
    expect(step.uses).toBe("SOFTURE/AI/.github/actions/deploy@master");
  });

  it("pins the workflow and the action to the given commit", () => {
    const sha = "8d8b8e5a7c246b9afe4e92dc055105f042af37ab";
    const pinned = readCaller({ workflowsRef: sha });
    expect(pinned.build?.uses).toBe(`SOFTURE/AI/.github/workflows/deploy-app.yml@${sha}`);
    expect(pinned.deploy?.steps?.[0]?.uses).toBe(`SOFTURE/AI/.github/actions/deploy@${sha}`);
  });

  it("grants packages: write to the build only, read to the deploy job", () => {
    expect(caller.permissions).toEqual({ contents: "read", packages: "write" });
    expect(deploy.permissions).toEqual({ contents: "read", packages: "read" });
  });

  it("passes the build only declared inputs, every required one, and the app's domain, image and health path", () => {
    const declared = Object.keys(called.on.workflow_call.inputs);
    for (const key of Object.keys(build.with ?? {})) expect(declared).toContain(key);
    for (const [key, input] of Object.entries(called.on.workflow_call.inputs)) {
      if (input.required === true) expect(Object.keys(build.with ?? {})).toContain(key);
    }
    expect(build.with).toMatchObject({ "app-url": "https://example.com", image: "ghcr.io/acme/app", "health-path": "/api/health" });
  });

  it("passes the action only its inputs, the build's outputs and the deploy secrets", () => {
    for (const key of Object.keys(step.with ?? {})) expect(Object.keys(action.inputs)).toContain(key);
    expect(step.with).toMatchObject({
      release: "${{ needs.build.outputs.release }}",
      image: "${{ needs.build.outputs.image }}",
      digest: "${{ needs.build.outputs.digest }}",
      "ssh-host": "${{ secrets.DEPLOY_SSH_HOST }}",
      "ssh-user": "${{ secrets.DEPLOY_SSH_USER }}",
      "ssh-private-key": "${{ secrets.DEPLOY_SSH_KEY }}",
      "ssh-known-hosts": "${{ secrets.DEPLOY_SSH_KNOWN_HOSTS }}",
      "app-vars": "${{ toJSON(vars) }}",
      "origin-address": "${{ secrets.DEPLOY_ORIGIN_IP }}",
      "verify-env": "${{ secrets.DEPLOY_VERIFY_ENV }}",
    });
  });

  it("passes exactly the compose file's required secrets, each by name, and never the whole secrets context", () => {
    const required = findRequiredNames(textOf(plan(), "docker/prod/docker-compose.yml")).map((variable) => variable.name);
    expect(Object.keys(step.env ?? {})).toEqual(required);
    for (const [name, value] of Object.entries(step.env ?? {})) expect(value).toBe(`\${{ secrets.${name} }}`);
    expect(String(step.with?.["secret-names"]).split(" ")).toEqual(required);
    expect(step.with?.["app-secrets"]).toBeUndefined();
    expect(text).not.toContain("toJSON(secrets)");
    expect(text).not.toContain("secrets[");
  });

  it("passes no env and no secret-names when the compose file requires no secret", () => {
    const bare = readCaller({ env: [] }, NO_DATABASE).deploy?.steps?.[0];
    expect(bare?.env).toBeUndefined();
    expect(bare?.with?.["secret-names"]).toBeUndefined();
    expect(bare?.with?.release).toBe("${{ needs.build.outputs.release }}");
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

describe.each([
  ["release-notes.yml", "deploy-release-notes.yml", "# Release notes of acme-app, generated by `softure-deploy init` (@softure-ai/deploy 9.9.9). It calls"],
  ["checks.yml", "deploy-release-checks.yml", "# Checks of acme-app's pull requests, generated by `softure-deploy init` (@softure-ai/deploy 9.9.9). It calls"],
])("the generated %s caller (issue #406)", (name, called, header) => {
  const path = `.github/workflows/${name}`;
  const generated = textOf(plan(), path);

  it("is the example caller, so its repository test covers it too", () => {
    const example = readFileSync(join(REPO_ROOT, `tools/deploy/examples/${name}`), "utf8");
    expect(parse(generated)).toEqual(parse(example));
  });

  it("names the app and the CLI version in its header, mode 0644, also without a database", () => {
    expect(generated.split("\n")[0]).toBe(header);
    expect(plan().get(path)?.mode).toBe(0o644);
    expect([...plan({}, NO_DATABASE).keys()]).toContain(path);
  });

  it("calls SOFTURE/AI's workflow at --workflows-ref", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const pinned = parse(textOf(plan({ workflowsRef: sha }), path)) as { jobs: Record<string, { uses?: string }> };
    expect(Object.values(pinned.jobs).map((job) => job.uses)).toEqual([`SOFTURE/AI/.github/workflows/${called}@${sha}`]);
  });
});

describe.each(["deploy.yml", "checks.yml", "release.yml", "release-notes.yml"])(
  "the header comment of the generated %s (issue #473)",
  (name) => {
    const path = `.github/workflows/${name}`;
    const sha = "f5830d0e605636dfba4cb8bd5407d6404c07974c";
    const commentOf = (text: string): string =>
      text
        .split("\n")
        .filter((line) => line.startsWith("#"))
        .join("\n");
    const unpinned = textOf(plan(), path);
    const pinned = textOf(plan({ workflowsRef: sha }), path);

    it("says the callers are pinned to the --workflows-ref commit, without the advice to pin one", () => {
      expect(commentOf(pinned)).toContain(`pinned to commit ${sha}`);
      expect(pinned).not.toContain("pin a commit SHA");
      expect(pinned).not.toContain("git ls-remote");
    });

    it("advises pinning a commit SHA when the callers call master", () => {
      expect(commentOf(unpinned)).toContain("called at `master`; pin a commit SHA");
      expect(commentOf(unpinned)).not.toContain("pinned to commit");
    });

    it("keeps the header comment within 120 characters a line, pinned or not", () => {
      for (const text of [unpinned, pinned]) {
        expect(commentOf(text).split("\n").filter((line) => line.length > 120)).toEqual([]);
      }
    });
  },
);

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
