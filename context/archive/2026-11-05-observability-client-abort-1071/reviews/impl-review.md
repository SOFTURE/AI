---
change_id: observability-client-abort-1071
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and #1071.

- Acceptance: the four abort shapes from the issue log one `INFO` record "request aborted by the client" with the
  request fields, `next.digest` and `outcome: "client_aborted"`, and no `exception.*` (one test each); an error that
  only mentions the phrase, one sharing the digest and an `ECONNRESET` that is not `aborted` stay `ERROR` with the
  stack. Six of the new tests fail on master's code.
- Option: `isClientAbort` replaces the default; tests cover extending it with `isClientAbortError` and turning it
  off with `() => false`. The second argument is optional, so existing callers are unchanged.
- Safety: the abort record keeps the query-less path, like the error record (tested with a token in the query).
- Gates: typecheck, ESLint on the changed files and the language gate pass; `tests/next.test.ts` 18 of 18.

Verdict: approved.
