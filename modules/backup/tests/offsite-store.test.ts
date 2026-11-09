// The whole path against a real S3-compatible store and a real Postgres: dump (pg_dump 17) → encrypt → upload with a
// write-only identity → status in backup.runs → restore with a read-only identity → verify with the schema guard
// against the migrations the image would ship. It runs only with the BACKUP_IT_* settings, which the
// `backup-integration` job of e2e.yml sets (Postgres 17 service, a SeaweedFS S3 gateway from scripts/ci/backup-s3.sh;
// MinIO no longer publishes images); locally every case skips.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, exportMigrations, migrate } from "@softure-ai/db";
import { generateIdentity, identityToRecipient } from "age-encryption";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toLibpqEnv } from "@softure-ai/deploy";
import { backup } from "../src/index.js";
import { getLastBackup } from "../src/server/index.js";
import { runBackupCli } from "./support/cli.js";

const IT = {
  adminUrl: process.env.BACKUP_IT_DATABASE_URL || undefined,
  endpoint: process.env.BACKUP_IT_S3_ENDPOINT || undefined,
  bucket: process.env.BACKUP_IT_S3_BUCKET ?? "softure-backups",
  region: process.env.BACKUP_IT_S3_REGION ?? "us-east-1",
  writerId: process.env.BACKUP_IT_WRITER_ID ?? "",
  writerSecret: process.env.BACKUP_IT_WRITER_SECRET ?? "",
  readerId: process.env.BACKUP_IT_READER_ID ?? "",
  readerSecret: process.env.BACKUP_IT_READER_SECRET ?? "",
  pgDump: process.env.BACKUP_IT_PG_DUMP ?? "pg_dump",
  pgRestore: process.env.BACKUP_IT_PG_RESTORE ?? "pg_restore",
};

async function query<Row extends object>(url: string, text: string): Promise<Row[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<Row>(text)).rows;
  } finally {
    await client.end();
  }
}

function urlOf(database: string): string {
  const url = new URL(IT.adminUrl ?? "postgres://localhost/postgres");
  url.pathname = `/${database}`;
  return url.href;
}

/** `db-20261109T031700Z.dump` for now, as `softure-deploy backup` names it. */
function getDumpName(now: Date): string {
  return `db-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.dump`;
}

