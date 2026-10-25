---
change_id: theme-notion-tones
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `softureTheme.sources` and `tests/theme-css.test.ts`.

- Scope: additive exports only; no existing export changes, so a patch-compatible minor for the next release.
- Generic: the class maps live in `src/notion/`, which the kit's `@source` already covers; no app-side `@source`.
- Risks: a class map drifting from `TONE_COLORS`; the test derives the expected class from the colour.
- Tests: map coverage, palette membership, compiled CSS.

Verdict: approved, no changes.
