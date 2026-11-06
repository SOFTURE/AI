# Implementation review: observability-non-error-reason-1142

Verdict: approved.

- The issue's done-when holds: a string `error` comes out with its text in `full` mode and with the explicit
  withheld marker in `label` mode (tests in `tests/logger.test.ts`), never as the bare `typeof`.
- `Error` values take the unchanged path in both modes; the existing label-mode tests still pass.
- Label mode logs only the kind, a class name that matches an identifier pattern, and a code that passes the
  existing safe-code rule; a test asserts that neither the string's text nor an object's other fields reach the
  console or the record.
- The full-mode description cannot throw (circular, BigInt fall back to the kind) and is capped at 1000 characters.
- A non-Error cause in label mode now reads `cause=null` instead of `cause=object` for `null`, and an object cause
  carries its class name: still no free text.
