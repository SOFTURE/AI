// The delay before the next attempt: exponential from the queue's base, capped at its maximum, shortened by up to a
// fifth at random so jobs that failed together (a provider outage) do not all come back in the same second.
import type { JobQueueOptions } from "../options.js";

const JITTER = 0.2;
const MAX_RETRY_SECONDS = 7 * 24 * 60 * 60;

/** Seconds to wait after attempt number `attempt` (1-based) failed; `random` returns a number in [0, 1). */
export function getRetryDelaySeconds(backoff: JobQueueOptions["backoff"], attempt: number, random: () => number): number {
  const exponent = Math.min(Math.max(attempt - 1, 0), 30);
  const raw = Math.min(backoff.maxSeconds, backoff.baseSeconds * 2 ** exponent);
  return raw * (1 - JITTER * clampUnit(random()));
}

/** A handler's own delay (`retryJobLater`), kept within a week. */
export function clampRetrySeconds(seconds: number): number {
  return Math.min(Math.max(seconds, 0), MAX_RETRY_SECONDS);
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}
