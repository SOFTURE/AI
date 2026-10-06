# Implementation review: deploy-workflow-release-guards

Reviewed: the branch diff against plan.md (phase 1) and the lessons; the new and changed tests run red against
`master`'s workflow and template and against two sabotages, then green. Mode: autonomous (`--auto`), every finding
decided by the reviewer.

## Drift from the plan

None in substance. The pack step writes the token with a trailing newline (`docker login --password-stdin` strips
it; the test pins what the login reads). The success and failure lines of the build-argument comparison were
reworded to name variables only ("build-args and .env.prod agree on …" / "hold different values for …").

## Evidence

- `tools/deploy/tests/release-guards.test.ts` (new, 19 tests): the guard step against a real repository and its
  clone (tag on master, annotated tag, a tag only on a feature branch, `release-branch`, a bare SHA, an unknown tag,
  an unknown branch, no branch at all); the check script's `release-branch` and `build-args` refusals; the render
  step with a stub CLI (`app-vars` over secrets and listed, a reserved name refused, an equal build argument passes,
  a different one removes `.env.prod` and prints neither value). Red on `master` (no guard step); with the comparison
  removed 1 red, with the ancestry check removed 3 red.
- `server-files.test.ts` (+6): the token in the archive (0600), login and pull under one throwaway `DOCKER_CONFIG`
  that is gone afterwards, the token installed nowhere, the host login without a token, a failed login before any
  pull, an empty token refused with nothing installed, the reserved name. 3 red with `master`'s template, 4 with
  `master`'s workflow.
- `e2e-scripts.test.ts`, `deploy-workflows.test.ts`: the recorder and checker with the token; the e2e caller deploys
  the head commit on its branch and the assert job checks out that commit; permissions and input defaults.
- actionlint 1.7.12 with shellcheck 0.10.0 over the workflows and the example caller; shellcheck over both rendered
  `deploy.sh` variants, `record.sh` and `check-received.sh`.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| R1 | Warning | The e2e caller names the pull request's head branch as the release branch; a pull request from a fork has no such branch in this repository, so its e2e run would fail at the guard. | Accepted as is: this repository takes no fork pull requests, and the failure names the missing branch. |
| R2 | Warning | The guard checks the tag in `check`; `build` and `deploy` check out the tag again by name, so a tag moved between jobs would deploy an unchecked commit. | Accepted as is (out of scope in the plan): moving a tag needs push rights, which can already deploy. |
| R3 | Suggestion | `build-args` lines are compared trimmed; a value meant to end in spaces would compare without them. | No change: public origins and switches carry no edge spaces; the build action trims its list too. |
| R4 | Suggestion | `deploy.sh.tmpl` is DF-9's file in parallel. | No change: the edit is confined to the archive check and the pull; the second to merge resolves it. |

No open blocking findings. `@softure-ai/deploy` stays 0.1.3 (not yet published; the template change rides with it).
