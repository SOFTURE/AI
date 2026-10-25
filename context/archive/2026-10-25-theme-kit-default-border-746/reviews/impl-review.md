---
change_id: theme-kit-default-border-746
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #746.

- `theme-kit/src/base.css`: `*, ::before, ::after, ::backdrop { border-color: var(--border); outline-color:
  color-mix(in oklab, var(--ring) 50%, transparent); }` inside the existing `@layer base`, before `body`; header
  comment names the new contract roles it reads.
- Tests: `theme-kit/tests/stylesheets.test.ts` pins the selectors, the exact rule and the contract roles
  (`background`, `border`, `foreground`, `ring`). `theme-notion/tests/theme-css.test.ts` compiles with the real Tailwind
  CLI and asserts the rule lands after the preflight's `border: 0 solid;` with the 50 % `ring` outline (Tailwind adds
  a plain `ring` fallback for browsers without `color-mix`). The new compiled-stylesheet test fails with the old
  `base.css` (checked by stashing it).
- Acceptance checked in Chromium (Playwright) on the compiled stylesheet: a `table-row` `border-b` and a default
  `alert` `border` compute to `--border` in both schemes (light `#e9e9e7`, dark `#2f2f2f`); a `border-input`
  utility still wins.
- Docs: kit README table and CHANGELOG `Unreleased`; theme-notion README paragraph on `base.css` and CHANGELOG
  `Unreleased` (update the kit, nothing else).
- Release note for the coordinator: theme-kit patch (0.1.3); theme-notion's `^0.1.2` range already takes it. No
  version bump in this change.

Verdict: approved.
