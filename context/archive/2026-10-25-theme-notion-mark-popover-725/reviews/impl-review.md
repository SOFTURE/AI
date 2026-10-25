---
change_id: theme-notion-mark-popover-725
verdict: approved
---

# Implementation review

Reviewed the diff of 235b354 against plan.md and issue #725.

- Correctness: `MarkPopover` is the issue's reference verbatim (markup, classes, `popover="auto"`,
  `popoverTarget` on the mark and on the close button with `popoverTargetAction="hide"`, `aria-labelledby` on the
  heading, `buttonData` spread before the wiring props so it cannot override them). `"use client"` because of the
  panel's `onClick`.
- Contract: the file is in `src/notion/`, a `softureTheme.sources` folder, so `theme.css` names it as a Tailwind
  source. A Tailwind v4 build of the file generates every arbitrary class (`anchor-scope`, `anchor-name`,
  `position-anchor`, `position-area`, `position-try-fallbacks` under `@supports`, `backdrop:`). No theme-kit change.
- Tests (7, happy-dom): target wiring and close action, palette tag classes, hidden icon and count with `label` as
  the name, `buttonData` (an `undefined` value renders nothing), phrasing elements only, a click on panel text is
  prevented, a click on a link or the close button is not, the root export. The export test failed before the
  export line.
- Docs: README (compositions list, usage), CHANGELOG `Unreleased` with the migration for an adopting app.
- Gates: typecheck, ESLint, the language gate, the theme-notion tests (56) and the full build pass locally.

Verdict: approved.
