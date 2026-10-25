---
change_id: theme-kit-default-border-746
status: planned
---

# Plan: default border and outline colour (issue #746)

Input: change.md, research.md. Complexity: small (one stylesheet, two test files, docs).

## Phase 1: the base rule, tests and docs

Files: `themes/theme-kit/src/base.css`, `themes/theme-kit/tests/stylesheets.test.ts`, `themes/theme-kit/README.md`,
`themes/theme-kit/CHANGELOG.md`, `themes/theme-notion/tests/theme-css.test.ts`, `themes/theme-notion/README.md`,
`themes/theme-notion/CHANGELOG.md`.

1. `base.css`: add, inside the existing `@layer base`, `*, ::before, ::after, ::backdrop { border-color:
   var(--border); outline-color: color-mix(in oklab, var(--ring) 50%, transparent); }`; update the header comment.
2. Kit test: `base.css` styles `body` and the universal selector only; it reads only the contract roles `background`,
   `foreground`, `border`, `ring`; the default rule is exact.
3. theme-notion `theme-css.test.ts`: the compiled stylesheet carries the rule in `@layer base`, after Tailwind's
   preflight (index check), so a `border-b` without a colour class takes `--border`.
4. Docs: kit README and CHANGELOG (`Unreleased`); theme-notion README line on `base.css` and CHANGELOG (`Unreleased`,
   no app change needed beyond the kit update).

## Decisions (auto)

- The kit's `base.css`, not theme-notion's `theme.css` or `page.css`: the rule reads only contract roles, so every
  theme needs it; both README wirings already import `base.css`, so apps change nothing.
- Universal selector, as in shadcn, not scoped to `[data-slot]`: app markup with a bare `border` (common in shadcn
  apps) must take the theme too; the scoped preflight already covers `[data-slot]` in the mixed wiring.
- Pseudo-elements included, as in Tailwind's preflight, so a bordered `::before` does not fall back to `currentColor`.

## Progress

- [ ] Phase 1: the base rule, tests and docs
