# Implementation review: quality-review-security-jobs-deploy

- Drift: one addition beyond the plan, the code-shape check of `last_error` (the planned test failed on the old dot
  check with an address in the text). Shared by the job and sync-item paths; recorded in Progress. Accepted.
- security: the body key is recorded only for a header id, after the header id, in the same transaction; a refused
  header id still answers 400 before it. A by-hand flow is unchanged and the README says to record such a key itself.
- jobs: a timed-out hook's later rejection is caught inside `runHook`, so it is never unhandled; the timer is cleared
  on every path. The hook types gain an optional-to-use third argument; `@softure-ai/alerts` type-checks and passes.
- jobs react: the per-poll controller follows the unmount signal (also when it is already aborted) and is cleaned up.
- deploy: only `export` keywords removed; no package entry re-exported them.
- Verdict: approve.
