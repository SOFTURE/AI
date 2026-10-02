# Plan review: security-rate-limit

Reviewed: plan.md @ 2026-10-02 (author's check against change.md, research.md, docs/02 and
AGENTS.md). Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.

## Findings

### W1 [WARNING] Pruning on one cutoff would keep short-window rows too long or delete live long-window rows
**Where:** Approach, Cleanup
**Problem:** buckets have their own windows; a single cutoff is wrong for one of them.
**Decision:** Fix now (applied) - per bucket cutoff of two windows, unknown buckets on the longest.

### W2 [WARNING] Probabilistic cleanup is untestable as written
**Where:** Phase 1 tests
**Problem:** a 1% chance makes a test either slow (hundreds of calls) or flaky.
**Decision:** Fix now (applied) - `cleanupProbability` option; tests use 1 and 0.

### S1 [SUGGESTION] The example app route should exercise the packed package, not the sources
**Where:** Phase 3
**Decision:** Kept as planned - the e2e harness installs packed packages already.
