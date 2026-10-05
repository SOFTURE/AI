# Plan review: deploy-db-guard

Date: 2026-10-05 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | the three outcomes of DP-3 (backup with retention, guard on checksum and order, counts from an app list) each have a phase step and tests |
| Scope | PASS | `tools/deploy/src/db/` plus one additive export in `@softure-ai/db`, justified in `change.md`; `deploy.sh`, workflows and `deploy.json` stay with DP-5, DP-2 and DP-4 |
| Unknown answered | PASS | the guard takes a folder and a URL, so it runs in the new image or on the host; DP-5 picks, both documented |
| Security | PASS | URL split into libpq variables (no password in the process list), never printed; dump mode `0600`; identifiers validated and quoted; `spawn` without a shell |
| Data safety | PASS | retention only after a successful dump; the guard writes nothing; a failed dump leaves no partial file |
| Testability | PASS | real Postgres in CI (service already there), PGlite for the ledger check, pure units for parsing |
| Conventions | PASS | result values for expected failures, `CliFailure` for CLI exits, English output |

Findings:

- **W1 (warning):** FIRE's `deploy.sh` could not be read, so parity (which checks FIRE runs, its retention default)
  is not proven. Accepted: recorded as a `deploy-followups` gap, as DF-1 did for DP-1.
- **S1 (suggestion):** `--keep` below 1 would delete the dump just written; refuse it as a usage error. Taken into
  Phase 2 step 2.
- **S2 (suggestion):** a table list in `deploy.json` (DP-4's file) would let `deploy.sh` stay generic. Deferred:
  DP-4 is in flight in parallel; recorded as a follow-up gap instead of touching its schema.
