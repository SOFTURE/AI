---
change_id: theme-notion-timeline-838
verdict: approved
---

# Plan review

- Acceptance of #838 covered: structure, sizes, colours, dashed rail, button vs plain body, aside outside, data
  attributes; gallery, fixture, README, changelog, artifact.
- Compatibility: additive, a new export only.
- Accessibility: the colour is never the only signal (the README says to put the state in words); the button's name
  keeps its visible text.
- Server-safety: no hooks, no context, so it renders from a server page like `Steps`.

Verdict: approved, no changes.
