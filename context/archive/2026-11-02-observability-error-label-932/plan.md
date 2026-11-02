---
change_id: observability-error-label-932
status: archived
---

# Plan: identifiable errors in label mode (issue #932)

Input: change.md, research.md (option 2). Complexity: small (one package).

## Phase 1: label, frames, digest (TDD)

Files: `foundation/observability/src/errors.ts`, `src/next/index.ts`, `tests/logger.test.ts`, `tests/next.test.ts`,
`package.json` (drop `@softure-ai/core`, now unused), `package-lock.json`.

- Label: `<name>[ code=<code>]` then up to three ` cause=<name>[ code=<code>]` for `error.cause` and its causes; a
  cause that is not an Error is its `typeof`. A code is safe when it is a string of `[0-9A-Z_]` (2–64, first not `_`)
  or an integer: SQLSTATE, Node system codes, undici codes. Anything else is left out.
- Frames: in label mode `exception.stacktrace` holds the first two frames outside `node_modules` and `node:`
  internals (the first two frames when there is none), trimmed, without the header; none when the stack does not
  start with the error's own header.
- `createOnRequestError`: `next.digest` when the digest matches `^[0-9]+(@E[0-9]+)?$` (or `E<n>@<hash>`), and
  `next.render_source` when Next passes it.
- Tests: the issue's two acceptance cases, a Node code on the error itself, a free-text code left out, a `NEXT_*`
  digest left out, the old label test updated (frames now present, no message).

## Phase 2: docs

README "Errors and personal data" and "Next.js" (the trace gap on the RSC payload path, match by `next.digest`),
`CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Frames go into `exception.stacktrace`, the OTel attribute for code location, so backends show them where they look.
- A cause chain is capped at three, against cycles and noise.
- The trace id is documented, not faked: Next gives the handler neither a span nor a context there.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: label, frames, digest (6abb1f2)
- [x] Phase 2: docs (6178bd0)
- [x] Implementation review
