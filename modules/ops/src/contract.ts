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

/**
 * Which build answers: `GET` of the build info route (`createBuildInfoRoute` from `@softure-ai/ops/next`). Only the
 * build, never user data. `null` is a value the build or the container did not set.
 */
export interface BuildInfo {
  /** The release tag from the container's environment (`SOFTURE_RELEASE`), read on every request. */
  readonly release: string | null;
  /** The commit the build was made from (`SOFTURE_BUILD_COMMIT`, inlined at build by `withBuildInfo`). */
  readonly commit: string | null;
  /** When the build ran, ISO 8601 (`SOFTURE_BUILD_TIME`, inlined at build by `withBuildInfo`). */
  readonly builtAt: string | null;
  /** When this process started, ISO 8601: a deploy starts a fresh container, so it is the deploy's time. */
  readonly startedAt: string;
}
