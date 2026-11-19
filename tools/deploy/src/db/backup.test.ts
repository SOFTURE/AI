import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  createBackup,
  formatBackupName,
  hasCustomFormatHeader,
  isBackupName,
  readBackupTime,
  selectAgedBackups,
  selectExpiredBackups,
} from "./backup.js";

describe("formatBackupName", () => {
  it("names a dump after its prefix and the UTC second, so names sort by time", () => {
    expect(formatBackupName("db", new Date("2026-10-05T18:01:02.345Z"))).toBe("db-20261005T180102Z.dump");
  });
});

describe("isBackupName", () => {
  it("matches only the dumps of the prefix", () => {
    expect(isBackupName("db", "db-20261005T180102Z.dump")).toBe(true);
    expect(isBackupName("db", "db-20261005T180102Z.dump.tmp")).toBe(false);
    expect(isBackupName("db", "dbx-20261005T180102Z.dump")).toBe(false);
    expect(isBackupName("db", "db-manual.dump")).toBe(false);
    expect(isBackupName("app", "db-20261005T180102Z.dump")).toBe(false);
  });
});

describe("selectExpiredBackups", () => {
  const names = [
    "db-20261003T120000Z.dump",
    "db-20261005T120000Z.dump",
    "notes.txt",
    "db-20261004T120000Z.dump",
    "other-20261001T120000Z.dump",
  ];

  it("lists the dumps of the prefix beyond the newest keep, newest first", () => {
    expect(selectExpiredBackups(names, "db", 1)).toEqual(["db-20261004T120000Z.dump", "db-20261003T120000Z.dump"]);
    expect(selectExpiredBackups(names, "db", 2)).toEqual(["db-20261003T120000Z.dump"]);
  });

  it("lists nothing when the folder holds no more than keep dumps", () => {
    expect(selectExpiredBackups(names, "db", 3)).toEqual([]);
    expect(selectExpiredBackups([], "db", 1)).toEqual([]);
  });
});

describe("readBackupTime", () => {
  it("reads the UTC second back from the name", () => {
    expect(readBackupTime("db", "db-20261005T180102Z.dump").toISOString()).toBe("2026-10-05T18:01:02.000Z");
  });
});

describe("selectAgedBackups", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const names = [
    "db-20261001T120000Z.dump",
    "db-20261001T115959Z.dump",
    "db-20260901T120000Z.dump",
    "db-20261030T120000Z.dump",
    "other-20200101T000000Z.dump",
  ];

  it("lists the dumps older than the limit; one exactly that old stays", () => {
    expect(selectAgedBackups(names, "db", 30, now)).toEqual(["db-20261001T115959Z.dump", "db-20260901T120000Z.dump"]);
  });

  it("never lists the newest dump, however old", () => {
    expect(selectAgedBackups(["db-20200101T000000Z.dump", "db-20190101T000000Z.dump"], "db", 30, now)).toEqual([
      "db-20190101T000000Z.dump",
    ]);
    expect(selectAgedBackups(["db-20200101T000000Z.dump"], "db", 1, now)).toEqual([]);
  });
});

describe("hasCustomFormatHeader", () => {
  const dir = mkdtempSync(join(tmpdir(), "softure-deploy-header-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("accepts a file that starts with PGDMP and refuses an empty, short or plain SQL one", () => {
    const write = (name: string, text: string) => {
      writeFileSync(join(dir, name), text);
      return join(dir, name);
    };
    expect(hasCustomFormatHeader(write("ok.dump", "PGDMP\u0001\u000e\u0000"))).toBe(true);
    expect(hasCustomFormatHeader(write("empty.dump", ""))).toBe(false);
    expect(hasCustomFormatHeader(write("short.dump", "PGD"))).toBe(false);
    expect(hasCustomFormatHeader(write("plain.dump", "--\n-- PostgreSQL database dump\n"))).toBe(false);
  });
});

describe("createBackup", () => {
  const dir = mkdtempSync(join(tmpdir(), "softure-deploy-backup-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeScript(name: string, body: string): string {
    const path = join(dir, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    return path;
  }

  const base = { prefix: "db", keep: 3, now: new Date("2026-10-05T18:01:02Z"), env: { PATH: process.env.PATH } };

  it("gives pg_dump a connect timeout unless the URL sets one", async () => {
    const seen = join(dir, "connect-timeout.txt");
    const pgDump = writeScript("env-pg-dump.sh", `printf '%s\\n' "$PGCONNECT_TIMEOUT" >> "${seen}"\nprintf 'PGDMP fake'`);
    const first = await createBackup({ ...base, dir: join(dir, "a"), libpqEnv: { PGHOST: "db" }, pgDump });
    const second = await createBackup({ ...base, dir: join(dir, "b"), libpqEnv: { PGHOST: "db", PGCONNECT_TIMEOUT: "3" }, pgDump });
    expect([first.ok, second.ok]).toEqual([true, true]);
    expect(readFileSync(seen, "utf8")).toBe("10\n3\n");
  });

  it("stops a pg_dump that runs past its time limit and keeps no file", async () => {
    const pgDump = writeScript("slow-pg-dump.sh", "exec sleep 5");
    const target = join(dir, "slow");
    const startedAt = Date.now();
    const result = await createBackup({ ...base, dir: target, libpqEnv: {}, pgDump, timeoutMs: 200 });
    expect(result).toEqual({ ok: false, problem: "pg_dump did not finish within 1 s and was stopped" });
    expect(Date.now() - startedAt).toBeLessThan(4000);
    expect(readdirSync(target)).toEqual([]);
  });
});
