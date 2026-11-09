// The status of a run as one SQL file for psql: the host run cannot always connect to the database itself
// (database.access "compose-exec" publishes no port), but deploy.sh can always pipe a file into psql in the postgres
// service. Values are literals quoted here (no psql variables, no server-side parameters), each checked first.
import type { RunRecord } from "./upload.js";

/** Rows of `backup.runs` older than this before the newest run are removed with it: a year and a month of history. */
export const STATUS_RETENTION_DAYS = 400;
const MAX_ERROR_MESSAGE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A standard SQL string literal (`standard_conforming_strings` is on since Postgres 9.1); NUL is dropped. */
export function quoteLiteral(text: string): string {
  return `'${text.replace(/\0/g, "").replace(/'/g, "''")}'`;
}

function quoteTime(date: Date): string {
  return `${quoteLiteral(date.toISOString())}::timestamptz`;
}

/** The time before which `backup.runs` rows are pruned when a run that started at `startedAt` is recorded. */
export function getPruneBefore(startedAt: Date): Date {
  return new Date(startedAt.getTime() - STATUS_RETENTION_DAYS * DAY_MS);
}

/** One transaction: the run's row, then the prune of rows older than the retention. */
export function buildStatusSql(record: RunRecord): string {
  const objects = JSON.stringify(record.objects.map(({ kind, key, bytes, sha256 }) => ({ kind, key, bytes, sha256 })));
  const error = record.error;
  const values = [
    quoteTime(record.startedAt),
    quoteTime(record.finishedAt),
    quoteLiteral(record.result),
    `${quoteLiteral(objects)}::jsonb`,
    String(Math.max(0, Math.trunc(record.sizeBytes))),
    error === null ? "NULL" : quoteLiteral(error.code),
    error === null ? "NULL" : quoteLiteral(error.message.slice(0, MAX_ERROR_MESSAGE)),
  ];
  return [
    "BEGIN;",
    `INSERT INTO backup.runs (started_at, finished_at, result, objects, size_bytes, error_code, error_message) VALUES (${values.join(", ")});`,
    `DELETE FROM backup.runs WHERE started_at < ${quoteTime(getPruneBefore(record.startedAt))};`,
    "COMMIT;",
    "",
  ].join("\n");
}
