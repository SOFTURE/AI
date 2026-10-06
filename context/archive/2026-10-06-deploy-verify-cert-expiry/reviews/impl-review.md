# Implementation review: deploy-verify-cert-expiry

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan adherence | PASS | both phases as planned: the schema key and `tls-check.ts`, then `runVerify`, the report, the command and the README |
| Intent | PASS | optional `verify.tlsMinDays`; one certificate read per run; a `tls` row with days left, expiry date and issuer; too few days, an untrusted certificate, a handshake error or an `http` URL fail the run with exit 1 |
| Tests | PASS | exact boundaries of `checkCertificateExpiry` with `now` as input (at the minimum, one second under, untrusted, expired); a local `node:tls` server with an `openssl` certificate (trusted, too short, self-signed, wrong host name); refused connection; a server that never answers the handshake; schema range; the CLI table and messages |
| Errors | PASS | the probe never throws: every failure is a row with the reason; the socket is destroyed on every path |
| Security | PASS | `rejectUnauthorized: false` only on the probe, which sends no request; trust is still judged from `authorized` (chain and host name) and fails the row |
| Conventions | PASS | zod at the boundary, result values, options objects, read functions without side effects, English only |
| Docs | PASS | README: the key, the row, Cloudflare's edge certificate; the limitation line is gone; JSON Schema regenerated |

Findings:

- **W1 (warning), fixed:** the probe listened for `error` with `once`, so a second socket error after the first
  would have been unhandled and crashed the CLI; it now uses `on` and the first outcome wins.
- **W2 (warning), fixed:** `issuer.O` can be an array when the field repeats; the typecheck caught it, and repeated
  values are joined.
- **W3 (warning), fixed:** the test's silent TCP server kept the accepted socket open, so closing it hung; the test
  destroys the sockets it holds.
- **S1 (suggestion):** the summary still says "1 routes" for a single route (as before this change). Kept: out of
  scope, cosmetic.
- **S2 (suggestion):** absolute redirect targets on another host are not probed. Kept: the item asks for the
  verified URL's certificate, and the plan puts other hosts out of scope.

Release: `@softure-ai/deploy` 0.1.1 → 0.1.2 (0.1.1 is tagged by release-0-1-5); `deploy-app.yml` defaults to the package version, as its repository test requires, so callers get the `tls` row once the owner releases 0.1.2.
