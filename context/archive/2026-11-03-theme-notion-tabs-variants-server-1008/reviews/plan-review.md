---
change_id: theme-notion-tabs-variants-server-1008
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #1008.

- Scope: covers both proposals of the issue (the move with an upstream delta, the dropped exemption). No styling
  change, so nothing to mirror in the NOTION · Design System artifact.
- Risk: a re-export from `tabs.tsx` would still be a client reference; the plan exports the builder from the root
  only through the plain module. Check `dist/ui/tabs.js` does not export it after the build.
- Tests: the guard must fail on the tree before the move with exactly the tabs entry.

Verdict: approved.
