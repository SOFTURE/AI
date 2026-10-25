---
change_id: theme-notion-steps-738
verdict: approved
---

# Implementation review

Reviewed d7605f3 and 0d7c89c against plan.md and issue #738.

- Acceptance: `Steps` and its types are exported from the package root; `data-slot="steps"`, `data-step`,
  `data-state` are set; tests cover numbering, `aria-current` on the current step only and both layouts.
- Look: the number sits in a 20 px (`size-5`) badge, round in `row` and `rounded-sm` in `list`, coloured per state
  from a literal map of design tokens; titles `text-sm font-medium`, notes `text-small text-muted-foreground`; `row`
  cards use `rounded-lg` with the current one on `blue-bg`, `list` rows `hover:bg-accent`.
- Tailwind: every class is a literal under `src/notion/`, which the shipped `theme.css` lists as an `@source`; the
  build writes `theme.css` with `@source "./notion"`.
- Accessibility: the visible number is `aria-hidden`, the state word is `sr-only` and replaceable through
  `stateLabels`; README "Copy" lists the prop.
- Gates: typecheck, ESLint, language gate and theme-notion tests (101) green.

Verdict: approved, no changes.
