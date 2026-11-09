import { describe, expect, it } from "vitest";
import { buildObjectKey, parseBackupFileName, parseObjectKey, selectNewestKey } from "@softure-ai/backup/offsite";

describe("backup object names", () => {
  it("accepts the deploy's dump and data archive names with their time", () => {
    expect(parseBackupFileName("db-20261109T031700Z.dump")).toEqual({
      kind: "database",
      name: "db-20261109T031700Z.dump",
      takenAt: new Date("2026-11-09T03:17:00Z"),
    });
    expect(parseBackupFileName("data-20261109-031702.tar.gz")).toEqual({
      kind: "data",
      name: "data-20261109-031702.tar.gz",
      takenAt: new Date("2026-11-09T03:17:02Z"),
    });
  });

  it("refuses any other name, a hidden partial file and an impossible date", () => {
    for (const name of ["db.dump", ".incoming-12.dump", "db-20261109T031700Z.dump.age", "../db-20261109T031700Z.dump", "data-20261109.tar.gz", "db-20261399T031700Z.dump"]) {
      expect(parseBackupFileName(name), name).toBeNull();
    }
  });

  it("keys an object as <prefix>/<file name>.age and reads it back only under that prefix", () => {
    const key = buildObjectKey("acme-app", "db-20261109T031700Z.dump");
    expect(key).toBe("acme-app/db-20261109T031700Z.dump.age");
    expect(parseObjectKey("acme-app", key)?.kind).toBe("database");
    expect(parseObjectKey("other-app", key)).toBeNull();
    expect(parseObjectKey("acme-app", "acme-app/old/db-20261109T031700Z.dump.age")).toBeNull();
  });

  it("selects the newest key of a kind by the time in its name, not by its position", () => {
    const keys = [
      "acme-app/db-20261108T031700Z.dump.age",
      "acme-app/db-20261109T031700Z.dump.age",
      "acme-app/data-20261110-031700.tar.gz.age",
      "acme-app/db-20261107T031700Z.dump.age",
      "acme-app/notes.txt",
    ];
    expect(selectNewestKey("acme-app", keys, "database")).toEqual({ key: "acme-app/db-20261109T031700Z.dump.age", takenAt: new Date("2026-11-09T03:17:00Z") });
    expect(selectNewestKey("acme-app", keys, "data")?.key).toBe("acme-app/data-20261110-031700.tar.gz.age");
    expect(selectNewestKey("acme-app", [], "database")).toBeNull();
  });
});
