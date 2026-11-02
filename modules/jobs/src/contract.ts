// Result types and error codes of the jobs module. No user-facing copy here: the UI translates codes through
// `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode, Err, ErrorCode } from "@softure-ai/core";
import type { JobProgress } from "./progress.js";
import type { JobRunSummary } from "./summary.js";

export type JobsErrorCode =
  | "jobs.invalid_payload"
  | "jobs.handler_threw"
  | "jobs.lease_expired"
  | "jobs.not_found"
  | "jobs.not_cancellable"
  | "jobs.cancelled"
  | "jobs.not_retryable"
  | "jobs.dedup_key_taken"
  | "jobs.sync_cursor_moved"
  | "jobs.sync_item_threw"
  | "jobs.not_a_schedule"
  | "jobs.sync_item_not_found"
  | "jobs.sync_item_not_retryable"
  | "jobs.unknown_queue";

export const JOB_STATUSES = ["pending", "running", "succeeded", "failed", "cancelled"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** One job as the module's functions return it. */
export interface Job {
  readonly id: string;
  readonly queue: string;
  readonly payload: unknown;
  readonly status: JobStatus;
  /** Claims so far; the running attempt's number while `running`. */
  readonly attempts: number;
  readonly maxAttempts: number;
  /** When a pending job is due. */
  readonly runAt: Date;
  readonly lockedUntil: Date | null;
  readonly lockedBy: string | null;
  readonly dedupKey: string | null;
  /** What enqueued the job: `app` (default of `enqueueJob`), `schedule`, `manual` (`runScheduleNow`) or the app's own. */
  readonly origin: string;
  /** The error code of the last failed attempt. */
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly finishedAt: Date | null;
  /** The newest progress the running attempt reported (`context.reportProgress`); a new attempt starts without one. */
  readonly progress: JobProgress | null;
  /** When `progress` was written. */
  readonly progressAt: Date | null;
  /** When an operator asked the running job to stop (`requestJobCancel`); kept once the job is `cancelled`. */
  readonly cancelRequestedAt: Date | null;
}

export const JOB_RUN_OUTCOMES = ["succeeded", "retried", "failed", "cancelled"] as const;

/**
 * How a recorded attempt ended: `retried` is a failed attempt with attempts left; `cancelled` an attempt an operator
 * stopped (`requestJobCancel`).
 */
export type JobRunOutcome = (typeof JOB_RUN_OUTCOMES)[number];

/** One recorded attempt of a job, kept for `retention.runsDays` whatever happens to the job. */
export interface JobRun {
  readonly id: string;
  /** The job's id; the job itself may have been pruned. */
  readonly jobId: string;
  readonly queue: string;
  readonly origin: string;
  /** The attempt's number, starting at 1. */
  readonly attempt: number;
  readonly outcome: JobRunOutcome;
  /** The failure's code; null for a success. */
  readonly errorCode: string | null;
  /** The handler's summary; null when it returned none (or an invalid one), and for a failure. */
  readonly summary: JobRunSummary | null;
  /** Null when unknown: a lease that ended with no attempts left. */
  readonly startedAt: Date | null;
  readonly finishedAt: Date;
}

/**
 * A handler's failure. Retried with the queue's backoff unless `retry` is false or the attempts are used up;
 * `retryAfterSeconds` replaces the backoff delay for this attempt (a provider's `Retry-After`).
 */
export type JobFailure = Err<ErrorCode> & {
  readonly retry?: boolean;
  readonly retryAfterSeconds?: number;
  /**
   * `pauseQueueLater`: the service refused; the queue pauses for this many seconds and the job gets its attempt back,
   * due when the pause ends.
   */
  readonly pauseQueueSeconds?: number;
};

/** What happened to a job after one attempt. */
export type JobOutcome =
  | { readonly kind: "succeeded" }
  | { readonly kind: "retried"; readonly error: string; readonly runAt: Date }
  | { readonly kind: "failed"; readonly error: string }
  /** The handler returned `pauseQueueLater`: the queue paused and the job, its attempt given back, is due at `runAt`. */
  | { readonly kind: "paused"; readonly error: string; readonly runAt: Date }
  /** An operator cancelled the running job; it is `cancelled` and not retried. */
  | { readonly kind: "cancelled" }
  /** The job was taken over (lease ended) or released before the attempt finished; nothing was recorded. */
  | { readonly kind: "stale" };

/** What `onJobFailed` receives: codes and ids only, never the payload or an error's text. */
export interface JobFailedEvent {
  readonly queue: string;
  readonly jobId: string;
  /** The job's `last_error`: the handler's code, `jobs.handler_threw`, `jobs.invalid_payload`, `jobs.lease_expired`… */
  readonly code: string;
  /** Attempts the job used. */
  readonly attempts: number;
  readonly at: Date;
}

/** Who paused a queue: its circuit breaker, a handler (`pauseQueueLater`) or an operator (`pauseQueue`). */
export type QueuePauseSource = "breaker" | "handler" | "operator";

/** A queue's active pause: a paused queue claims nothing, and its jobs keep their attempts. */
export interface QueuePause {
  readonly source: QueuePauseSource;
  /** The failure's code, or the operator's reason. */
  readonly reason: string;
  /** When the queue runs again; null for an operator's pause until `resumeQueue`. */
  readonly until: Date | null;
}

/** What `onQueuePaused` receives, once per pause by the breaker or a handler. */
export interface QueuePausedEvent {
  readonly queue: string;
  /** The code of the failure that paused the queue. */
  readonly code: string;
  readonly until: Date;
  readonly source: "breaker" | "handler";
  readonly at: Date;
}

/** A schedule's health as `onScheduleStateChanged` reports it; `failing` wins over `late` when both hold. */
export type ScheduleHealth = "healthy" | "failing" | "late";

/** What `onScheduleStateChanged` receives, once per transition. */
export interface ScheduleStateChangedEvent {
  readonly queue: string;
  readonly state: ScheduleHealth;
  /** The code of the queue's last terminal failure; null when none has failed. */
  readonly lastFailureCode: string | null;
  readonly at: Date;
}

/** What an action of the admin page can answer with: a module code, the role check's refusal, or a safe failure. */
export type JobsFormErrorCode = JobsErrorCode | "auth.forbidden" | CoreErrorCode;

/** The state of one form of the admin page (`useActionState`). `notice` tells a new run from a joined one. */
export interface JobsFormState {
  readonly status: "idle" | "ok" | "error";
  readonly error?: JobsFormErrorCode;
  readonly notice?: "run_enqueued" | "run_joined";
}
