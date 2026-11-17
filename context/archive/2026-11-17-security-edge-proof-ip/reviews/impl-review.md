# Implementation review: security-edge-proof-ip

- Drift from plan: the default header is `x-softure-edge-proof` in security (lowercase, as `headerIp` reads) and
  `X-Softure-Edge-Proof` in deploy's labels; header names are case-insensitive on both sides (tests).
- Timing (checked): both values are hashed to SHA-256 before `timingSafeEqual`, so neither the length nor a prefix of
  the secret leaks; a repeated header (`a, a`) never equals the secret.
- Fail-open (checked): only `secret: undefined` skips the proof; an empty or short secret throws at startup.
- Guard (Warning, accepted): default-on changes the result for an app that passes today; the CHANGELOG gives the four
  migration steps and the `edgeProofHeader: false` opt-out. Routers on `@internal` services are skipped.
- Worker (checked): it serves no HTTP and gets no `EDGE_PROOF_SECRET`.
- Verdict: approve.
