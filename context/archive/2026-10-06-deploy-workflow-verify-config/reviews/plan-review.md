# Plan review: deploy-workflow-verify-config

Date: 2026-10-06 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | health wait first, then `softure-deploy verify` from the pinned CLI with `deploy.json` from the tag |
| Scope | PASS | workflow, its repository test and the README section only; `tools/deploy/src/` left to DF-5 and DF-6, server files to DF-7 |
| Unknowns answered | PASS | `deploy.json` is expected by default (what `init` writes); `deploy-config: ""` opts out explicitly |
| Security | PASS | no secret in the job; `contents: read` only; one anchored file checked out without credentials, so no app `.npmrc` steers `npx`; values through `env:`; the new input validated in `check` |
| Testability | PASS | repository test and actionlint; the step's commands run by hand against a local server |
| Conventions | PASS | the deploy job's checkout and `npx` pattern; English only |

Findings:

- **W1 (warning):** the workflow still cannot run before DP-8 publishes the CLI. Accepted: unchanged from DP-2, the
  default CLI version stays tied to the package by the test.
- **W2 (warning):** a `deploy.json` that uses keys DF-5 or DF-6 add needs a `deploy-cli-version` that knows them; an
  older pin rejects the file (strict schema). Accepted: the CLI names the unknown key, and the default follows the
  package version.
- **S1 (suggestion):** rename the job from "verify the health route" to "verify the release", since it now checks more.
  Taken into Phase 1.
