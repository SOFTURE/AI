# Implementation review: billing-reminder-run-388

Reviewed the diff against change.md and plan.md on `32a5777`. Mode: autonomous (decisions taken, recorded here).
Billing, repository and example tests (1018), typecheck, lint and build green.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Raising `module.json`'s `dependsOn.mailing` to `^0.1.12?` broke the manifest test: the range there is the module's runtime contract, read from the manifest in code. | Fixed: `module.json` stays `^0.1.0?`; the npm peer range (`^0.1.12`) is what keeps an app from installing a mailing without `runDeliveries`. |
| F2 | Warning | `retakeUncertain` resends under the same idempotency key, so the fake provider (like a real one) answers with the first mail. | Accepted: that is the ledger's design; the test asserts the run counts it `sent` and the provider holds one mail. |
| F3 | Suggestion | `buildMail` now runs in a dry run too. | Accepted and documented: the scope and the recipient come from it; the template must not write. |
| F4 | Suggestion | `endsAtMicros` relies on `extract(epoch …)` being `numeric` (Postgres 14+). | Accepted: the doc comment says so; CI and PGlite run 16+. |

No finding blocks the change.
