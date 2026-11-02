---
change_id: observability-error-label-932
verdict: approved
---

# Implementation review

Reviewed the diff of 6abb1f2 and 6178bd0 against plan.md.

- Acceptance 1: an `Error("Failed query: select … params: secret@x.pl")` in label mode logs `Error`, its frame
  (`at … logger.test.ts:…`) and nothing of the query, on the record and on the console (test "logs a database
  error's frame location…"). The digest half is covered in `next.test.ts` ("logs Next's hashed digest…").
- Acceptance 2: `new Error("timeout", { cause: … code: "ETIMEDOUT" })` logs `Error cause=Error code=ETIMEDOUT`
  (exact assertion on the console line and the record).
- Safety: codes outside `[0-9A-Z_]` are dropped (`user@x.pl` test); a non-Error cause is its type; the chain stops at
  three (a self-cause loop test); a `NEXT_REDIRECT;…` digest with a token is not logged.
- Found while testing: V8 formats `error.stack` lazily, so a message changed before the first read is in the header
  and frames are still safe to take; the test reads the stack first to pin the other case. Frames such as
  `at new Promise (<anonymous>)` were taken for app frames; frames without a file are now skipped.
- `full` mode is unchanged (its tests pass untouched). `@softure-ai/core` is dropped from dependencies and the lock.
- Gates: typecheck, ESLint and the language gate green in the pre-commit hook; observability tests 123 of 123.

Verdict: approved.
