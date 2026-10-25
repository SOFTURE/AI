---
change_id: theme-notion-class-parity-735
status: in_progress
---

# Plan: class string parity and page base rules (issue #735)

Input: change.md, research.md. Complexity: small (four component files, one stylesheet, tests, docs).

## Phase 1: class strings and regression tests

Files: `themes/theme-notion/src/ui/sidebar.tsx`, `checkbox.tsx`, `select.tsx`, `field.tsx`,
`themes/theme-notion/tests/ui/sidebar.test.tsx`, `checkbox.test.tsx`, `select.test.tsx`, `field.test.tsx`.

1. Sidebar: swap the three class strings back (`none` root, phone `SheetContent`, `sidebar-gap`).
2. Checkbox: `CheckIcon className="size-3.5"`.
3. Select: `ChevronUpIcon className="size-4"`; add `[&_svg:not([class*='text-'])]:text-muted-foreground` to
   `SelectItem`.
4. Field: `FieldTitle` takes the design system's string.
5. Tests: static markup for the `none` sidebar, the desktop gap, the checked checkbox, the scroll-up button and the
   field title; happy-dom with a phone-width `matchMedia` for the phone sheet (no own close button, `p-0`,
   `bg-sidebar`). Each asserts the key classes and that the misplaced ones are gone.

## Phase 2: page base stylesheet and docs

Files: `themes/theme-notion/src/page.css`, `themes/theme-notion/package.json`, `themes/theme-notion/tests/theme-css.test.ts`,
`themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. `page.css`: `@layer base { html { -webkit-font-smoothing: antialiased; } body { font-size: --theme(--text-sm);
   line-height: --theme(--text-sm--line-height); } ::selection { background: var(--blue-tag); } }`.
2. Declare it in `softureTheme.stylesheets`, export `./page.css`.
3. Compile it in the Tailwind CLI test after `theme.css`: the three rules resolve to 14 px, the Tailwind line
   height and `var(--blue-tag)`.
4. README: import line in both wirings with a one-line explanation; CHANGELOG under `Unreleased`.

## Decisions (auto)

- A theme-notion stylesheet, not the kit's `base.css`: the selection colour reads `--blue-tag`, a Notion token, and
  the body size is a Notion choice (the issue's own suggestion). Font smoothing rides along so the design system's
  base layer lives in one file.
- Named `page.css`, not `base.css`, so the two `@import` lines do not read as the same file.
- Opt-in file, not inside the generated `theme.css`: putting it there would need a new field in the kit's theme
  contract for one theme; an app adds one `@import` line.
- `--theme(--text-sm)` rather than the Notion `text-ui` style: the design system writes `text-sm`, and both are
  14 px.

## Progress

- [ ] Phase 1: class strings and regression tests
- [ ] Phase 2: page base stylesheet and docs
