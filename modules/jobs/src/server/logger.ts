// Where the module reports what the worker does. The shape is a subset of `@softure-ai/observability`'s `Logger`, so
// an app passes `createLogger("jobs")` as it is; without one, lines go to the console.
import { errorLogLabel } from "@softure-ai/core";

export type JobsLogFields = Readonly<Record<string, unknown>> & { readonly error?: unknown };

export interface JobsLogger {
  info(message: string, fields?: JobsLogFields): void;
  warn(message: string, fields?: JobsLogFields): void;
  error(message: string, fields?: JobsLogFields): void;
}

const PREFIX = "@softure-ai/jobs:";

/** One line per call; an `error` field is reduced to its log label, so no query parameter or payload is printed. */
export const consoleJobsLogger: JobsLogger = {
  info: (message, fields) => console.log(formatLine(message, fields)),
  warn: (message, fields) => console.warn(formatLine(message, fields)),
  error: (message, fields) => console.error(formatLine(message, fields)),
};

function formatLine(message: string, fields: JobsLogFields | undefined): string {
  if (fields === undefined) return `${PREFIX} ${message}`;
  const { error, ...rest } = fields;
  const parts = Object.entries(rest).map(([key, value]) => `${key}=${formatValue(value)}`);
  if (error !== undefined) parts.push(`error=${errorLogLabel(error)}`);
  return parts.length === 0 ? `${PREFIX} ${message}` : `${PREFIX} ${message} ${parts.join(" ")}`;
}

function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}
