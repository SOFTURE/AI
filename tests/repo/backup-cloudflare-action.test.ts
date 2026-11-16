// The off-site backup action for a host without a server (RP-9) runs in adopting apps against their production
// database, so each step's script runs here with bash and a fake `docker` and `npx` first on PATH: no call reaches a
// database or a bucket.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

const ACTION_FILE = join(REPO_ROOT, ".github/actions/backup-cloudflare/action.yml");

interface Step {
  id?: string;
  name?: string;
  if?: string;
  shell?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Action {
  inputs: Record<string, { required?: boolean; default?: string }>;
  outputs: Record<string, { value: string }>;
  runs: { using: string; steps: Step[] };
}

const action = parse(readFileSync(ACTION_FILE, "utf8")) as Action;

function findStep(id: string): Step {
  const step = action.runs.steps.find((candidate) => candidate.id === id || candidate.name === id);
  if (step?.run === undefined) throw new Error(`no script step ${id}`);
  return step;
}

/** Records each call; `run` prints the PG* variables it got and stands in for pg_dump's output. */
const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
if [ "$1" = "run" ]; then env | grep '^PG' | sort >> "$FAKE_LOG"; printf 'PGDMP'; fi
exit "\${FAKE_STATUS:-0}"
`;

/** Records its arguments and BACKUP_* variables and writes the summary the CLI would. */
const FAKE_NPX = `#!/usr/bin/env bash
echo "npx $*" >> "$FAKE_LOG"
env | grep '^BACKUP_' | sort >> "$FAKE_LOG"
for arg in "$@"; do
  case "$arg" in --summary=*) printf '%s\\n' "\${FAKE_SUMMARY:-ok|1 object(s), 10 bytes in 0.1 s}" > "\${arg#--summary=}" ;; esac
done
exit "\${FAKE_STATUS:-0}"
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "backup-cloudflare-"));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin/docker"), FAKE_DOCKER, { mode: 0o755 });
  writeFileSync(join(dir, "bin/npx"), FAKE_NPX, { mode: 0o755 });
  mkdirSync(join(dir, "app"));
  writeFileSync(join(dir, "app/deploy.json"), "{}\n");
  writeFileSync(join(dir, "output"), "");
  writeFileSync(join(dir, "summary"), "");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(id: string, env: Record<string, string>): { status: number | null; stdout: string; output: string; summary: string; log: string } {
  const result = spawnSync("bash", ["-e", "-c", findStep(id).run ?? ""], {
    cwd: join(dir, "app"),
    encoding: "utf8",
    env: {
      PATH: `${join(dir, "bin")}:${process.env.PATH ?? ""}`,
      HOME: dir,
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: join(dir, "output"),
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
      FAKE_LOG: join(dir, "log"),
      ...env,
    },
  });
  const read = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");
  return { status: result.status, stdout: result.stdout, output: read(join(dir, "output")), summary: read(join(dir, "summary")), log: read(join(dir, "log")) };
}

const DATABASE_URL = "postgresql://migrator:pw@db.example.test:5432/app?sslmode=require";
const VALID = { APP: "acme-app", DATABASE_URL_INPUT: DATABASE_URL, BACKUP_CLI_VERSION: "0.1.1", POSTGRES_MAJOR: "17" };

