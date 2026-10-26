---
change_id: ui-disclosure-panel-links-777
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `disclosure-menu.tsx`, `app-menus.tsx`, `scripts/build-css.mjs` and
`tests/styles.test.ts`.

- Scope: matches the issue's ask; only the `ui` package.
- Cascade: the panel rules stay in `@layer softure`, above preflight in `base`; at (0,0,0) they lose to any class
  rule in the same layer, which is the intent. Plain links keep every declaration, since nothing else styles them.
- Regressions: `MobileMenu`'s `link` slot and `AccountMenu`'s children are plain or carry only layout classes that
  do not conflict with the panel's declarations. `tests/styles.test.ts` (every `sft:` class compiles) still covers
  the new class names.
- Tests: the compiled-selector check fails on master and pins the fix; the render check pins that the button keeps
  its classes.

Verdict: approved, no changes.
