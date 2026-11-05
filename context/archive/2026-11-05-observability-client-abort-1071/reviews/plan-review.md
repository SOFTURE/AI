---
change_id: observability-client-abort-1071
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (211422f).

- Acceptance of #1071: the four abort shapes log `info` with `outcome: "client_aborted"` (phase 1, one test each);
  every other error, including one sharing the digest, stays `error` with its stack (tested); an option extends or
  turns it off (tested).
- Risk: hiding a real failure. Exact message and code matches only; a substring stays an error (tested).
- Risk: `errorDetails: "label"` hides the message in the log; the predicate reads the error object, not the log
  text, so it still works.
- Signature: the new second argument is optional, so existing callers compile unchanged.

Verdict: approved, no changes.
