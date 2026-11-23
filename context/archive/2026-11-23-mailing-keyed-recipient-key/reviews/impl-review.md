# Implementation review: mailing-keyed-recipient-key

Verdict: approved.

- The two derivations are byte-identical (same prefix, rounds, length, normalization), pinned by an independent
  `pbkdf2Sync` in each package's tests and by waitlist's equality test under a second secret.
- Fail closed: list mail without either secret answers `unavailable` before any database read or provider call;
  `runDeliveries` and `softure-mail campaign` stop before claims or connections; everything else throws a
  `SoftureConfigError` naming the variable. No path computes a key without the secret.
- The legacy unsubscribe path keys the verified address with the same `env` it verified with.
- `Array.prototype.map(getEmailKey)` would now pass the index as `env`; the two e2e specs that did it pass an
  explicit env, and a repository grep finds no other such call.
- The memo keeps the secret in a process-local `Map` key; it never leaves the process. Acceptable.
- No SQL left that keys an address: 0006 drops the functions and a test asserts they are gone.
