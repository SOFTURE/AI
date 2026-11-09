import type { BatchObservableCallback, Meter, Observable } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backup } from "@softure-ai/backup";
import { buildStatusSql } from "@softure-ai/backup/offsite";
import { registerBackupMetrics } from "@softure-ai/backup/server";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";

// A meter that keeps the gauges and the batch callback, so a test collects like an exporter would.
function createFakeMeter(): { meter: Meter; collect: () => Promise<Record<string, number>>; callbacks: () => number } {
  const callbacks = new Set<BatchObservableCallback>();
  const names = new Map<Observable, string>();
  const meter = {
    createObservableGauge(name: string) {
      const gauge = { name } as unknown as Observable;
      names.set(gauge, name);
      return gauge;
    },
    addBatchObservableCallback(callback: BatchObservableCallback) {
      callbacks.add(callback);
    },
    removeBatchObservableCallback(callback: BatchObservableCallback) {
      callbacks.delete(callback);
    },
  } as unknown as Meter;
  async function collect(): Promise<Record<string, number>> {
    const values: Record<string, number> = {};
    for (const callback of callbacks) {
      await callback({
        observe: (gauge: Observable, value: number) => {
          values[names.get(gauge) ?? "?"] = value;
        },
      });
    }
    return values;
  }
  return { meter, collect, callbacks: () => callbacks.size };
}

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase([backup()]);
});

afterEach(async () => {
  await database.close();
});

describe("registerBackupMetrics", () => {
  it("reports nothing while no run is recorded, then the newest run and the age of the last success", async () => {
    const { meter, collect, callbacks } = createFakeMeter();
    let now = new Date("2026-11-09T04:00:00Z");
    const unregister = registerBackupMetrics({ db: database.db, meter, now: () => now });
    expect(await collect()).toEqual({});

    const success = { kind: "database" as const, key: "acme-app/db-20261108T031700Z.dump.age", bytes: 1500, sha256: "b".repeat(64) };
    await database.client.exec(
      buildStatusSql({ startedAt: new Date("2026-11-08T03:17:00Z"), finishedAt: new Date("2026-11-08T03:17:05Z"), result: "ok", objects: [success], sizeBytes: 1500, error: null }),
    );
    await database.client.exec(
      buildStatusSql({
        startedAt: new Date("2026-11-09T03:17:00Z"),
        finishedAt: new Date("2026-11-09T03:17:02Z"),
        result: "failed",
        objects: [],
        sizeBytes: 0,
        error: { code: "network_error", message: "PUT could not reach the store" },
      }),
    );
    // The first collection cached the empty status for a minute.
    now = new Date("2026-11-09T04:01:00Z");
    expect(await collect()).toEqual({
      "softure.backup.last_success.age": 24 * 3600 + 43 * 60 + 55,
      "softure.backup.last_run.ok": 0,
      "softure.backup.last_run.size": 0,
      "softure.backup.last_run.duration": 2,
    });
    unregister();
    expect(callbacks()).toBe(0);
  });
});
