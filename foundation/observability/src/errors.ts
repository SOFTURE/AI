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
const MAX_NON_ERROR_TEXT = 1000;

export function describeError(error: unknown, details: ErrorDetails): ExceptionAttributes {
  if (!(error instanceof Error)) {
    return describeNonError(error, details);
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
 * A logged value that is not an `Error` (a string reason, a result value, a plain object). `full` keeps its text: a
 * string as itself, a primitive as `String(value)`, an object as its JSON, capped at 1000 characters, or as its kind
 * and safe code when it cannot be serialized. `label` keeps no text and says so:
 * `non-Error string (text withheld in label mode)`.
 */
function describeNonError(value: unknown, details: ErrorDetails): ExceptionAttributes {
  const kind = readKind(value);
  if (details === "label") {
    const withheld = typeof value === "string" ? "text" : "value";
    return {
      "exception.type": kind,
      "exception.message": `non-Error ${describeKind(value)} (${withheld} withheld in label mode)`,
    };
  }
  return { "exception.type": kind, "exception.message": truncate(describeNonErrorText(value)) };
}

function describeNonErrorText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object" || value === null) {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : describeKind(value);
  } catch {
    // A circular structure or a BigInt cannot be serialized; the kind and safe code still name the failure.
    return describeKind(value);
  }
}

function truncate(text: string): string {
  return text.length > MAX_NON_ERROR_TEXT ? `${text.slice(0, MAX_NON_ERROR_TEXT - 1)}…` : text;
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
  const name = value instanceof Error ? value.name : readKind(value);
  const code = readSafeCode(value);
  return code === null ? name : `${name} code=${code}`;
}

/**
 * The type of a value that is not an `Error`: `string`, `number`, …, `null`, or for an object the name of its class
 * when it has one other than `Object` (a class name, like an error's name, carries no free text).
 */
function readKind(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value !== "object") {
    return typeof value;
  }
  const constructorName: unknown = (value as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof constructorName === "string" && constructorName !== "Object" && /^[A-Za-z_$][\w$]{0,63}$/.test(constructorName)
    ? constructorName
    : "object";
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
 * when there are none), one per line, without the `<name>: <message>` header. `null` when the stack does not start
 * with the error's own header: its message changed after the stack was taken, and the text after it could be part of
 * a message.
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
