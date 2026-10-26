---
change_id: theme-notion-use-client-770
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #770.

- Scope: one directive, one contract test, docs. No component behaviour or styling changes, so nothing to mirror in
  the design system artifact.
- Fit: matches the issue's first guard option; the second (react-server smoke) is rejected with a concrete reason.
- Risks: the hook regex could flag a non-React `useX(` call in a `.tsx` file; acceptable, since such a file in a
  component folder would be a client module anyway. A directive after a comment line would not count; the test
  checks the first statement, as React requires the directive before any code (comments may precede it, so strip
  leading comments).
- Tests: the guard must fail on the current `item.tsx` before the fix (check it).

Verdict: approved, with the leading-comment handling folded in.
