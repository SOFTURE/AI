# Plan review: billing-retro-reviews

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 9/9 paths (both archive folders, the followups README and entries, roadmap.md, tests/repo/roadmap-contract.ts, tests/repo/links.test.ts, the FU-9 review and research used as patterns), 3/3 commands (`npm run typecheck`, `npm run lint`, `npm test` from `context/workflow.json`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | WARN (W1) |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | PASS (none) |
| Tests | PASS: link and roadmap-contract tests guard the documents |
| Security | PASS (none) |
| Lean | PASS |
| Fit | PASS: research and review templates of the skills, FU-9's archive as the model |
| Cost and defaults | PASS (none) |
| Scope | PASS: no file under `modules/` or `examples/` |
| Reuse | PASS |
| Lessons | PASS (none applies) |
| Progress format | PASS: titles match, one item per Done-when bullet, gates last |

## Findings

### W1 [WARNING] The roadmap row of FU-12 itself is not in any phase
**Effort:** low. **Lens:** Coverage and end state. **Where:** Phase 2 (plan.md) · `context/foundation/roadmap.md:56,275-284`
**Problem:** The roadmap contract requires the FU-12 row and block to agree and the change-id to live in exactly one folder (`tests/repo/roadmap-contract.test.ts:145`). The plan files FU-24…FU-27 but never moves FU-12's own row to `in_progress` / `done` with an `Input:` line, so the archive step would be the first to touch it and the item could look untaken in between.
**Fix:** Phase 2 also sets FU-12's row and block to `in_progress (implement …)`; archive sets `done` with `Input:` to the archive folder.
**Decision:** Fix now (applied) - Phase 2 bullet added; archive handles `done`.

### S1 [SUGGESTION] Say in each retro document which commit it was checked against
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1 (plan.md)
**Problem:** A retro review checks code that keeps moving (lane C is active); without a snapshot a later reader cannot tell whether a "still applies" was true when written.
**Fix:** Each retro document carries `Snapshot: b6c92c4 (master, 2026-10-04)` in its header.
**Decision:** Fix now (applied) - Phase 1 bullets name the snapshot.

## Triage summary
Fixed: W1, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready after fixes.

## Decisions (auto)
- W1 FU-12 row not in any phase → Fix now (clear, cheap fix).
- S1 snapshot in each retro document → Fix now (cheap).
