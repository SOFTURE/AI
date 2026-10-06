# Plan review: deploy-verify-origin-firewall

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | an optional origin address on the command line; an `origin` row that passes only when direct HTTPS gets no answer; a failed row fails the run and the workflow's verify job |
| Scope | PASS | `src/verify/`, the verify command, README; the workflow change is one input, its check and one flag, kept small because lane A edits the same file in parallel |
| Unknowns answered | PASS | fail, not warn (D1); the address from the command line, never the committed file (D2) |
| Security | PASS | the probe sends nothing over the connection; the address stays out of the repository; the workflow passes it through `env:` and validates it in the `check` job |
| Testability | PASS | pure classification for every outcome (the dropped case needs no unroutable address); a local listening and closed port for the real socket |
| Conventions | PASS | options objects, result values (the probe never throws), discriminated union for the probe outcome, English only |

Findings:

- **W1 (warning):** FIRE's check passes on an open origin whose certificate does not cover the IP (curl's `000`).
  Taken into D3: the probe is a TCP handshake, so an accepted connection fails whatever the certificate.
- **W2 (warning):** `ECONNREFUSED` means the packet reached the server; a firewall that rejects instead of
  dropping, or a server where nothing listens on 443, is still closed to direct HTTPS. Kept as a pass, with the
  reason in the row, so the owner sees which.
- **S1 (suggestion):** a hostname that resolves through the CDN would connect and fail the row with a misleading
  message. The README says to pass the server's own IP; the row names the address it connected to.
- **S2 (suggestion):** with `origin-address` set and `deploy-config` empty the verify step is skipped. Taken as D6.
