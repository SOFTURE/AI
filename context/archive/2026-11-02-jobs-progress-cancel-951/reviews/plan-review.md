---
change_id: jobs-progress-cancel-951
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Scope: all four proposals of the issue are covered (progress, reads, `requestJobCancel`, page). `cancelJob` keeps
  its meaning.
- Fencing: progress writes, heartbeats and the cancel completion name the claim token; a stale worker cannot write.
- Lifecycle gaps checked: lease end with a request (cancelled, not re-run, not `lease_expired`), release on shutdown
  (cancelled), retry after a request (cancelled), retry of a cancelled job (`retryJob` must clear the request and the
  progress, or the table check would refuse the row).
- Data: progress is code-only, checked on write and on read, like the summary; no free text reaches the page.
- Compatibility: a migration, new `Job` fields, a new run outcome and a new report field; the CHANGELOG must say what
  an app with its own dictionary or exact report assertions changes.
- Risk: conflicts with #943 (`process.ts`, `claim.ts`) and the 0007 number with #955; handled at merge time.

Verdict: approved, with the `retryJob` reset added to Phase 2.
