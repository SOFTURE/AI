---
change_id: theme-kit-text-size-adjust-1056
---

# Research

- `themes/theme-kit/src/base.css`: one `@layer base` block with the universal selector (border and outline colour)
  and `body` (margin, background, colour, font). No `html` rule.
- `themes/theme-kit/src/preflight.css`: scoped to `[data-slot]` elements by design, never touches `html`.
- `grep text-size-adjust themes/*/src`: no hit, so no theme sets it either (`theme-notion/src/page.css`,
  `theme-flat-paint/src/page.css`).
- Tailwind v4 preflight sets `-webkit-text-size-adjust: 100%` on `html, :host` (with `line-height`, `tab-size`,
  font). The issue asks only for the text-size-adjust part; the rest is theme typography the themes already set.
- `themes/theme-kit/tests/stylesheets.test.ts` pins the selector list of `base.css` (`*, ...` and `body`); it gains
  `html` and a test for the declarations.
- Theme tests (`theme-notion`, `theme-flat-paint` `theme-css.test.ts`) compile `base.css` through Tailwind; an
  `html` rule with plain properties compiles as is (Lightning CSS keeps both the prefixed and the standard property).
- theme-kit 0.1.7 is on npm, so the entry goes under a new `## Unreleased` heading in its CHANGELOG.

## Options

1. `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }` in `base.css` (the issue's proposal).
2. Set it in each theme's `page.css`. More places, and an app on a future theme could miss it.

Recommendation: option 1.
