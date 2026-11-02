// The table row as the module's `Job`: ids leave as strings (a bigint does not survive JSON), the claim token stays
// inside the package, a stored progress is checked again.
import type { Job } from "../contract.js";
import { jobProgressSchema } from "../progress.js";
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
    origin: row.origin,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
    progress: readProgress(row.progress),
    progressAt: row.progressAt,
    cancelRequestedAt: row.cancelRequestedAt,
  };
}

/** A stored progress, checked again on the way out; null when there is none or it does not match. */
function readProgress(value: unknown): Job["progress"] {
  if (value === null) return null;
  const parsed = jobProgressSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The bigint id of a job id string, or null when the string cannot be one (then no job has it). */
export function parseJobId(id: string): bigint | null {
  if (!JOB_ID.test(id)) return null;
  const value = BigInt(id);
  return value <= MAX_JOB_ID ? value : null;
}
