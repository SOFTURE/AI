# Plan review: fold-row-actions

Verdict: approve.

- Scope matches the intent: one optional prop, no change without it (the existing tests guard that).
- Accessibility: the actions are outside `<summary>`, so a button keeps its own role and does not toggle the row.
- Versioning: a new optional prop is a minor bump (0.14.0); the changelog says so.
- Risk: another change may bump theme-notion at the same time; whichever merges second takes the next minor and
  rewrites its changelog heading.
