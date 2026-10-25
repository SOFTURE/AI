---
change_id: theme-notion-code-740
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, issue #740, `themes/theme-notion/src/notion/Status.tsx`,
`themes/theme-notion/package.json` and `themes/theme-notion/tests/index.test.ts`.

- Scope: the issue's two parts and acceptance (root export, README, tests on classes and `wrap`); nothing outside
  `themes/theme-notion/` and the change record.
- Classes are literal strings in `src/notion/`, which `softureTheme.sources` covers, so `theme.css` generates them.
- Accessibility: `role="region"` with a name, focusable for keyboard scrolling, only when named. Matches the issue's
  `label` contract.
- Risks: none for existing apps, the change only adds exports. Parallel theme-notion changes touch the same
  `index.ts`, README and CHANGELOG; conflicts are resolved at merge.

Verdict: approved, no changes.
