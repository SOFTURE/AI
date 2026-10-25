---
change_id: theme-notion-tones
verdict: approved
---

# Implementation review

Reviewed the diff of d741f02 against plan.md and the issue's acceptance.

- Exports: `TONES`, `Tone`, `TONE_COLORS`, `TONE_TEXT`, `TONE_FILL`, `TONE_EDGE` from the package root, values as
  proposed in the issue. Additive only.
- Acceptance 1: `tests/notion/tones.test.ts` checks palette membership and that each class map covers every tone in
  its colour.
- Acceptance 2: `tests/theme-css.test.ts` compiles the theme with the real Tailwind CLI over `softureTheme.sources`
  and finds every tone class (`.text-*`, `.bg-*`, `.border-l-*`) without an app `@source`.
- Docs: README design rules section with an example; CHANGELOG `Unreleased` with the app's migration.
- Gates: typecheck, ESLint, language gate and theme-notion tests green.

Verdict: approved, no changes.
