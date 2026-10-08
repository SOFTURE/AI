# Implementation review: deploy-integration-run

Reviewed: commits `39d3e71` (note, JUnit, contract), `16516ea` (commands), `ce6b14c` and `12165db` (workflow and
caller), `8058158` (docs), against `plan.md`, `change.md`, issue #248 and `wt-integration.sh:2-26`. Verdict:
**approved**, no open findings.

## Plan conformance

| Item | Where | Evidence |
| --- | --- | --- |
| Note format, versioned, zod at the boundary | `src/integration/note.ts` | `note.test.ts`: round trip, null counts, not JSON, wrong shape |
| Counts from JUnit, skipped excluded, entities | `src/integration/junit.ts` | `junit.test.ts`: four cases |
| Contract lines, `new-red` only with a main result | `src/integration/contract.ts` | `contract.test.ts`: five cases |
| lookup 0/1/3, offline fallback, `mainBranch` from `context/workflow.json` | `run-integration.ts` `lookupIntegration`, `integration-command.ts` | `integration-cli.test.ts` "lookup" block |
| record merges with a concurrent note | `recordIntegration` (fetch, write, push, 5 rounds) | "keeps the note another run pushed meanwhile" |
| run 0/1/75, stale note ignored, busy name refused, same-commit ref waited for | `runIntegration` | "run" block: 12 tests against a bare remote whose post-receive hook plays the workflow |
| Write token kept off app code | `deploy-integration.yml` `test` (read, no credentials) / `record` (write) | `deploy-workflows.test.ts`: permissions map, checkout, step scripts run with stubs |

Beyond the unit tests, the real `wt-integration.sh` of `softure-worktree` was run in a scratch repository whose
`context/workflow.json` points at the built CLI: the lookup found nothing, the remote run pushed
`integration/demo`, the stand-in workflow stored a red note, `run` printed `integration: red`, `counts: 1/2`, `run:`
and `red:` lines, exit 1, and the ref was gone.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| R1 | Major (fixed) | An unreachable remote threw a stack trace out of `run` (`git ls-remote` failure). | Fixed in `16516ea`: `unreachable` result, exit 1 with one line; test added. |
| R2 | Suggestion | Phase 2 tests were written right after the code in the same session, not strictly before it; R1 is what they caught. | Accepted, recorded here. Phase 1 tests were seen red first. |
| R3 | Suggestion | The workflow's `deploy-cli-version` default (0.1.4) has no `integration` commands until the next release. | Accepted: same rule as the other deploy workflows (the default is the package version, moved by the version bump); the README and the changelog say so. |
| R4 | Suggestion | `run` with a ref left on the same commit by a workflow that never started waits until the timeout. | Accepted (plan-review P1): exit 75 is the contract's answer; `run` prints that it found the ref, and the README gives the delete command. |

## Gates

`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm test`, `npm run build`: green on the final
commit; actionlint 1.7.12 clean on `deploy-integration.yml` and `examples/integration.yml`.
