---
change_id: connections-refresh-failure-detail-936
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (2f4bddb).

- Scope matches the issue: the failure value, one warn line, the stored detail, the three acceptance cases.
- Secrets: the only provider text kept is the `error` code, already validated to 1-100 printable ASCII characters by
  the token client; the description and body are never read. The log quotes it, so it cannot forge extra fields.
- Compatibility: `ConnectionsRefreshFailure` extends `Err`, so `result.error` checks keep compiling; narrowing on the
  code gives the new fields. The migration only adds nullable columns.
- Risk: #935 rewrites the same function; the detail lives in a small number of lines (`recordFailure`, the log
  helper), which keeps the merge simple.
- Proof: one test per acceptance case plus invalid_grant, clearing on success, and the panel row.

Verdict: approved, no changes.
