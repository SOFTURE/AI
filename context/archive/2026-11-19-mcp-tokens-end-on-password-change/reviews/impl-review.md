# Implementation review: mcp-tokens-end-on-password-change

- Drift from plan: none.
- Correctness: reads join `auth.users` on a foreign key, so live rows are never dropped; the boundary (same instant)
  is tested; another account's tokens are untouched (tested).
- Docs: README overview and CHANGELOG (Unreleased) name the behaviour and what users need to do.
- Verdict: approve.
