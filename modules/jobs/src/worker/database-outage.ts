// How the worker logs a database failure: while the database has been unavailable for less than the tolerance (a
// restart, a host reboot), the line is `info`; once the outage lasts, or for any other failure, it is `error`.
import type { Clock } from "@softure-ai/core";
import { isDatabaseUnavailableError } from "../server/database-unavailable.js";
import type { JobsLogFields, JobsLogger } from "../server/logger.js";

export interface DatabaseOutage {
  /** Logs a failed database call; true when the failure means the database is unavailable. */
  fail(message: string, fields: JobsLogFields & { readonly error: unknown }): boolean;
  /** After a database call that succeeded: ends an outage in progress with one `info` line. */
  recover(): void;
}

export function createDatabaseOutage(options: { clock: Clock; logger: JobsLogger; toleranceMs: number }): DatabaseOutage {
  let startedAt: number | undefined;
  return {
    fail: (message, fields) => {
      if (!isDatabaseUnavailableError(fields.error)) {
        options.logger.error(message, fields);
        return false;
      }
      const now = options.clock.now().getTime();
      startedAt ??= now;
      const outageMs = now - startedAt;
      const line = { ...fields, outageMs };
      if (outageMs < options.toleranceMs) options.logger.info(message, line);
      else options.logger.error(message, line);
      return true;
    },
    recover: () => {
      if (startedAt === undefined) return;
      const outageMs = options.clock.now().getTime() - startedAt;
      startedAt = undefined;
      options.logger.info("database reachable again", { outageMs });
    },
  };
}
