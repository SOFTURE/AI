import { describe, expect, it } from "vitest";
import { formatBackupName, isBackupName, selectExpiredBackups } from "./backup.js";

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
