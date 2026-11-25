# Plan review: theme-notion-fold-row-inset

Verdict: approve. A class-only change in one component, test first; the parity fixture and the visual baselines are
the gates that catch the change everywhere the row is drawn, and both are regenerated in the same phase. Moving
`isInset` with the bar keeps its documented meaning ("under the title"). No version bump, in line with batched
releases.
