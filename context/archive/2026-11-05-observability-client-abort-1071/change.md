---
change_id: observability-client-abort-1071
title: "observability/next: log a client's aborted request below error in createOnRequestError (issue #1071)"
status: archived
roadmap_item: null
issue: 1071
branch: claude/project-thread-j1upra
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Close [issue #1071](https://github.com/SOFTURE/AI/issues/1071): `createOnRequestError` logs every error Next.js
hands to `onRequestError` as `error("request failed")`, including a client that closed the connection before the
response finished (`Error("The destination stream closed early.")`). The app worked, but an alert that counts
`ERROR` records fires while a user taps quickly.

## Context

Labels: bug, pkg: observability (found in an adopting app on Next.js 16.3). `@softure-ai/observability` 0.6.0. No
version bump: the coordinator's release thread ships it.

## Scope

- `createOnRequestError` recognises a client's abort and logs `info("request aborted by the client", { …the request
  fields, outcome: "client_aborted" })`: the exact message `The destination stream closed early.`,
  `code === "ERR_STREAM_PREMATURE_CLOSE"`, `name === "ResponseAborted"`, and Node's `aborted` with `ECONNRESET`.
- Every other error stays `error("request failed")` with its stack.
- An option lets an app extend or turn off the recognition.
- README and CHANGELOG `## Unreleased`.

## Constraints

- Owns `foundation/observability` (the `next` entry) only.

## Notes

- Framing: skipped. The issue states the problem, the evidence and the proposal.

## Done

`createOnRequestError` logs a client's aborted request (React's `The destination stream closed early.`,
`ERR_STREAM_PREMATURE_CLOSE`, `ResponseAborted`, Node's `aborted` with `ECONNRESET`) as one `info` record "request
aborted by the client" with the request fields and `outcome: "client_aborted"`, no exception; every other error
stays `error`. `createOnRequestError(logger, { isClientAbort })` and the exported `isClientAbortError` let an app
extend or turn it off. Tests in `foundation/observability/tests/next.test.ts`; README `Next.js`, CHANGELOG
`## Unreleased`. Ships with the next observability release.
