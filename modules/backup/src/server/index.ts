// What an app reads of the off-site backup: the newest run and the newest successful one for a settings screen, a
// short history, metrics for an alert ("off-site backup older than 26 h") and the module's health check. The rows
// are written on the host by `softure-backup upload` (deploy.sh maintain); no run recorded means not configured.
import { metrics, type Meter } from "@opentelemetry/api";
import { ok, type HealthCheck } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { createLogger } from "@softure-ai/observability";
import { desc, eq, sql } from "drizzle-orm";
import type { BackupRun, BackupStatus } from "../contract.js";
import { runs } from "../schema.js";

const MAX_HISTORY = 100;
const DEFAULT_HISTORY = 10;
/** Metrics read the table at most this often, however often the exporter collects. */
const METRICS_CACHE_MS = 60_000;

type RunRow = typeof runs.$inferSelect;

function toRun(row: RunRow): BackupRun {
  return {
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    result: row.result,
    objects: row.objects,
    sizeBytes: Number(row.sizeBytes),
    error: row.errorCode === null ? null : { code: row.errorCode, message: row.errorMessage ?? "" },
  };
}

/** The newest runs, newest first: `limit` from 1 to 100 (default 10). */
export async function listBackupRuns(db: Queryable, options: { limit?: number } = {}): Promise<BackupRun[]> {
  const limit = Math.min(MAX_HISTORY, Math.max(1, Math.trunc(options.limit ?? DEFAULT_HISTORY)));
  const rows = await db.select().from(runs).orderBy(desc(runs.startedAt), desc(runs.id)).limit(limit);
  return rows.map(toRun);
}

/** The status for a settings screen: the newest run and the newest successful one. */
export async function getLastBackup(db: Queryable): Promise<BackupStatus> {
  const [last] = await db.select().from(runs).orderBy(desc(runs.startedAt), desc(runs.id)).limit(1);
  if (last === undefined) return { result: "not_configured", lastRun: null, lastSuccess: null };
  const lastRun = toRun(last);
  if (lastRun.result === "ok") return { result: "ok", lastRun, lastSuccess: lastRun };
  const [success] = await db.select().from(runs).where(eq(runs.result, "ok")).orderBy(desc(runs.startedAt), desc(runs.id)).limit(1);
  return { result: lastRun.result, lastRun, lastSuccess: success === undefined ? null : toRun(success) };
}

/** Seconds since the newest successful run finished; null when none ever succeeded. */
export function getLastSuccessAgeSeconds(status: BackupStatus, now: Date): number | null {
  if (status.lastSuccess === null) return null;
  return Math.max(0, Math.round((now.getTime() - status.lastSuccess.finishedAt.getTime()) / 1000));
}

export interface BackupMetricsOptions {
  readonly db: Queryable;
  /** The meter to register on; `metrics.getMeter("@softure-ai/backup")` by default. */
  readonly meter?: Meter;
  readonly now?: () => Date;
}

/**
 * Observable gauges over the newest runs, exported with the app's metrics (`startObservability`):
 * `softure.backup.last_success.age` (s, absent until a run succeeded; alert when above 93600, i.e. 26 h),
 * `softure.backup.last_run.ok` (1 or 0), `softure.backup.last_run.size` (By), `softure.backup.last_run.duration` (s).
 * Nothing is reported while no run is recorded. Returns a function that unregisters them.
 */
export function registerBackupMetrics(options: BackupMetricsOptions): () => void {
  const meter = options.meter ?? metrics.getMeter("@softure-ai/backup");
  const now = options.now ?? (() => new Date());
  const logger = createLogger("@softure-ai/backup");
  let cached: { at: number; status: BackupStatus } | null = null;
  const age = meter.createObservableGauge("softure.backup.last_success.age", { unit: "s", description: "Seconds since the newest successful off-site backup" });
  const okGauge = meter.createObservableGauge("softure.backup.last_run.ok", { description: "1 when the newest off-site backup run succeeded, else 0" });
  const size = meter.createObservableGauge("softure.backup.last_run.size", { unit: "By", description: "Encrypted bytes the newest off-site backup run uploaded" });
  const duration = meter.createObservableGauge("softure.backup.last_run.duration", { unit: "s", description: "Duration of the newest off-site backup run" });

  async function readStatus(): Promise<BackupStatus | null> {
    const at = now().getTime();
    if (cached !== null && at - cached.at < METRICS_CACHE_MS) return cached.status;
    try {
      const status = await getLastBackup(options.db);
      cached = { at, status };
      return status;
    } catch (error) {
      logger.warn("cannot read the off-site backup status", { error });
      return null;
    }
  }

  const callback = async (batch: { observe(gauge: typeof age, value: number): void }): Promise<void> => {
    const status = await readStatus();
    if (status?.lastRun == null) return;
    const ageSeconds = getLastSuccessAgeSeconds(status, now());
    if (ageSeconds !== null) batch.observe(age, ageSeconds);
    batch.observe(okGauge, status.lastRun.result === "ok" ? 1 : 0);
    batch.observe(size, status.lastRun.sizeBytes);
    batch.observe(duration, (status.lastRun.finishedAt.getTime() - status.lastRun.startedAt.getTime()) / 1000);
  };
  meter.addBatchObservableCallback(callback, [age, okGauge, size, duration]);
  return () => {
    meter.removeBatchObservableCallback(callback, [age, okGauge, size, duration]);
  };
}

/** For `GET /api/health` of `@softure-ai/ops`: the runs table exists and answers, i.e. `softure migrate` ran. */
export const checkRunsTable: HealthCheck = async (context) => {
  // Core types `db` as unknown; the health route passes the @softure-ai/db handle.
  const db = context.db as Queryable;
  await db.execute(sql`select 1 from backup.runs limit 0`);
  return ok();
};

