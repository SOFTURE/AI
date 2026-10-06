# Implementation review: deploy-workflow-verify-config

Scope: full · Date: 2026-10-06 · Gates: typecheck, lint (ESLint + language), test, build, actionlint 1.7.12 with
shellcheck over every workflow and the example caller

## Verdict

Ready. The `verify` job waits for the health route, then checks out only the app's `deploy-config` at the tag and runs
`softure-deploy verify <app-url>` from the pinned CLI. `tests/repo/deploy-workflows.test.ts` gained 5 tests (16 in
the file). By hand: the `check` script accepts `deploy.json`, `config/deploy.json` and an empty value and rejects
`../deploy.json`, `/etc/passwd`, `a b.json` and `x;rm`, each with its own error; a non-cone sparse checkout of
`/deploy.json` fetches only the root file (not `pkg/deploy.json`, `.npmrc` or `package.json`) and a missing one leaves
the workspace empty without an error; the step's command line, run with the CLI built from this checkout against a
local HTTP server, exits 0 for a passing `deploy.json`, 1 with the table for a failing route, and 1 with
`verify: cannot read deploy.json (ENOENT).` when the file is missing.

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | input, its check, health wait first, config checkout, verify step, README, test |
| Tests | PASS | default `deploy.json`; health step first; command, flags and `env:` of the verify step; every config step guarded by the input; checkout at the tag, anchored, sparse, no credentials; job permissions `contents: read` |
| Security | PASS | no secret in the job; only `contents: read`; one anchored file fetched, so the app's `.npmrc` never reaches `npx`; the input pattern admits no glob or shell character; values through `env:` only |
| Correctness | PASS | the CLI's exit code decides the step; a missing file fails instead of passing on the health route alone |
| Conventions | PASS | the deploy job's checkout and `npx` pattern; the version argument quoted (shellcheck clean); English only |

## Findings

- **W1 (warning, accepted):** the workflow still cannot run before DP-8 publishes `@softure-ai/deploy`; DF-3 runs it
  end to end.
- **S1 (suggestion, kept):** a caller could point `deploy-config` at its own `.npmrc`; the caller is the app's owner
  and already controls every input, so this crosses no trust boundary.
