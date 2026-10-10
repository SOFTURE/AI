import { errorLogLabel } from "@softure-ai/core";

/**
 * How much of an error reaches the logs: `full` keeps its message and stack, `label` keeps only the kind of error
 * (`errorLogLabel` of `@softure-ai/core`), for apps whose error messages can carry personal data.
 */
export type ErrorDetails = "full" | "label";

/** The OpenTelemetry `exception.*` attributes of a thrown value. */
export type ExceptionAttributes = {
  "exception.type": string;
  "exception.message": string;
  "exception.stacktrace"?: string;
};

export function describeError(error: unknown, details: ErrorDetails): ExceptionAttributes {
  if (!(error instanceof Error)) {
    return { "exception.type": typeof error, "exception.message": typeof error };
  }

  if (details === "label") {
    return { "exception.type": error.name, "exception.message": errorLogLabel(error) };
  }

  return error.stack === undefined
    ? { "exception.type": error.name, "exception.message": error.message }
    : { "exception.type": error.name, "exception.message": error.message, "exception.stacktrace": error.stack };
}
