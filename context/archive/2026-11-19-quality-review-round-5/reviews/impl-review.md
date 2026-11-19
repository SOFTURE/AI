# Implementation review: quality-review-round-5

- The first fetch's failure returns before `readRemoteRef` and the push; the test's `upload-pack` wrapper fails only
  its first call, so the old code would have pushed (it did, the test failed on it).
- The cap tests assert exact instants.
- Verdict: approve.
