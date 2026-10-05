# Implementation review: deploy-reusable-workflows

Scope: full · Date: 2026-10-05 · Gates: typecheck, lint (ESLint + language), test (259 files), build, actionlint 1.7.12
with shellcheck over every workflow and the example caller

## Verdict

Ready. `deploy-app.yml` builds, deploys and verifies a release behind one `uses:` line; the example caller and
`tests/repo/deploy-workflows.test.ts` (11 tests) guard its shape. The `check` script was run by hand on valid inputs
(image derived as `ghcr.io/jarmatys/fire_tracker` from a mixed-case repository) and on nine bad ones (each rejected
with its own error); the render step was run with a stub `npx` (secrets reach the CLI, `APP_SECRETS` does not; a
`NODE_OPTIONS` name and a non-JSON value are refused).

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | phases 1–2; both domain spots are inputs; secrets explicit; example caller; actionlint in CI |
| Tests | PASS | triggers, top-level and per-job permissions, `packages: write` only on `build`, no `${{ inputs/secrets/github.event }}` in scripts, pinned host key, caller inputs and secrets against the declaration, CLI version tied to the package |
| Security | PASS | every input validated before a build; values only through `env:`; host key from a secret with `StrictHostKeyChecking=yes`; key, known_hosts and `.env.prod` removed in an `always()` step; the app's secrets only in the deploy job, handed to the CLI with a minimal environment; deploy concurrency never cancels |
| Correctness | PASS | checkout at the tag in build and deploy; sparse checkout of the compose file; verify retries until the timeout and reports the last status |
| Conventions | PASS | follows `blog-links.yml`; English only; `release.yml` touched by spelling only (`NODE_AUTH_TOKEN=''`, a shellcheck directive) |

## Findings

- **W1 (warning, deferred):** parity with FIRE_TRACKER's `release.yml`, `auto-release.yml` and its SSH gateway is
  unchecked (the session cannot read FIRE_TRACKER), including the forced-command protocol. Folded into **DF-1** (FIRE parity of the deploy CLI, now also the workflow).
- **W2 (warning, deferred):** verify checks only the health route; `softure-deploy verify` (DP-4) runs in parallel.
  Recorded as **DF-2**.
- **W3 (warning, deferred):** the workflow was never run end to end (no server, and the CLI is not on npm before
  DP-8). Recorded as **DF-3**.
- **S1 (suggestion, kept):** the environment URL is not set (`environment` is a plain name so that an empty input
  means none); the app URL still shows in the verify log.
- **S2 (suggestion, fixed):** workflow commands (`::error::`) from the Node step went to stderr, where the runner does
  not read them; they now go to stdout.
