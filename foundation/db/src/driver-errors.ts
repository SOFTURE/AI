// The Postgres error behind a failed query. node-postgres and PGlite both put the SQLSTATE in `code` and the
// violated constraint's name in `constraint`; drizzle wraps that error as the `cause` of its own query error.
// App and module code that turns a known violation into a result (a taken slug, a conflicting row) reads it here.

/** How many `cause` links are followed: drizzle adds one, an app's own wrapper may add another. */
const MAX_CAUSE_DEPTH = 5;

export interface DriverError {
  /** The SQLSTATE, e.g. `23505` (unique violation) or `23P01` (exclusion violation). */
  readonly code: string;
  /** The violated constraint's name, when the error is about one. */
  readonly constraint: string | undefined;
  readonly message: string;
}

export interface ConstraintViolation {
  /** The SQLSTATE to match, e.g. `23505`. */
  readonly code: string;
  /** The constraint's name; when left out, any constraint (or none) matches. */
  readonly constraint?: string;
}

/** The driver error behind `error` (itself or one of its causes), or undefined when there is none. */
export function findDriverError(error: unknown): DriverError | undefined {
  for (let current: unknown = error, depth = 0; current instanceof Error && depth < MAX_CAUSE_DEPTH; current = current.cause, depth += 1) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (typeof code === "string") return { code, constraint: typeof constraint === "string" ? constraint : undefined, message: current.message };
  }
  return undefined;
}

/**
 * Whether `error` is the driver's `violation.code`, on `violation.constraint` when given:
 * `isConstraintViolation(error, { code: "23505", constraint: "articles_slug_key" })` for a taken slug.
 */
export function isConstraintViolation(error: unknown, violation: ConstraintViolation): boolean {
  const driverError = findDriverError(error);
  if (driverError?.code !== violation.code) return false;
  return violation.constraint === undefined || driverError.constraint === violation.constraint;
}
