# Implementation review: deploy-verify-origin-firewall

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan adherence | PASS | both phases as planned: `origin-check.ts`, then `runVerify`, the report, the command, the workflow and the README; one deviation recorded below (W1) |
| Intent | PASS | `verify --origin=<address>` adds an `origin` row that passes only when nothing answers; an accepted connection or an address that does not resolve fails the run with exit 1; the workflow passes the address from the optional `origin-address` secret |
| Tests | PASS | address parsing (IPv4, host, port, bracketed and bare IPv6, nine refused forms); every probe outcome classified with its exact row; a local listening port fails, a closed port passes, a `.invalid` name fails; `runVerify`, the report and the CLI with exact tables and messages; the workflow's check job run with bash (accepted, malformed, missing config) and the verify step run with a stand-in `npx` (flag only when set) |
| Errors | PASS | the probe never throws: every outcome is a row; the socket is destroyed on every path; a bad `--origin` is exit 2 before the config is read |
| Security | PASS | nothing is sent over the connection; the address stays out of the repository (command line, a masked secret in the workflow) and reaches the script through `env:`; the check job validates its characters |
| Conventions | PASS | options objects, result values, a discriminated union for the probe outcome, read functions without side effects, English only |
| Docs | PASS | README: the flag, the row, why TCP and not HTTPS, the secret; the DF-13 line under "Parity with FIRE_TRACKER" moved from "tracked" to "in the package"; the example caller and `init`'s caller template pass `secrets.DEPLOY_ORIGIN_IP` |

Findings:

- **W1 (warning), fixed:** the plan had `origin-address` as a workflow input. A secret fits better: the origin IP is
  what the CDN hides, and a secret is masked in the run's log (the `origin` row prints `***`), while an input is
  printed. The plan's D2 is met either way (never in the committed file).
- **W2 (warning), fixed:** the example caller and the `init` template must pass every declared secret
  (`tests/repo/deploy-workflows.test.ts`), so they pass `secrets.DEPLOY_ORIGIN_IP`, empty until the app sets it.
  The end-to-end caller (`e2e-deploy.yml`, lane A) is left untouched: its test now requires the required secrets
  and allows an optional one to be left out, since verify is skipped on that path.
- **S1 (suggestion):** the summary still says "1 routes" for a single route (as before). Kept: cosmetic, out of
  scope.
- **S2 (suggestion):** IPv6-only checks from a runner without IPv6 pass as `ENETUNREACH`. Kept: the row names the
  reason, and the README tells the caller to pass the address the firewall guards.

Release: `@softure-ai/deploy` stays 0.1.3 (not released yet), so the change rides the owner's next release; the
workflow's `deploy-cli-version` default already points at it.
