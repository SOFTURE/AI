// Result types of the ops module. No user-facing copy here: an admin view translates the states
// through `messages` (docs/02-module-standard.md §6).

/** The outcome of one check: passed, returned an `Err` or threw, or ran past its time limit. */
export type HealthCheckState = "ok" | "failed" | "timed_out";

/** `ok` only when every check is `ok`. */
export type HealthStatus = "ok" | "unavailable";

export interface HealthReport {
  readonly status: HealthStatus;
  /** Every check by name, in the order they ran: `database` first, then modules, then the app's. */
  readonly checks: Readonly<Record<string, HealthCheckState>>;
}
