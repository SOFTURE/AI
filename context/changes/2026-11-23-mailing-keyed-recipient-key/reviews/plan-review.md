# Plan review: mailing-keyed-recipient-key

Verdict: approved.

- The derivation keeps the 43-character shape, so no table changes; checked against every `CHECK` and `EMAIL_KEY`.
- Equality of the two copies is guarded by waitlist's existing test; a mailing test pins the exact bytes so a change
  to one copy fails loudly.
- Secret separation from the rotating unsubscribe secret is right; the README must say "never rotate".
- The SQL functions are removed, not left computing a key that no longer matches: a silent mismatch would mail people
  who opted out. Covered by migration 0006 and its test.
- Risk: a module that computes keys in a hot path. 2 ms with memoization is fine for requests; campaigns and imports
  are batch work.
