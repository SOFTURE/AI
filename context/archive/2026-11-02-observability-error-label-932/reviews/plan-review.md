---
change_id: observability-error-label-932
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (7d0dc3b).

- Ask 1 (frames): Phase 1, header-checked, so a multi-line message cannot pass as a frame.
- Ask 2 (cause chain, Node codes): Phase 1; the code pattern allows only upper-case identifiers and integers, so
  free text cannot pass.
- Ask 3 (digest): Phase 1; the pattern matches Next's real shape (`<hash>@E<n>`, read in `error-telemetry-utils.js`)
  and the issue's, never `NEXT_*`.
- Ask 4 (trace id): Phase 2 documents why Next leaves it out; research finding 3 shows no way to get it.
- Risk: the label of an error whose direct cause has a SQLSTATE changes from `Error code=23505` to
  `Error cause=DatabaseError code=23505`; a log query on the old text needs `code=23505` only. Called out in the
  changelog. Accepted.
- Risk: frame paths name files of the deployed server, not data. Accepted, as the issue asks.

Verdict: approved, no changes.
