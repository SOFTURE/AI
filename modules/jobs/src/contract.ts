// Result types and error codes of the jobs module. No user-facing copy here: the UI translates codes through
// `messages` (docs/02-module-standard.md §6).
import type { Err, ErrorCode } from "@softure-ai/core";

export type JobsErrorCode =
  | "jobs.invalid_payload"
  | "jobs.handler_threw"
  | "jobs.lease_expired"
  | "jobs.not_found"
  | "jobs.not_cancellable"
  | "jobs.not_retryable"
  | "jobs.dedup_key_taken"
  | "jobs.sync_cursor_moved"
  | "jobs.sync_item_threw";

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
  /** The error code of the last failed attempt. */
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly finishedAt: Date | null;
}

/**
 * A handler's failure. Retried with the queue's backoff unless `retry` is false or the attempts are used up;
 * `retryAfterSeconds` replaces the backoff delay for this attempt (a provider's `Retry-After`).
 */
export type JobFailure = Err<ErrorCode> & {
  readonly retry?: boolean;
  readonly retryAfterSeconds?: number;
};

/** What happened to a job after one attempt. */
export type JobOutcome =
  | { readonly kind: "succeeded" }
  | { readonly kind: "retried"; readonly error: string; readonly runAt: Date }
  | { readonly kind: "failed"; readonly error: string }
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
