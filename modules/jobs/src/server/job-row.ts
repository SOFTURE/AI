// The table row as the module's `Job`: ids leave as strings (a bigint does not survive JSON), the claim token stays
// inside the package.
import type { Job } from "../contract.js";
import type { JobRow } from "../schema.js";

const JOB_ID = /^[1-9][0-9]{0,18}$/;
const MAX_JOB_ID = 9_223_372_036_854_775_807n;

export function toJob(row: JobRow): Job {
  return {
    id: row.id.toString(),
    queue: row.queue,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
    lockedUntil: row.lockedUntil,
    lockedBy: row.lockedBy,
    dedupKey: row.dedupKey,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  };
}

/** The bigint id of a job id string, or null when the string cannot be one (then no job has it). */
export function parseJobId(id: string): bigint | null {
  if (!JOB_ID.test(id)) return null;
  const value = BigInt(id);
  return value <= MAX_JOB_ID ? value : null;
}
