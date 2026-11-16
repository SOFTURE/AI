// `softure-backup run`: the night's copy for a host without a server. It dumps over BACKUP_DATABASE_URL with a fake
// pg_dump here, uploads to the fake S3 with the same code as `upload` and records the same row; the real Postgres
// path is in offsite-postgres.test.ts.
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Decrypter, generateIdentity, identityToRecipient } from "age-encryption";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDumpFileName, buildPgDumpArgs, type RunRecord } from "@softure-ai/backup/offsite";
import { BUCKET, REGION, startFakeS3, WRITER, type FakeS3 } from "./support/fake-s3.js";
import { runBackupCli } from "./support/cli.js";

const NOW = new Date("2026-11-17T03:17:00Z");
const DATABASE_URL = "postgresql://app_migrator:db-password-789@db.example.test:5432/app?sslmode=require";

let s3: FakeS3;
let dir: string;
let identity: string;
let env: Record<string, string | undefined>;
let recorded: { url: string; record: RunRecord }[];

/** A pg_dump that writes its arguments and libpq variables to a file and `PGDMP <database>` to stdout. */
function writeFakePgDump(options: { exitCode?: number; output?: string } = {}): string {
  const path = join(dir, "pg_dump");
  const output = options.output ?? 'PGDMP $PGDATABASE';
  writeFileSync(
    path,
    [
      "#!/usr/bin/env bash",
      `printf '%s\\n' "$@" > "${dir}/pg_dump.args"`,
      `env | grep '^PG' | sort > "${dir}/pg_dump.env"`,
      `printf '%s' "${output}"`,
      `echo "pg_dump: error: something about $PGDATABASE" >&2`,
      `exit ${String(options.exitCode ?? 0)}`,
      "",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
  return path;
}

beforeEach(async () => {
  s3 = await startFakeS3();
  dir = mkdtempSync(join(tmpdir(), "softure-backup-run-test-"));
  identity = await generateIdentity();
  recorded = [];
  env = {
    PATH: process.env.PATH,
    BACKUP_DATABASE_URL: DATABASE_URL,
    BACKUP_S3_ENDPOINT: s3.endpoint,
    BACKUP_S3_REGION: REGION,
    BACKUP_S3_BUCKET: BUCKET,
    BACKUP_S3_ACCESS_KEY_ID: WRITER.id,
    BACKUP_S3_SECRET_ACCESS_KEY: WRITER.secret,
    BACKUP_AGE_RECIPIENT: await identityToRecipient(identity),
    BACKUP_PG_DUMP: writeFakePgDump(),
  };
});

afterEach(async () => {
  await s3.close();
  rmSync(dir, { recursive: true, force: true });
});

function run(args: string[]) {
  return runBackupCli(["run", ...args], {
    cwd: dir,
    env,
    now: NOW,
    recordRun: (url, record) => {
      recorded.push({ url, record });
      return Promise.resolve();
    },
  });
}

async function decrypt(data: Buffer): Promise<string> {
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity);
  return decrypter.decrypt(new Uint8Array(data), "text");
}

describe("buildDumpFileName", () => {
  it("names the dump like the deploy's own backups, so the keys sort with a VPS's", () => {
    expect(buildDumpFileName(NOW)).toBe("db-20261117T031700Z.dump");
    expect(buildDumpFileName(new Date("2026-01-02T00:00:09.999Z"))).toBe("db-20260102T000009Z.dump");
  });
});

describe("buildPgDumpArgs", () => {
  it("dumps in the custom format with no password prompt and leaves out the excluded tables' rows", () => {
    expect(buildPgDumpArgs([])).toEqual(["--format=custom", "--no-password"]);
    expect(buildPgDumpArgs(["security.rate_limits", "public.sessions"])).toEqual([
      "--format=custom",
      "--no-password",
      "--exclude-table-data=security.rate_limits",
      "--exclude-table-data=public.sessions",
    ]);
  });
});

describe("softure-backup run", () => {
  it("dumps over the URL's libpq variables, uploads the encrypted dump and records the run", async () => {
    writeFileSync(join(dir, "deploy.json"), JSON.stringify({ database: { excludeTableData: ["security.rate_limits"] } }));

    const result = await run(["--app=acme-app", "--config=deploy.json", "--summary=summary.txt"]);

    const key = "acme-app/db-20261117T031700Z.dump.age";
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(new RegExp(`^run: ${key.replace(/\./g, "\\.")} \\(\\d+ bytes, sha256 [0-9a-f]{64}\\)\\n$`));
    expect(await decrypt(s3.objects.get(key) ?? Buffer.alloc(0))).toBe("PGDMP app");
    expect(readFileSync(join(dir, "pg_dump.args"), "utf8")).toBe("--format=custom\n--no-password\n--exclude-table-data=security.rate_limits\n");
    expect(readFileSync(join(dir, "pg_dump.env"), "utf8")).toBe(
      "PGDATABASE=app\nPGHOST=db.example.test\nPGPASSWORD=db-password-789\nPGPORT=5432\nPGSSLMODE=require\nPGUSER=app_migrator\n",
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.url).toBe(DATABASE_URL);
    expect(recorded[0]?.record).toMatchObject({ result: "ok", error: null, startedAt: NOW, objects: [{ kind: "database", key }] });
    expect(readFileSync(join(dir, "summary.txt"), "utf8")).toMatch(/^ok\|1 object\(s\), \d+ bytes in 0\.0 s\n$/);
    expect(s3.requests.every((request) => request.startsWith("PUT ") && request.endsWith(WRITER.id))).toBe(true);
  });

  it("records not configured and exits 0 without dumping when no BACKUP_S3_* name is set", async () => {
    env = { PATH: process.env.PATH, BACKUP_DATABASE_URL: DATABASE_URL, BACKUP_PG_DUMP: env.BACKUP_PG_DUMP };

    const result = await run(["--app=acme-app"]);

    expect(result).toEqual({ status: 0, stdout: "run: not configured (no BACKUP_S3_* in the environment); nothing dumped or uploaded.\n", stderr: "" });
    expect(existsSync(join(dir, "pg_dump.args"))).toBe(false);
    expect(recorded.map((entry) => entry.record.result)).toEqual(["not_configured"]);
  });

  it("records dump_failed, uploads nothing and keeps the password out of the message when pg_dump fails", async () => {
    env.BACKUP_PG_DUMP = writeFakePgDump({ exitCode: 1, output: "PGDMP half" });

    const result = await run(["--app=acme-app"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("run: failed (dump_failed): pg_dump exited with 1: pg_dump: error: something about app\n");
    expect(s3.objects.size).toBe(0);
    expect(recorded[0]?.record).toMatchObject({ result: "failed", objects: [], error: { code: "dump_failed" } });
    expect(JSON.stringify(recorded.map((entry) => entry.record)) + result.stdout + result.stderr).not.toContain("db-password-789");
  });

  it("fails as dump_failed when pg_dump writes nothing", async () => {
    env.BACKUP_PG_DUMP = writeFakePgDump({ output: "" });

    const result = await run(["--app=acme-app"]);

    expect(result.status).toBe(1);
    expect(recorded[0]?.record.error).toEqual({ code: "dump_failed", message: "pg_dump wrote nothing" });
  });

  it("records a refused upload as upload_denied with no secret in the message", async () => {
    env.BACKUP_S3_SECRET_ACCESS_KEY = "a-wrong-secret-value";

    const result = await run(["--app=acme-app"]);

    expect(result.status).toBe(1);
    expect(recorded[0]?.record).toMatchObject({ result: "failed", error: { code: "upload_denied" } });
    expect(JSON.stringify(recorded) + result.stderr).not.toContain("a-wrong-secret-value");
  });

  it("exits 1 and says so when the row cannot be written, without the URL", async () => {
    const result = await runBackupCli(["run", "--app=acme-app"], {
      cwd: dir,
      env,
      now: NOW,
      recordRun: () => Promise.reject(new Error(`connect ECONNREFUSED for ${DATABASE_URL}`)),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("run: ok, but the run could not be recorded in backup.runs: connect ECONNREFUSED for ***\n");
    expect(s3.objects.size).toBe(1);
  });

  it("leaves no dump on the runner, whatever the outcome", async () => {
    const before = new Set(readdirSync(tmpdir()).filter((name) => name.startsWith("softure-backup-run-") && !name.includes("test")));
    await run(["--app=acme-app"]);
    env.BACKUP_PG_DUMP = writeFakePgDump({ exitCode: 2 });
    await run(["--app=acme-app"]);
    const after = readdirSync(tmpdir()).filter((name) => name.startsWith("softure-backup-run-") && !name.includes("test") && !before.has(name));
    expect(after).toEqual([]);
  });

  it("refuses a run with no BACKUP_DATABASE_URL or a URL that is not postgres://", async () => {
    env.BACKUP_DATABASE_URL = undefined;
    expect(await run(["--app=acme-app"])).toEqual({
      status: 2,
      stdout: "",
      stderr: "softure-backup: run: BACKUP_DATABASE_URL is not set (a superuser's postgres:// URL).\n",
    });
    env.BACKUP_DATABASE_URL = "mysql://x";
    expect((await run(["--app=acme-app"])).stderr).toBe("softure-backup: run: BACKUP_DATABASE_URL is not a postgres:// URL.\n");
    expect(recorded).toEqual([]);
  });

  it("refuses a run without --app or with an invalid deploy.json", async () => {
    expect((await run([])).stderr).toBe("softure-backup: run: --app=<name> is required (the default key prefix).\n");
    writeFileSync(join(dir, "deploy.json"), "{");
    expect((await run(["--app=acme-app", "--config=deploy.json"])).stderr).toBe(`softure-backup: run: ${join(dir, "deploy.json")} is not JSON.\n`);
  });
});
