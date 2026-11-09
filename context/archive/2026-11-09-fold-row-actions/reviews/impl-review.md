# Implementation review: fold-row-actions

Verdict: approve.

- Matches the plan: one optional prop; without it the existing markup tests pass unchanged.
- The actions are outside `<summary>` (asserted), so a click never toggles the row; size variants follow the summary.
- Docs: README describes the prop and the wrapper slot; CHANGELOG entry under 0.14.0.
- Evidence: theme-notion tests green, CI green on the PR, the adopting app's screenshots checked (light, dark, 1024 px).
