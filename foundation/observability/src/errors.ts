/**
 * How much of an error reaches the logs: `full` keeps its message and stack, `label` keeps only what identifies the
 * error without its text: the kind of error and its causes with their safe codes, and the top frames of the app.
 * For apps whose error messages can carry personal data.
 */
export type ErrorDetails = "full" | "label";

/** The OpenTelemetry `exception.*` attributes of a thrown value. */
export type ExceptionAttributes = {
  "exception.type": string;
  "exception.message": string;
  "exception.stacktrace"?: string;
};

const MAX_CAUSES = 3;
const MAX_FRAMES = 2;

export function describeError(error: unknown, details: ErrorDetails): ExceptionAttributes {
  if (!(error instanceof Error)) {
    return { "exception.type": typeof error, "exception.message": typeof error };
  }

  if (details === "label") {
    const frames = readAppFrames(error);
    return frames === null
      ? { "exception.type": error.name, "exception.message": describeErrorLabel(error) }
      : { "exception.type": error.name, "exception.message": describeErrorLabel(error), "exception.stacktrace": frames };
  }

  return error.stack === undefined
    ? { "exception.type": error.name, "exception.message": error.message }
    : { "exception.type": error.name, "exception.message": error.message, "exception.stacktrace": error.stack };
}

/**
 * The kind of an error and of its causes, never their text: `Error code=ETIMEDOUT cause=DatabaseError code=57P01`.
 */
function describeErrorLabel(error: Error): string {
  const parts = [describeKind(error)];
  let cause: unknown = error.cause;
  for (let depth = 0; depth < MAX_CAUSES && cause !== undefined; depth += 1) {
    parts.push(`cause=${describeKind(cause)}`);
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return parts.join(" ");
}

function describeKind(value: unknown): string {
  const name = value instanceof Error ? value.name : typeof value;
  const code = readSafeCode(value);
  return code === null ? name : `${name} code=${code}`;
}

/**
 * A code that names a kind of failure and cannot carry free text: a SQLSTATE (`23505`), a Node system code
 * (`ECONNREFUSED`), an undici code (`UND_ERR_CONNECT_TIMEOUT`), or an integer error number. Anything else is `null`.
 */
function readSafeCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return null;
  }

  const code = value.code;
  if (typeof code === "number") {
    return Number.isSafeInteger(code) ? String(code) : null;
  }
  return typeof code === "string" && /^[0-9A-Z][0-9A-Z_]{1,63}$/.test(code) ? code : null;
}

/**
 * The first frames of the app (outside `node_modules`, Node's internals and frames without a file; the first frames
 * when there are none), one per line, without the `<name>: <message>` header. `null` when the stack does not start with the error's own
 * header: its message changed after the stack was taken, and the text after it could be part of a message.
 */
function readAppFrames(error: Error): string | null {
  const stack = error.stack;
  const header = error.message === "" ? error.name : `${error.name}: ${error.message}`;
  if (stack === undefined || !stack.startsWith(`${header}\n`)) {
    return null;
  }

  const frames = stack
    .slice(header.length + 1)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "));
  const appFrames = frames.filter(
    (frame) => !frame.includes("node_modules") && !/[( ]node:/.test(frame) && !/\((?:<anonymous>|native)\)$/.test(frame),
  );
  const chosen = (appFrames.length > 0 ? appFrames : frames).slice(0, MAX_FRAMES);
  return chosen.length === 0 ? null : chosen.join("\n");
}
