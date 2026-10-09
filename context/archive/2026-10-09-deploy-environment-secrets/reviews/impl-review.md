# Implementation review: deploy-environment-secrets

Reviewed the diff against change.md and plan.md (an independent reviewer pass, then the fixes below). Mode:
autonomous (decisions taken, recorded here). Targeted tests and actionlint 1.7.12 (with shellcheck) clean.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | The CHANGELOG edit replaced the `## 0.1.6` heading with `## Unreleased`, so the 0.1.6 entry fell under Unreleased. | Fixed: `## Unreleased` holds only this entry, `## 0.1.6` is back. |
| F2 | Warning | The example's environment form set `origin-address-var: DEPLOY_ORIGIN_IP` as a line to copy, while the named form keeps that value as a secret: a caller without such a variable would be stopped by the check job. | Fixed: the line is commented and says to keep the address as a repository variable; unset skips the check. |
| F3 | Suggestion | Under the flag the environment's variables still never arrive (`app-vars` is evaluated in the caller), and a repository variable in `app-vars` wins over an environment secret of the same name. | Fixed: one README sentence. |
| F4 | Suggestion | `secrets: inherit` passes repository and organization secrets only to a workflow in the same organization or enterprise. | Fixed: one README sentence. |
| F5 | Suggestion | An address from `origin-address-var` that is malformed, or set without `deploy-config`, was reported as input `origin-address`. | Fixed: the error names the input the address came from; tests updated. |
| F6 | Suggestion | The issue's adopter names its known-hosts secret `DEPLOY_KNOWN_HOSTS`, not the default `DEPLOY_SSH_KNOWN_HOSTS`; the issue proposed `origin-address-secret`, the plan chose `origin-address-var`. | Accepted as is: the defaults follow the example caller's names and `ssh-known-hosts-secret` covers the adopter; the deploy job names a missing secret. The PR body states both. |
| F7 | Suggestion | The check step now calls `jq`; a macOS without `/usr/bin/jq` (before 15) and without Homebrew's would fail the pre-push tests. | Accepted: the summary job's tests already need `jq`, and the macOS CI job has it. |
| F8 | Suggestion | Progress and status were not recorded yet. | Done at archive. |

Acceptance 1 is covered by step-level tests (the render step with the real CLI on what `toJSON(secrets)` holds under
`secrets: inherit`, the send step's expressions, the SSH check step) and GitHub's documented rule that a job with
`environment:` sees that environment's secrets; the e2e keeps the named form (acceptance 3), so the first live proof
is the adopting app's deploy.
