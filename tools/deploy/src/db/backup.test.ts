import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
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