describe("the backup-cloudflare action", () => {
  it("is a composite action whose required inputs are the app, the database URL and the CLI version", () => {
    expect(action.runs.using).toBe("composite");
    expect(Object.entries(action.inputs).filter(([, input]) => input.required === true).map(([name]) => name)).toEqual([
      "app",
      "database-url",
      "backup-cli-version",
    ]);
    expect(action.inputs["postgres-major"]?.default).toBe("17");
    expect(action.outputs.result?.value).toBe("${{ steps.run.outputs.result }}");
  });

  it("passes every input to its scripts through env, never interpolated into a script", () => {
    for (const step of action.runs.steps) expect(step.run ?? "").not.toContain("${{");
  });

  it("removes the pg_dump wrapper in every case", () => {
    const cleanup = action.runs.steps.at(-1);
    expect(cleanup?.if).toBe("${{ always() }}");
    expect(cleanup?.run).toBe('rm -f "$RUNNER_TEMP/softure-pg-dump"');
  });

  describe("check", () => {
    it("accepts valid inputs", () => {
      expect(run("check", VALID).status).toBe(0);
    });

    it("names every problem at once", () => {
      const result = run("check", { APP: "Acme App", DATABASE_URL_INPUT: "", BACKUP_CLI_VERSION: "latest", POSTGRES_MAJOR: "9" });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe(
        [
          "::error::app is not an app name (lower case letters, digits, - and _)",
          "::error::database-url is empty: pass the direct database URL secret (MIGRATE_DATABASE_URL) of the environment",
          "::error::backup-cli-version is not a version such as 0.1.1",
          "::error::postgres-major is not a Postgres major version from 14 to 19",
          "",
        ].join("\n"),
      );
    });

    it("refuses a URL that is not postgres:// without printing it", () => {
      const result = run("check", { ...VALID, DATABASE_URL_INPUT: "mysql://user:secret@db/app" });
      expect(result.stdout).toBe("::error::database-url is not a postgres:// URL\n");
      expect(result.stdout).not.toContain("secret");
    });
  });

  describe("pg-dump", () => {
    it("writes a private wrapper that runs pg_dump of the server's major with only the libpq variables", () => {
      const result = run("pg-dump", { POSTGRES_MAJOR: "17", DOCKER: "docker" });
      expect(result.status).toBe(0);
      const wrapper = join(dir, "softure-pg-dump");
      expect(result.output).toBe(`path=${wrapper}\n`);
      expect(statSync(wrapper).mode & 0o777).toBe(0o700);
      expect(result.log).toBe("docker pull --quiet postgres:17\n");

      const dumped = spawnSync(wrapper, ["--format=custom", "--no-password"], {
        encoding: "utf8",
        env: { PATH: `${join(dir, "bin")}:${process.env.PATH ?? ""}`, FAKE_LOG: join(dir, "log"), PGHOST: "db.example.test", PGPASSWORD: "pw" },
      });
      expect(dumped.stdout).toBe("PGDMP");
      expect(readFileSync(join(dir, "log"), "utf8").split("\n").slice(1)).toEqual([
        "docker run --rm -i --network host -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE postgres:17 pg_dump --format=custom --no-password",
        "PGHOST=db.example.test",
        "PGPASSWORD=pw",
        "",
      ]);
    });
  });

  describe("run", () => {
    const RUN_ENV = {
      APP: "acme-app",
      BACKUP_DATABASE_URL: DATABASE_URL,
      BACKUP_CLI_VERSION: "0.1.1",
      BACKUP_PG_DUMP: "/tmp/softure-pg-dump",
      DEPLOY_CONFIG: "deploy.json",
    };

    it("runs the pinned CLI with the config, the URL and the wrapper in its environment, and reports ok", () => {
      const result = run("run", RUN_ENV);
      expect(result.status).toBe(0);
      expect(result.log).toBe(
        [
          `npx --yes --package=@softure-ai/backup@0.1.1 softure-backup run --app=acme-app --summary=${join(dir, "softure-backup-summary")} --config=deploy.json`,
          `BACKUP_CLI_VERSION=0.1.1`,
          `BACKUP_DATABASE_URL=${DATABASE_URL}`,
          "BACKUP_PG_DUMP=/tmp/softure-pg-dump",
          "",
        ].join("\n"),
      );
      expect(result.output).toBe("result=ok\n");
      expect(result.summary).toBe("### Off-site backup\n\n`ok|1 object(s), 10 bytes in 0.1 s`\n");
      expect(existsSync(join(dir, "softure-backup-summary"))).toBe(false);
    });

    it("leaves --config out when the app has no deploy.json", () => {
      const result = run("run", { ...RUN_ENV, DEPLOY_CONFIG: "missing.json" });
      expect(result.log.split("\n")[0]).toBe(
        `npx --yes --package=@softure-ai/backup@0.1.1 softure-backup run --app=acme-app --summary=${join(dir, "softure-backup-summary")}`,
      );
    });

    it("reports not_configured as a success", () => {
      const result = run("run", { ...RUN_ENV, FAKE_SUMMARY: "not_configured" });
      expect(result.status).toBe(0);
      expect(result.output).toBe("result=not_configured\n");
    });

    it("fails the job with the CLI's status and summary when the run failed", () => {
      const result = run("run", { ...RUN_ENV, FAKE_STATUS: "1", FAKE_SUMMARY: "failed|dump_failed|pg_dump exited with 1: server version mismatch" });
      expect(result.status).toBe(1);
      expect(result.output).toBe("result=failed\n");
      expect(result.stdout).toBe("::error::the off-site backup failed (exit status 1): failed|dump_failed|pg_dump exited with 1: server version mismatch\n");
    });

    it("reports failed when the CLI ends before it writes a summary", () => {
      writeFileSync(join(dir, "bin/npx"), '#!/usr/bin/env bash\nexit 2\n', { mode: 0o755 });
      const result = run("run", RUN_ENV);
      expect(result.status).toBe(2);
      expect(result.output).toBe("result=failed\n");
      expect(result.summary).toBe("### Off-site backup\n\nThe run ended with exit status 2 before it wrote a summary; see the log.\n");
    });
  });
});
