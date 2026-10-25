---
change_id: theme-notion-use-client-770
verdict: approved
---

# Implementation review

Reviewed commit bbad826 against plan.md and issue #770.

- Fix: `themes/theme-notion/src/ui/item.tsx` starts with `"use client"`; the built `dist/ui/item.js` keeps the
  directive on line 1 (checked after `npm run build`), which is what Next's bundler reads.
- Guard: `tests/repo/themes.test.ts` gains a contract case per theme package. It failed with `['ui/item.tsx']` before
  the fix (checked) and passes after; leading comments before the directive are allowed, as React allows them.
  theme-flat-paint passes as is; theme-kit's `use-is-mobile.ts` is a `.ts` hook module and stays allowed.
- Upstream guard: the shadcn pin for `item` lists the directive as a delta with its reason, so the drift check stays
  exact.
- Docs: the kit README contract gains rule 4; the theme-notion CHANGELOG `Unreleased` says what an app on 0.2.0 or
  0.3.0 does (nothing, or drop its workaround).
- No visual change, so the NOTION · Design System artifact needs no sync.
- Gates: typecheck, ESLint, language gate green (pre-commit); `tests/repo/themes.test.ts` + theme-notion tests
  798/798.

Verdict: approved, no changes.
