# Plan: observability-non-error-reason-1142

## Phases

1. Tests first in `foundation/observability/tests/logger.test.ts`: full mode logs a string `error` as its text
   (console `error=<text>`, `exception.type: "string"`, `exception.message: <text>`); a number, `null`,
   `undefined`, a plain object (JSON), a long object (truncated to 1000 characters with `…`), a circular object
   (kind and safe code) and a class instance (`exception.type` is its class name). Label mode: a string gives
   `non-Error string (text withheld in label mode)` and an object with a safe code gives
   `non-Error object code=ECONNREFUSED (value withheld in label mode)`, never the text. The old typeof test goes.
2. `describeError` in `src/errors.ts`: a `describeNonError(value, details)` that implements the above. The kind
   is `string`, `number`, …, `null`, or for an object its constructor name when it is not `Object` (else `object`).
3. Docs and release: README ("Errors and personal data": non-Error values in both modes, the attribute route),
   CHANGELOG, `npm run release:version -- observability patch` (0.8.2).

## Acceptance

- The issue's done-when: a logger test shows a string `error` with its text in `full` mode and the explicit
  withheld marker in `label` mode, never the bare `typeof`.
- Gates: typecheck, lint (language gate included), observability tests, build.

## Decisions (auto)

- Patch bump 0.8.2: a fix of what the logger records; no API change.
- No TypeScript overload and no dev-time warning (research options 2 and 3).
- Full-mode text of a non-Error value is capped at 1000 characters, like a bounded attribute.
- Label-mode kind uses the class name of an object (safe, like `Error.name`) and the existing safe-code rule.

## Progress

- [x] p1 tests first in `tests/logger.test.ts`: `npx vitest run foundation/observability/tests/logger.test.ts`, 4 failed
- [x] p2 `describeNonError` and `readKind` in `src/errors.ts`; `npx vitest run foundation/observability` 165 passed,
  `npm run typecheck` and `npx eslint foundation/observability --max-warnings 0` clean
- [x] p3 README ("Errors and personal data"), CHANGELOG, `npm run release:version -- observability patch` (0.8.2)
