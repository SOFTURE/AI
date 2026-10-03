# Plan review: waitlist

Reviewed: plan.md against change.md, research.md and the roadmap item EN-5 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 0 warning, 1 suggestion.

- Every outcome of EN-5 maps to a plan line: configurable scopes and placements (options, shape
  checks only), widening (union, never narrowed), welcome mail through mailing (`deliverOnce`,
  list kind), unsubscribe through EN-2 (mailing's footer), consent through EN-8 (`recordConsent` in
  the sign-up's transaction), a rate-limited public action, `WaitlistForm` with slots and messages.
- The three unknowns are answered in research.md §2; double opt-in and placement analytics are out
  of scope with a stated path.

### S1 [SUGGESTION] Record a withdrawal when mailing unsubscribes
**Decision:** Deferred - it needs a hook in mailing, which this item does not own; listed in the
README's limitations.
