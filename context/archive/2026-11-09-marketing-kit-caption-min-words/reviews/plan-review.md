# Plan review: marketing-kit-caption-min-words

Verdict: approved.

- Scope matches change.md: opt-in options, the render and the draft share the cutting, no default changes.
- Risk: a join across a long pause shows a word early; acceptable, the caption spans keep each card's timing.
- Evidence is agent-runnable for every phase.

# Implementation review

Verdict: approved. Every new branch has a test (join, move, nothing to move, short first card both ways, empty input,
minWords 1); defaults keep the old tests green unchanged.
