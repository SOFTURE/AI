import type { AttributeValue } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";

import { describeError, type ErrorDetails } from "./errors.js";
import { isLevelEnabled, parseLogLevel, SEVERITY_NUMBERS, type LogLevel } from "./levels.js";

/**
 * Attributes of one log call. `error` is the thrown value, recorded as `exception.*`; every other value that is a
 * string, number, boolean or an array of them becomes an attribute (`undefined` and `null` are skipped, a `Date`
 * becomes its ISO string, anything else its `String()`).
 */
export type LogFields = Readonly<Record<string, unknown>> & { readonly error?: unknown };

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger with the same name whose records carry these attributes too; the child's own fields win. */
  child(attributes: LogFields): Logger;
}

export type LoggerOptions = {
  /** Minimum level of this logger; wins over `configureLogging` and `SOFTURE_LOG_LEVEL`. */
  level?: LogLevel;
};

export type LoggingDefaults = {
  /** Minimum level of every logger without its own; wins over `SOFTURE_LOG_LEVEL`. Default `info`. */
  level?: LogLevel;
  /** Default `full`. */
  errorDetails?: ErrorDetails;
};

type Attributes = Record<string, AttributeValue>;

// On globalThis, so two copies of the package in one process (a bundle next to node_modules) share the defaults.
const DEFAULTS_KEY = Symbol.for("softure.observability.logging");

type GlobalWithDefaults = typeof globalThis & { [DEFAULTS_KEY]?: LoggingDefaults };

function readDefaults(): LoggingDefaults {
  return (globalThis as GlobalWithDefaults)[DEFAULTS_KEY] ?? {};
}

/** Sets the defaults for every logger in the process; later calls merge into earlier ones. */
export function configureLogging(defaults: LoggingDefaults): void {
  (globalThis as GlobalWithDefaults)[DEFAULTS_KEY] = { ...readDefaults(), ...defaults };
}

/** Clears `configureLogging`; tests only. */
export function resetLoggingForTests(): void {
  delete (globalThis as GlobalWithDefaults)[DEFAULTS_KEY];
}

/**
 * A logger named after the part of the app that logs (it becomes the OpenTelemetry instrumentation scope). It writes
 * one line to the console and, when the process registered a logger provider (`startObservability`), an
 * OpenTelemetry log record that carries the active trace and span ids.
 */
export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  return buildLogger(name, options, {});
}

function buildLogger(name: string, options: LoggerOptions, inherited: Attributes): Logger {
  const write = (level: LogLevel, message: string, fields: LogFields | undefined): void => {
    if (!isLevelEnabled(level, resolveLevel(options))) {
      return;
    }

    const defaults = readDefaults();
    const attributes = { ...inherited, ...toAttributes(fields) };
    const hasError = fields !== undefined && "error" in fields;
    const details = defaults.errorDetails ?? "full";
    const exception = hasError ? describeError(fields.error, details) : undefined;
    const errorText =
      exception === undefined || details === "label" || !(fields?.error instanceof Error)
        ? exception?.["exception.message"]
        : `${exception["exception.type"]}: ${exception["exception.message"]}`;

    writeConsole(level, formatLine(level, name, message, attributes, errorText), exception);

    logs.getLogger(name).emit({
      severityNumber: SEVERITY_NUMBERS[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: exception === undefined ? attributes : { ...attributes, ...exception },
    });
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (attributes) => buildLogger(name, options, { ...inherited, ...toAttributes(attributes) }),
  };
}

function resolveLevel(options: LoggerOptions): LogLevel {
  return options.level ?? readDefaults().level ?? parseLogLevel(process.env.SOFTURE_LOG_LEVEL) ?? "info";
}

function toAttributes(fields: LogFields | undefined): Attributes {
  const attributes: Attributes = {};
  if (fields === undefined) {
    return attributes;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (key === "error") {
      continue;
    }
    const attribute = toAttributeValue(value);
    if (attribute !== undefined) {
      attributes[key] = attribute;
    }
  }
  return attributes;
}

function toAttributeValue(value: unknown): AttributeValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (isStringArray(value) || isNumberArray(value) || isBooleanArray(value)) {
    return value;
  }
  return describeValue(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isBooleanArray(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === "boolean");
}

// Objects become JSON; what JSON cannot write (a function, a symbol, a cycle) becomes its type.
function describeValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? typeof value;
  } catch {
    return typeof value;
  }
}

function formatLine(
  level: LogLevel,
  name: string,
  message: string,
  attributes: Attributes,
  errorText: string | undefined,
): string {
  const parts = [`${level} ${name}: ${message}`];
  for (const [key, value] of Object.entries(attributes)) {
    parts.push(`${key}=${formatValue(value)}`);
  }
  if (errorText !== undefined) {
    parts.push(`error=${errorText}`);
  }
  return parts.join(" ");
}

function formatValue(value: AttributeValue): string {
  const text = Array.isArray(value) ? value.join(",") : String(value);
  return /\s|"/.test(text) ? JSON.stringify(text) : text;
}

function writeConsole(
  level: LogLevel,
  line: string,
  exception: { "exception.type": string; "exception.stacktrace"?: string } | undefined,
): void {
  const print = level === "warn" || level === "error" ? console.error : console.log;
  print(line);
  if (exception?.["exception.stacktrace"] !== undefined) {
    print(exception["exception.stacktrace"]);
  }
}