describe.runIf(IT.adminUrl !== undefined && IT.endpoint !== undefined)("the off-site copy on Postgres 17 and a real S3 store", () => {
  const app = `acme-it-${String(Date.now())}`;
  const source = `softure_backup_it_${String(Date.now())}`;
  const created = [source];
  let dir: string;
  let identity: string;
  let dumpName: string;
  let env: Record<string, string | undefined>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "softure-backup-it-"));
    identity = await generateIdentity();
    await query(urlOf("postgres"), `CREATE DATABASE ${source}`);
    // The app's database as the running app left it: the module migrated through the ledger, plus its own tables.
    const handle = await createDatabase(urlOf(source));
    try {
      const migrated = await migrate(handle, { modules: [backup()] });
      expect(migrated.ok).toBe(true);
    } finally {
      await handle.close();
    }
    await query(
      urlOf(source),
      `CREATE TABLE users (id int PRIMARY KEY, email text NOT NULL);
       INSERT INTO users SELECT n, 'user' || n || '@example.com' FROM generate_series(1, 250) AS n;`,
    );
    const exported = await exportMigrations([backup()], join(dir, "image"));
    expect(exported.ok).toBe(true);

    dumpName = getDumpName(new Date());
    const libpq = toLibpqEnv(urlOf(source));
    if (!libpq.ok) throw new Error(libpq.problem);
    const dumped = spawnSync(IT.pgDump, ["--format=custom", "--file", join(dir, dumpName)], {
      env: { PATH: process.env.PATH, ...libpq.env },
      encoding: "utf8",
    });
    if (dumped.status !== 0) throw new Error(`pg_dump failed: ${dumped.stderr}`);

    env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      BACKUP_S3_ENDPOINT: IT.endpoint,
      BACKUP_S3_REGION: IT.region,
      BACKUP_S3_BUCKET: IT.bucket,
      BACKUP_S3_PREFIX: app,
      BACKUP_S3_ACCESS_KEY_ID: IT.writerId,
      BACKUP_S3_SECRET_ACCESS_KEY: IT.writerSecret,
      BACKUP_S3_READ_ACCESS_KEY_ID: IT.readerId,
      BACKUP_S3_READ_SECRET_ACCESS_KEY: IT.readerSecret,
      BACKUP_AGE_RECIPIENT: await identityToRecipient(identity),
      BACKUP_RESTORE_DATABASE_URL: urlOf("postgres"),
      BACKUP_VERIFY_DATABASE_URL: urlOf("postgres"),
      BACKUP_PG_RESTORE: IT.pgRestore,
    };
  });

  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    for (const name of created) await query(urlOf("postgres"), `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  });

  it("uploads with the write-only identity, records the run, restores and verifies with the read-only identity", async () => {
    const upload = await runBackupCli(["upload", `--app=${app}`, `--file=${dumpName}`, "--status-sql=status.sql", "--summary=summary.txt"], { cwd: dir, env });
    expect(upload.stderr).toBe("");
    expect(upload.status).toBe(0);
    expect(readFileSync(join(dir, "summary.txt"), "utf8")).toMatch(/^ok\|1 object\(s\), \d+ bytes in \d+\.\d s\n$/);

    // deploy.sh pipes the status file into psql as the superuser; the app then reads it.
    await query(urlOf(source), readFileSync(join(dir, "status.sql"), "utf8"));
    const handle = await createDatabase(urlOf(source));
    try {
      const status = await getLastBackup(handle.db);
      expect(status.result).toBe("ok");
      expect(status.lastRun?.objects).toHaveLength(1);
      expect(status.lastRun?.objects[0]?.key).toBe(`${app}/${dumpName}.age`);
      expect(status.lastRun?.objects[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(status.lastSuccess).toEqual(status.lastRun);
    } finally {
      await handle.close();
    }

    const restore = await runBackupCli(["restore", `--app=${app}`, "--identity=-"], { cwd: dir, env, stdin: identity });
    expect(restore.stderr).toBe("");
    expect(restore.status).toBe(0);
    const restored = /into the new database (\S+)\n$/.exec(restore.stdout)?.[1] ?? "";
    created.push(restored);
    expect(await query(urlOf(restored), "SELECT count(*)::int AS n FROM users")).toEqual([{ n: 250 }]);

    const verified = await runBackupCli(["verify", `--app=${app}`, "--identity=-", "--tables=users,backup.runs", "--migrations-dir=image"], {
      cwd: dir,
      env,
      stdin: identity,
    });
    expect(verified.stderr).toBe("");
    expect(verified.stdout).toMatch(new RegExp(`^verify: ${app}/${dumpName.replace(/\./g, "\\.")}\\.age \\([\\d.]+ h old\\) restores; schema guard passed; users=250,backup\\.runs=0\\n$`));
    expect(await query(urlOf("postgres"), "SELECT datname FROM pg_database WHERE datname LIKE 'softure_offsite_verify_%'")).toEqual([]);
  });

  it("keeps each token to its side: the writer cannot read, the reader cannot write", async () => {
    const swapped = {
      ...env,
      BACKUP_S3_READ_ACCESS_KEY_ID: IT.writerId,
      BACKUP_S3_READ_SECRET_ACCESS_KEY: IT.writerSecret,
      BACKUP_S3_ACCESS_KEY_ID: IT.readerId,
      BACKUP_S3_SECRET_ACCESS_KEY: IT.readerSecret,
    };
    const read = await runBackupCli(["fetch", `--app=${app}`, "--identity=-", "--kind=database", "--out=copy.dump"], { cwd: dir, env: swapped, stdin: identity });
    expect(read.status).toBe(1);
    expect(read.stderr).toMatch(/denied|403/i);

    const write = await runBackupCli(["upload", `--app=${app}`, `--file=${dumpName}`, "--summary=refused.txt"], { cwd: dir, env: swapped });
    expect(write.status).toBe(1);
    expect(readFileSync(join(dir, "refused.txt"), "utf8")).toMatch(/^failed\|upload_denied\|/);
    expect(write.stdout + write.stderr).not.toContain(IT.readerSecret);
  });
});
