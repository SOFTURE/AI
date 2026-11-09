import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backup } from "@softure-ai/backup";
import { buildStatusSql, getPruneBefore, quoteLiteral, type RunRecord } from "@softure-ai/backup/offsite";
import { getLastBackup, getLastSuccessAgeSeconds, listBackupRuns } from "@softure-ai/backup/server";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";

const OBJECT = { kind: "database" as const, key: "acme-app/db-20261109T031700Z.dump.age", bytes: 2048, sha256: "a".repeat(64) };

function record(startedAt: string, overrides: Partial<RunRecord> = {}): RunRecord {
  const start = new Date(startedAt);
  return {
    startedAt: start,
    finishedAt: new Date(start.getTime() + 4000),
    result: "ok",
    objects: [OBJECT],
    sizeBytes: 2048,
    error: null,
    ...overrides,
  };
}

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase([backup()]);
});

afterEach(async () => {
  await database.close();
});

async function apply(run: RunRecord): Promise<void> {
  await database.client.exec(buildStatusSql(run));
}

describe("the status SQL of a run", () => {
  it("quotes literals so a message cannot end the statement", () => {
    expect(quoteLiteral("it's")).toBe("'it''s'");
    expect(quoteLiteral("a\0b")).toBe("'ab'");
  });

  it("records a successful run that getLastBackup returns with its objects", async () => {
    await apply(record("2026-11-09T03:17:00Z"));
    const status = await getLastBackup(database.db);
    expect(status.result).toBe("ok");
    expect(status.lastRun).toEqual({
      startedAt: new Date("2026-11-09T03:17:00Z"),
      finishedAt: new Date("2026-11-09T03:17:04Z"),
      result: "ok",
      objects: [OBJECT],
      sizeBytes: 2048,
      error: null,
    });
    expect(status.lastSuccess).toEqual(status.lastRun);
    expect(getLastSuccessAgeSeconds(status, new Date("2026-11-09T05:17:04Z"))).toBe(7200);
  });

  it("records a failure with its code and a message quotes cannot break, and keeps the last success apart", async () => {
    await apply(record("2026-11-08T03:17:00Z"));
    await apply(
      record("2026-11-09T03:17:00Z", {
        result: "failed",
        objects: [],
        sizeBytes: 0,
        error: { code: "upload_denied", message: "the store refused it'; DROP TABLE backup.runs; --" },
      }),
    );
    const status = await getLastBackup(database.db);
    expect(status.result).toBe("failed");
    expect(status.lastRun?.error).toEqual({ code: "upload_denied", message: "the store refused it'; DROP TABLE backup.runs; --" });
    expect(status.lastSuccess?.startedAt).toEqual(new Date("2026-11-08T03:17:00Z"));
    expect(await listBackupRuns(database.db, { limit: 5 })).toHaveLength(2);
  });

  it("reports not configured while no run is recorded", async () => {
    expect(await getLastBackup(database.db)).toEqual({ result: "not_configured", lastRun: null, lastSuccess: null });
    expect(await listBackupRuns(database.db)).toEqual([]);
  });

  it("records a not configured run as such", async () => {
    const at = new Date("2026-11-09T03:17:00Z");
    await apply({ startedAt: at, finishedAt: at, result: "not_configured", objects: [], sizeBytes: 0, error: null });
    const status = await getLastBackup(database.db);
    expect([status.result, status.lastSuccess]).toEqual(["not_configured", null]);
  });

  it("prunes rows older than 400 days before the new run and keeps the one exactly at the boundary", async () => {
    const newest = record("2026-11-09T03:17:00Z");
    const boundary = getPruneBefore(newest.startedAt);
    expect(boundary.toISOString()).toBe("2025-10-05T03:17:00.000Z");
    await apply(record(new Date(boundary.getTime() - 1000).toISOString()));
    await apply(record(boundary.toISOString()));
    await apply(newest);
    const runs = await listBackupRuns(database.db, { limit: 100 });
    expect(runs.map((run) => run.startedAt.toISOString())).toEqual(["2026-11-09T03:17:00.000Z", "2025-10-05T03:17:00.000Z"]);
  });

  it("lists the newest runs first, between 1 and 100", async () => {
    for (const day of ["05", "06", "07", "08"]) await apply(record(`2026-11-${day}T03:17:00Z`));
    expect((await listBackupRuns(database.db, { limit: 2 })).map((run) => run.startedAt.getUTCDate())).toEqual([8, 7]);
    expect(await listBackupRuns(database.db, { limit: 0 })).toHaveLength(1);
  });
});
