# Implementation review: release-policy-docs

Scope: full · Date: 2026-10-12 · Commits: 3e371f7..3848333 · Gates: lint ✓ (ESLint and language gate) · repository tests ✓ (440 passed, 43 skipped) · typecheck and package tests not affected (documents and one YAML comment)

## Verdict
Ready. The six documents now say what `context/workflow.json` (`release.owner: false`) and the Releases section of
`AGENTS.md` say: the coordinating agent releases on its own, in combined batches once the current issues are done;
a production deploy still waits for the owner's word. One finding, accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | - |
| Tests | PASS (docs only; links and roadmap contract green) | - |
| Security | PASS (no entry point, no secrets) | - |
| Patterns and lessons | PASS | F1 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Align the documents | 3848333 | yes | `auto-release.yml` header comment found by the Done-when grep and added (change.md updated) |

Files: planned and changed 6 · unplanned 0 · planned, not changed 0.

## Findings

### F1 [SUGGESTION] Historical notes keep the old wording
**Impact:** LOW · **Dimension:** Patterns · **Where:** `context/foundation/roadmaps/roadmap-later.md:93-94` (DP-8), `context/archive/`
**What:** a done item and archived changes still say releases or tags were the owner's call. **Why it matters:** a
reader could take them as the current rule. **Evidence:** "the workflow tag stays the owner's call" on the done
DP-8 line. **Fix:** none; they record what was true when written.
**Decision:** accept (auto): history stays as written (change.md Constraints).

## Progress audit
- 1.1: diff of 3848333 touches exactly the six documents listed in change.md.
- 1.2: the Done-when grep returns only rules about other decisions (mode switch, non-English code, worktree entry,
  roadmap gates) and the done DP-8 line (F1); lint and `vitest run tests/repo` green.

## Triage summary
Fixed: -. Accepted: F1. Deferred: -. Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 Historical notes → accept (history is not rewritten).
