// dump → encrypt → upload → status → restore → verify against a real Postgres (SOFTURE_TEST_POSTGRES_URL, set in
// CI; locally the cases skip without it, foundation/db/tests/postgres-env.test.ts) and the local fake S3. The
// Postgres 17 run of the same path against a real S3 gateway is offsite-store.test.ts (e2e.yml backup-integration).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateIdentity, identityToRecipient } from "age-encryption";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toLibpqEnv } from "@softure-ai/deploy";
import { BUCKET, READER, REGION, startFakeS3, WRITER, type FakeS3 } from "./support/fake-s3.js";
import { runBackupCli } from "./support/cli.js";

/** The verify runs' clock: 4 h 43 min after the dump's time in its name. */
const NOW = new Date("2026-11-09T08:00:00Z");
const ADMIN_URL = process.env.SOFTURE_TEST_POSTGRES_URL || undefined;
const MIGRATION = readFileSync(join(import.meta.dirname, "../migrations/0001_create_runs.sql"), "utf8");

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
  const url = new URL(ADMIN_URL ?? "postgres://localhost/postgres");
  url.pathname = `/${database}`;
  return url.href;
}

describe.runIf(ADMIN_URL !== undefined)("the off-site copy against a real Postgres", () => {
  let s3: FakeS3;
  let dir: string;
  let identity: string;
  let source: string;
  let env: Record<string, string | undefined>;
  const created: string[] = [];

  beforeEach(async () => {
    s3 = await startFakeS3();
    dir = mkdtempSync(join(tmpdir(), "softure-backup-pg-"));
    identity = await generateIdentity();
    source = `softure_backup_src_${String(Date.now())}_${String(Math.floor(Math.random() * 1e6))}`;
    created.push(source);
    await query(urlOf("postgres"), `CREATE DATABASE ${source}`);
    await query(
      urlOf(source),
      `CREATE TABLE users (id int PRIMARY KEY, email text NOT NULL);
       INSERT INTO users VALUES (1, 'a@example.com'), (2, 'b@example.com'), (3, 'c@example.com');
       CREATE SCHEMA billing; CREATE TABLE billing.subscriptions (id int PRIMARY KEY);
       INSERT INTO billing.subscriptions VALUES (1), (2);
       CREATE SCHEMA backup; SET search_path = backup; ${MIGRATION}`,
    );
    env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      BACKUP_S3_ENDPOINT: s3.endpoint,
      BACKUP_S3_REGION: REGION,
      BACKUP_S3_BUCKET: BUCKET,
      BACKUP_S3_ACCESS_KEY_ID: WRITER.id,
      BACKUP_S3_SECRET_ACCESS_KEY: WRITER.secret,
      BACKUP_S3_READ_ACCESS_KEY_ID: READER.id,
      BACKUP_S3_READ_SECRET_ACCESS_KEY: READER.secret,
      BACKUP_AGE_RECIPIENT: await identityToRecipient(identity),
      BACKUP_RESTORE_DATABASE_URL: urlOf("postgres"),
      BACKUP_VERIFY_DATABASE_URL: urlOf("postgres"),
    };
  });

  afterEach(async () => {
    await s3.close();
    rmSync(dir, { recursive: true, force: true });
    for (const name of created.splice(0)) await query(urlOf("postgres"), `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  });

  function dump(name: string): void {
    const libpq = toLibpqEnv(urlOf(source));
    if (!libpq.ok) throw new Error(libpq.problem);
    const result = spawnSync("pg_dump", ["--format=custom", "--file", join(dir, name)], { env: { PATH: process.env.PATH, ...libpq.env }, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`pg_dump failed: ${result.stderr}`);
  }

  it("uploads the night's dump, records the run, restores it into a new database and verifies it", async () => {
    dump("db-20261109T031700Z.dump");
    const upload = await runBackupCli(
      ["upload", "--app=acme-app", "--file=db-20261109T031700Z.dump", "--status-sql=status.sql", "--summary=summary.txt"],
      { cwd: dir, env },
    );
    expect(upload.stderr).toBe("");
    expect(upload.status).toBe(0);
    expect(readFileSync(join(dir, "summary.txt"), "utf8")).toMatch(/^ok\|1 object\(s\), \d+ bytes in \d+\.\d s\n$/);
    expect([...s3.objects.keys()]).toEqual(["acme-app/db-20261109T031700Z.dump.age"]);

    // deploy.sh pipes the status file into psql; the same SQL through a connection here.
    await query(urlOf(source), readFileSync(join(dir, "status.sql"), "utf8"));
    const runs = await query<{ result: string; size_bytes: string }>(urlOf(source), "SELECT result, size_bytes::text FROM backup.runs");
    expect(runs).toEqual([{ result: "ok", size_bytes: String(s3.objects.get("acme-app/db-20261109T031700Z.dump.age")?.length) }]);

    const restore = await runBackupCli(["restore", "--app=acme-app", "--identity=-"], { cwd: dir, env, stdin: `# created: today\n${identity}\n`, now: NOW });
    expect(restore.stderr).toBe("");
    const restored = /into the new database (\S+)\n$/.exec(restore.stdout)?.[1] ?? "";
    created.push(restored);
    expect(restored).toBe("postgres_restore_20261109080000");
    expect(await query(urlOf(restored), "SELECT count(*)::int AS n FROM users")).toEqual([{ n: 3 }]);

    const verify = await runBackupCli(["verify", "--app=acme-app", "--identity=key.txt", "--tables=users,billing.subscriptions"], { cwd: dir, env, now: NOW });
    // --identity=key.txt does not exist yet: a usage error that names the file, not the key.
    expect(verify.status).toBe(2);
    expect(verify.stderr).toContain("verify: cannot read");

    const verified = await runBackupCli(["verify", "--app=acme-app", "--identity=-", "--tables=users,billing.subscriptions"], { cwd: dir, env, stdin: identity, now: NOW });
    expect(verified.stderr).toBe("");
    expect(verified.stdout).toMatch(/^verify: acme-app\/db-20261109T031700Z\.dump\.age \([\d.]+ h old\) restores; schema guard skipped; users=3,billing\.subscriptions=2\n$/);
    const leftovers = await query<{ datname: string }>(urlOf("postgres"), "SELECT datname FROM pg_database WHERE datname LIKE 'softure_offsite_verify_%'");
    expect(leftovers).toEqual([]);
  });

  it("refuses to restore over an existing database without --overwrite, and restores over it with it", async () => {
    dump("db-20261109T031700Z.dump");
    expect((await runBackupCli(["upload", "--app=acme-app", "--file=db-20261109T031700Z.dump"], { cwd: dir, env })).status).toBe(0);
    await query(urlOf(source), "DELETE FROM users WHERE id > 1");

    const refused = await runBackupCli(["restore", "--app=acme-app", "--identity=-", `--into=${source}`], { cwd: dir, env, stdin: identity });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toBe(`restore: the database ${source} exists; pass --overwrite to restore over it, or restore into a new one\n`);
    expect(await query(urlOf(source), "SELECT count(*)::int AS n FROM users")).toEqual([{ n: 1 }]);

    const overwritten = await runBackupCli(["restore", "--app=acme-app", "--identity=-", `--into=${source}`, "--overwrite"], { cwd: dir, env, stdin: identity });
    expect(overwritten.stderr).toBe("");
    expect(overwritten.stdout).toBe(`restore: acme-app/db-20261109T031700Z.dump.age restored into the existing database ${source}\n`);
    expect(await query(urlOf(source), "SELECT count(*)::int AS n FROM users")).toEqual([{ n: 3 }]);
  });

  it("fails verify for a table the copy lacks, a copy too old and a wrong key, and drops the throwaway database", async () => {
    dump("db-20261109T031700Z.dump");
    expect((await runBackupCli(["upload", "--app=acme-app", "--file=db-20261109T031700Z.dump"], { cwd: dir, env })).status).toBe(0);
    const missing = await runBackupCli(["verify", "--app=acme-app", "--identity=-", "--tables=users,audit.events"], { cwd: dir, env, stdin: identity, now: NOW });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toBe("verify: the restored copy lacks audit.events\n");

    const old = await runBackupCli(["verify", "--app=acme-app", "--identity=-"], { cwd: dir, env, stdin: identity, now: new Date("2026-11-10T06:00:00Z") });
    expect(old.stderr).toBe("verify: the newest off-site copy acme-app/db-20261109T031700Z.dump.age is 26.7 h old, more than 26 h\n");

    const other = await generateIdentity();
    const wrongKey = await runBackupCli(["verify", "--app=acme-app", "--identity=-"], { cwd: dir, env, stdin: other, now: NOW });
    expect(wrongKey.status).toBe(1);
    expect(wrongKey.stderr).toMatch(/^verify: cannot decrypt acme-app\/db-20261109T031700Z\.dump\.age with this identity/);
    expect(await query(urlOf("postgres"), "SELECT datname FROM pg_database WHERE datname LIKE 'softure_offsite_verify_%'")).toEqual([]);
  });
});
