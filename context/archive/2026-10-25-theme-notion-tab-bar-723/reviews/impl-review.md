---
change_id: theme-notion-tab-bar-723
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and issue #723.

- Scope: `TabBar` in `themes/theme-notion/src/notion/`, its root export with `TabBarItem` and `TabBarProps`, tests,
  README and CHANGELOG (Unreleased). No other package changes, no version bump.
- Look: markup and classes are the issue's reference implementation verbatim (pinned by an exact-markup test);
  `data-slot="tab-bar"`, `data-tab` and `data-slot="tab-bar-count"` kept. A server component, no client state.
- Tests: `aria-current="page"` only on the current tab; the count drawn only when given, 0 included; the icon before
  the label; the root export. The Tailwind CLI test confirms the theme generates the line-tab utilities, the
  current tab's underline (`aria-[current=page]:after:opacity-100`) included.
- Deviation: no `linkComponent` prop (optional in the issue, the adopting app uses `<a>`); recorded in the plan.
- Gates: typecheck, ESLint, the language gate and the theme-notion tests pass; the full suite runs on push.

Verdict: approved.
