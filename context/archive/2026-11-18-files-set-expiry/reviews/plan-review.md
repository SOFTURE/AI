# Plan review: setFileExpiry (files)

Verdict: approve.

- One conditional update; the live check matches `findLiveRow`, so an expired file cannot be revived halfway
  through a prune.
- The tests cover both directions (kept through a prune, taken by a prune) and every refusal the contract names.
