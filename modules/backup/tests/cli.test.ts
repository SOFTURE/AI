import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBackupCli } from "./support/cli.js";

const NOW = new Date("2026-11-09T03:17:00Z");

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-backup-cli-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-backup", () => {
  it("records not configured and exits 0 when no BACKUP_S3_* name is set", async () => {
    const result = await runBackupCli(
      ["upload", "--app=acme-app", "--file=db-20261109T031700Z.dump", "--status-sql=status.sql", "--summary=summary.txt"],
      { cwd: dir, env: {}, now: NOW },
    );
    expect(result).toEqual({ status: 0, stdout: "upload: not configured (no BACKUP_S3_* in the environment); nothing uploaded.\n", stderr: "" });
    expect(readFileSync(join(dir, "summary.txt"), "utf8")).toBe("not_configured\n");
    expect(readFileSync(join(dir, "status.sql"), "utf8")).toContain("'not_configured'");
  });

  it("records config_invalid with the problems, not the values, and exits 1", async () => {
    const result = await runBackupCli(["upload", "--app=acme-app", "--file=x", "--status-sql=status.sql", "--summary=summary.txt"], {
      cwd: dir,
      env: { BACKUP_S3_BUCKET: "acme-backups", BACKUP_S3_SECRET_ACCESS_KEY: "super-secret-value" },
      now: NOW,
    });
    expect(result.status).toBe(1);
    const summary = readFileSync(join(dir, "summary.txt"), "utf8");
    expect(summary).toBe(
      "failed|config_invalid|BACKUP_S3_ENDPOINT is not set; BACKUP_S3_ACCESS_KEY_ID is not set; BACKUP_AGE_RECIPIENT is not set\n",
    );
    expect(readFileSync(join(dir, "status.sql"), "utf8")).toContain("'config_invalid'");
    expect(result.stdout + result.stderr + summary).not.toContain("super-secret-value");
  });

  it("refuses an age secret key in any argument, before anything else", async () => {
    const result = await runBackupCli(["restore", "--identity=AGE-SECRET-KEY-1QQQQ"], { cwd: dir, env: {} });
    expect(result.status).toBe(2);
    expect(result.stderr).toBe(
      "softure-backup: an argument holds an age secret key; pass it through --identity=<file> or --identity=- (stdin), never as an argument.\n",
    );
    expect(result.stderr).not.toContain("QQQQ");
  });

  const READ_ENV = {
    BACKUP_S3_ENDPOINT: "http://127.0.0.1:9",
    BACKUP_S3_BUCKET: "acme-backups",
    BACKUP_S3_READ_ACCESS_KEY_ID: "read-id",
    BACKUP_S3_READ_SECRET_ACCESS_KEY: "read-secret",
    BACKUP_RESTORE_DATABASE_URL: "postgres://postgres:pw@127.0.0.1:9/postgres",
  };

  it("needs an identity, a valid one, and --into for --overwrite", async () => {
    const noIdentity = await runBackupCli(["restore", "--app=acme-app"], { cwd: dir, env: READ_ENV });
    expect([noIdentity.status, noIdentity.stderr]).toEqual([2, "softure-backup: restore: --identity=<file> or --identity=- (stdin) is required.\n"]);
    writeFileSync(join(dir, "key.txt"), "# a public key is not an identity\nage1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p\n");
    const notAKey = await runBackupCli(["restore", "--app=acme-app", "--identity=key.txt"], { cwd: dir, env: READ_ENV });
    expect(notAKey.stderr).toBe("softure-backup: restore: the identity has a line that is not an age secret key (AGE-SECRET-KEY-1…).\n");
    const overwrite = await runBackupCli(["restore", "--app=acme-app", "--overwrite", "--identity=-"], { cwd: dir, env: READ_ENV });
    expect(overwrite.stderr).toBe("softure-backup: restore: --overwrite needs --into=<database>, the database to restore over.\n");
  });

  it("needs the read token and a database URL for restore", async () => {
    const writeOnly = await runBackupCli(["restore", "--app=acme-app", "--identity=-"], {
      cwd: dir,
      env: { BACKUP_S3_ENDPOINT: "https://store.example", BACKUP_S3_BUCKET: "acme-backups", BACKUP_S3_ACCESS_KEY_ID: "w", BACKUP_S3_SECRET_ACCESS_KEY: "w" },
    });
    expect(writeOnly.stderr).toBe(
      "softure-backup: restore: the off-site settings are not valid: BACKUP_S3_READ_ACCESS_KEY_ID is not set; BACKUP_S3_READ_SECRET_ACCESS_KEY is not set.\n",
    );
    const withoutUrl: Record<string, string> = { ...READ_ENV };
    delete withoutUrl.BACKUP_RESTORE_DATABASE_URL;
    const noUrl = await runBackupCli(["restore", "--app=acme-app", "--identity=-"], { cwd: dir, env: withoutUrl });
    expect(noUrl.stderr).toBe("softure-backup: restore: BACKUP_RESTORE_DATABASE_URL is not set (a superuser's postgres:// URL).\n");
  });

  it("prints the lifecycle rule for the prefix, and refuses days out of bounds", async () => {
    const xml = await runBackupCli(["lifecycle", "--app=acme-app", "--days=14"], { cwd: dir, env: {} });
    expect(xml.status).toBe(0);
    expect(xml.stdout).toContain("<Expiration><Days>14</Days></Expiration>");
    const json = await runBackupCli(["lifecycle", "--format=json"], { cwd: dir, env: { BACKUP_S3_PREFIX: "prod/acme" } });
    expect(JSON.parse(json.stdout)).toMatchObject({ Rules: [{ Filter: { Prefix: "prod/acme/" }, Expiration: { Days: 30 } }] });
    const tooLong = await runBackupCli(["lifecycle", "--app=acme-app", "--days=4000"], { cwd: dir, env: {} });
    expect([tooLong.status, tooLong.stderr]).toEqual([2, "softure-backup: lifecycle: --days is from 1 to 3650, not 4000.\n"]);
  });

  it("reads the tables to verify from deploy.json, less excludeTableData", async () => {
    writeFileSync(join(dir, "deploy.json"), JSON.stringify({ database: { rowCountTables: ["users", "audit.ips"], excludeTableData: ["audit.ips"] } }));
    // The run stops at the store (nothing listens on port 9); the tables were read and accepted before it.
    const result = await runBackupCli(["verify", "--app=acme-app", "--identity=-", "--config=deploy.json"], {
      cwd: dir,
      env: { ...READ_ENV, BACKUP_VERIFY_DATABASE_URL: READ_ENV.BACKUP_RESTORE_DATABASE_URL },
      stdin: "AGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSHN8Q9Z",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^softure-backup: verify failed: LIST acme-app\/ could not reach 127\.0\.0\.1:9/);
    writeFileSync(join(dir, "deploy.json"), JSON.stringify({ database: { rowCountTables: ["Users"] } }));
    const invalid = await runBackupCli(["verify", "--app=acme-app", "--identity=-", "--config=deploy.json"], {
      cwd: dir,
      env: { ...READ_ENV, BACKUP_VERIFY_DATABASE_URL: READ_ENV.BACKUP_RESTORE_DATABASE_URL },
    });
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain("is not a valid deploy.json: database.rowCountTables.0:");
  });

  it("prints its usage without a command and refuses an unknown one or flag", async () => {
    expect((await runBackupCli([], { cwd: dir, env: {} })).status).toBe(2);
    expect((await runBackupCli(["help"], { cwd: dir, env: {} })).stdout).toContain("usage: softure-backup <command>");
    expect((await runBackupCli(["delete"], { cwd: dir, env: {} })).stderr).toContain("unknown command delete.");
    expect((await runBackupCli(["upload", "--app=a", "--force"], { cwd: dir, env: {} })).status).toBe(2);
  });
});
