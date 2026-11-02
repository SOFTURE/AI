// The one line a recorded attempt leaves in the worker's log: codes and ids only, never a payload or an error's text.
// `logRuns` decides which outcomes are logged.
import type { JobsRunLogLevel } from "../options.js";
import { JOB_CANCELLED_CODE } from "../progress.js";
import type { JobRunSummary } from "../summary.js";
import type { JobsLogger } from "./logger.js";

interface RunLineBase {
  readonly queue: string;
  readonly jobId: string;
  readonly attempt: number;
}

/**
 * What ended: a success with its duration and summary, a failure that is retried at `runAt`, a terminal failure, or an
 * attempt an operator cancelled (logged like a success: `all` only, as `info`).
 */
export type RunEndLine =
  | (RunLineBase & { readonly outcome: "succeeded"; readonly origin: string; readonly durationMs: number; readonly summary: JobRunSummary | null })
  | (RunLineBase & { readonly outcome: "retried"; readonly code: string; readonly runAt: Date })
  | (RunLineBase & { readonly outcome: "failed"; readonly code: string })
  | (RunLineBase & { readonly outcome: "cancelled" });

/** Logs the end of one recorded attempt, unless `logRuns` leaves it out. */
export function logRunEnd(logger: JobsLogger, logRuns: JobsRunLogLevel, line: RunEndLine): void {
  if (logRuns === "none") return;
  const { queue, jobId, attempt } = line;
  if (line.outcome === "succeeded") {
    if (logRuns !== "all") return;
    const { summary } = line;
    logger.info("job run succeeded", {
      queue,
      jobId,
      attempt,
      origin: line.origin,
      durationMs: line.durationMs,
      ...(summary?.code === undefined ? {} : { code: summary.code }),
      ...(summary?.items === undefined ? {} : { items: summary.items }),
    });
    return;
  }
  if (line.outcome === "cancelled") {
    if (logRuns !== "all") return;
    logger.info("job run cancelled", { queue, jobId, attempt, code: JOB_CANCELLED_CODE });
    return;
  }
  if (line.outcome === "retried") {
    logger.warn("job run failed; retrying", { queue, jobId, attempt, code: line.code, runAt: line.runAt.toISOString() });
    return;
  }
  logger.error("job run failed", { queue, jobId, attempt, code: line.code });
}
