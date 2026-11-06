# Research: observability-non-error-reason-1142

## Current behaviour

- `describeError(error, details)` (`src/errors.ts`) is the only place that turns the `error` field into the
  `exception.*` attributes; `logger.ts` uses its `exception.message` as the console `error=` text for non-Error
  values and in label mode.
- A non-Error value gives `exception.type = exception.message = typeof value` in both modes; `null` gives `object`.
- The only test of the path (`tests/logger.test.ts`, "describes a thrown value that is not an Error by its type")
  pins the current output (`error=string`).
- `describeKind` / `readSafeCode` already describe a non-Error cause in label mode by its type and safe code.

## Options

1. Full mode: string as itself; number, boolean, bigint, symbol by `String(value)`; `undefined`/`null` by their
   name; an object by `JSON.stringify`, truncated, falling back to its kind and safe code when it cannot be
   serialized. Label mode: `non-Error <kind>[ code=<safe code>] (text|value withheld in label mode)`. Chosen.
2. A TypeScript overload that types `error` as `Error`: breaks callers that pass a caught `unknown`; rejected
   (the issue marks it optional).
3. A dev-time console warning: noisy in tests and scripts; the explicit withheld marker already says it; rejected.

## Sources

- Issue #1142; `foundation/observability/src/errors.ts`, `src/logger.ts`, README "Errors and personal data".
