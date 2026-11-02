// The progress a running handler reports with `context.reportProgress`: codes and counts only, like the run summary, so
// the jobs table never holds the app's data. The module checks it before writing; an invalid one is dropped with a
// warning, never failing the job.
import { z } from "zod";

/** A step or result code such as `render.encode`; the same shape as a queue name. */
const CODE = /^[a-z][a-z0-9_.-]{0,62}$/;

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const jobProgressSchema = z.strictObject({
  /** The step the handler is in, as a code: `import.fetch`, `render.encode`. */
  step: z.string().regex(CODE),
  /** Units of the step done so far. */
  done: count.optional(),
  /** Units the step has in all, when known. */
  total: count.optional(),
  /** A finer state of the step, as a code. */
  code: z.string().regex(CODE).optional(),
});

/** A running job's progress: `reportProgress({ step: "render.encode", done: 3, total: 10 })`. */
export type JobProgress = z.output<typeof jobProgressSchema>;

/** The `code` a cancelled attempt records and the abort reason's code. */
export const JOB_CANCELLED_CODE = "jobs.cancelled";

/**
 * The reason `context.signal` aborts with when an operator cancelled the running job (`requestJobCancel`). Named
 * `AbortError`, so libraries that treat an abort as such do so here too.
 */
export class JobCancelledError extends Error {
  readonly code = JOB_CANCELLED_CODE;

  constructor() {
    super("The job was cancelled");
    this.name = "AbortError";
  }
}

/** True when `signal` aborted because the job was cancelled, not because the worker stopped or lost the lease. */
export function isJobCancelled(signal: AbortSignal): boolean {
  return signal.aborted && signal.reason instanceof JobCancelledError;
}
