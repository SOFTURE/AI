// Result types and error codes of the security module. No user-facing copy here: the UI translates
// codes through `messages` (docs/02-module-standard.md §6).
import type { Err } from "@softure-ai/core";

export type SecurityErrorCode =
  | "security.rate_limited"
  | "security.client_unidentified"
  | "security.body_too_large"
  | "security.body_unreadable";

/** A consumed attempt that fits in the bucket's window. */
export interface RateLimitAllowance {
  /** Attempts left in the current window after this one; 0 means the next one is rejected. */
  readonly remaining: number;
  /** When the current window ends and the counter starts again. */
  readonly resetAt: Date;
}

/** An attempt over the limit. The caller refuses the work and may send `Retry-After`. */
export interface RateLimitRejection extends Err<"security.rate_limited"> {
  /** Whole seconds until the window ends, at least 1. */
  readonly retryAfterSeconds: number;
  readonly resetAt: Date;
}
