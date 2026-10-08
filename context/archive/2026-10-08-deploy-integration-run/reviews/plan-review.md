# Plan review: deploy-integration-run

Reviewed: `plan.md` against `change.md`, `research.md` and `wt-integration.sh:2-26`. Verdict: **approved** with two
findings folded into the plan before implementation.

## Contract coverage

| Contract item | Plan |
| --- | --- |
| lookup exit 0/1/3, lines on stdout | Phase 2 `lookupIntegration`, CLI tests |
| remote env `INTEGRATION_NAME`, `INTEGRATION_SHA`, `INTEGRATION_WAIT_MINUTES` | Phase 2 env defaults |
| remote exit 0/1/75 | Phase 2 `runIntegration`, CLI tests incl. timeout |
| `integration:`, `counts:`, `run:`, `red:`, `new-red:` | Phase 1 `formatContractLines` |
| `new-red` "cannot tell → none" | Key decisions, Phase 1 tests |
| `flaky:` | optional; not produced (Decisions (auto)) |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| P1 | Major | A run whose workflow never started leaves `integration/<name>` on the same commit; a later `run` on that commit would wait for nothing until the timeout. | Accepted as documented behaviour: the timeout (exit 75) is the contract's answer, and the README says how to delete a stale ref. `run` prints that it found the ref already on the commit, so the cause is visible. |
| P2 | Minor | `record` needs the tested SHA's object locally to attach a note; a shallow checkout of another commit would not have it. | The record job checks out the pushed SHA (`fetch-depth: 1` of that commit), so the object exists. Tests attach notes to commits the clone has. |
| P3 | Suggestion | Make the notes ref configurable. | Rejected: one fixed name is what lets `lookup` and the workflow agree with no config. |

## Phases

Each phase leaves green gates; phases 1-2 are TDD over pure functions and real git, phase 3 is guarded by the
existing workflow tests, phase 4 by the link check. No data or migration.
