# Implementation review: deploy-workflow-e2e

Reviewed: the branch diff against plan.md (both phases), change.md, research.md and the plan review. Mode: autonomous
(`--auto`), every finding decided by the reviewer.

## Against the plan

- Phase 1 as planned: `record.sh`, `check-received.sh`, the server image (`server/Dockerfile`, `entrypoint.sh`),
  `start-server.sh`, `scripts/write-e2e-app.ts` with the committed `e2e/app/` and `tests/e2e-scripts.test.ts`, which
  runs the workflow's own pack step, `record.sh` and `check-received.sh` together (15 tests, red before the scripts).
- Phase 2 as planned: the `e2e` input, the gate in `check`, the build without login and push, the deploy job's
  test-only steps, the send step's env, the concurrency group, `verify` skipped, the caller `e2e-deploy.yml`, the
  repository tests (red before the workflow change) and the README section.
- Drift from the plan: none in behaviour. Both phases landed in one commit (`84a6b58`), each test-first in the
  working tree, as DF-7 did.
- Plan review P1 to P6 are all in the code (own concurrency group, unlocked account, banner wait without
  `ssh-keyscan`, client key never mounted, caller named `e2e-deploy.yml`, `download-artifact@v8`).

## Verified

- Gates: typecheck, lint, the full `npm test` (pre-push: 3683 passed), build; actionlint 1.7.12 with shellcheck over
  every workflow; shellcheck over the four scripts.
- `record.sh` under Alpine's busybox (`sh`, `tar`, `sha256sum`) against an archive made like the pack step.
- `start-server.sh` and the workflow's unchanged send step run locally against the server (an sshd from another
  Alpine image, since the sandbox cannot reach Alpine's mirror): key accepted, host key checked, the forced command
  recorded `deploy <tag>` and the names.
- The composed run on GitHub: see "CI" below.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| I1 | Warning | The test path builds the full example image on every run (several minutes). | Accepted as is: the paths filter limits it to deploy changes, the GitHub Actions cache speeds reruns, and a real image build is what DP-2 lacked. |
| I2 | Suggestion | `check-received.sh` maps archive names to the tag by convention (`deploy.sh`, `deploy.json`, the compose folder), duplicating the pack step's layout. | Accepted as is: the check is an independent oracle on purpose; a change of the layout should fail it. |
| I3 | Suggestion | The `verify` job and the shipped `deploy.sh` are not exercised end to end. | Recorded as gap DF-15 in the roadmap and the README limitations. |

No open blocking findings.

## CI

Green on the first run, PR #131 at `4cf6d3e` (after merging DF-8, which regenerated the e2e app's `deploy.sh`):
`check inputs`, `build and push the image` (no push), `deploy over SSH` and `check what the server received` passed,
`verify the release` skipped as designed. The assert job printed six `ok:` lines, among them "each of the 5 shipped
files equals the tag's" and the four expected env names. The other workflows (ci, e2e, release dry run, CodeQL) are
green on the same head.
