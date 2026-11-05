---
change_id: observability-client-abort-1071
status: archived
---

# Plan: client aborts below error (issue #1071)

Input: change.md, research.md. Complexity: small (one function, its tests, docs).

## Phase 1: recognise a client's abort (TDD)

Files: `foundation/observability/src/next/index.ts`, `foundation/observability/tests/next.test.ts`.

- Export `isClientAbortError(error: unknown): boolean`: an object whose `message` is exactly `The destination stream
  closed early.`, or whose `code` is `ERR_STREAM_PREMATURE_CLOSE`, or whose `name` is `ResponseAborted`, or whose
  `message` is `aborted` with `code` `ECONNRESET`.
- `createOnRequestError(logger, options?)`, `options.isClientAbort?: (error: unknown) => boolean` (default
  `isClientAbortError`). An abort logs `info("request aborted by the client", { …the same request fields, outcome:
  "client_aborted" })` without the error (no stack); everything else stays `error("request failed")` unchanged.
- Tests first: each of the four shapes logs one `INFO` record with the request fields and `outcome`, no `ERROR`; an
  error whose message only contains the phrase, and one that shares the digest, stay `ERROR` with the stack; a
  custom predicate extends it; `() => false` turns it off.

## Phase 2: docs

README `onRequestError` bullet, CHANGELOG `## Unreleased`.

## Decisions (auto)

- Option 1 of research.md: one predicate option, no level option.
- The abort record carries no `exception.*`: the stack is React's stream listener and says nothing about the app.
- Exact message match only, so an app's own error that mentions the phrase stays an error.
- No version bump: the coordinator's release thread ships it.

## Progress

- [x] Phase 1: recognise a client's abort
- [x] Phase 2: README and CHANGELOG
- [x] Implementation review: approved
