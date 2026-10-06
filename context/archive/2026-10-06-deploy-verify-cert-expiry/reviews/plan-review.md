# Plan review: deploy-verify-cert-expiry

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | optional `verify.tlsMinDays`; one `node:tls` read per run; a `tls` row with days left and issuer; fewer days fail |
| Scope | PASS | `src/verify/`, the JSON Schema, the verify command and README; DF-5's parallel schema key handled by "second to merge regenerates" |
| Unknowns answered | PASS | SNI for IP hosts, untrusted certificates, `http` URLs and Cloudflare's edge certificate are decided in research |
| Security | PASS | the probe sends no request; trust is judged in the handshake and fails the row (the plan's `rejectUnauthorized: false` was dropped in the implementation review after CodeQL flagged it) |
| Testability | PASS | pure `checkCertificateExpiry` with `now` as input for exact boundaries; a local TLS server with an `openssl` certificate; no real URL |
| Conventions | PASS | zod at the boundary, result values (the probe never throws), options objects, English only |

Findings:

- **W1 (warning):** `runVerify` changes its return type, so its callers and tests change with it. Accepted: the
  package is not on npm yet (0.1.0 staged, DP-8), and a separate `tls` field keeps routes and the certificate apart.
- **S1 (suggestion):** the probe must end the socket on every path (success, error, timeout), or a run could hang on
  an open handle. Taken into Phase 1 with the "never answers the handshake" test.
- **S2 (suggestion):** print the expiry date in UTC (`YYYY-MM-DD`) so the row reads the same in every time zone
  (tests run in `America/New_York`). Taken into Phase 1.
