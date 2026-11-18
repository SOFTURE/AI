# Implementation review: setFileExpiry (files)

Verdict: approve.

- Matches the plan: one `UPDATE ... RETURNING` with the id, live and owner conditions; answers `toStoredFile` of the
  updated row, so `expiresAt` is exactly what was set.
- Tests: kept through a prune two hours past the old expiry, then a new expiry hides the file and the prune removes
  its row and bytes; refusals for another owner, deleted, expired, malformed and unknown ids, with the file unchanged.
- Exported from `./server` with both types; README and CHANGELOG updated; additive minor.
