---
change_id: theme-notion-stats-722
verdict: approved
---

# Implementation review

Reviewed c497001 and 7e37917 against plan.md and the issue's reference implementation, on master 72c3cfe (#720 in).

- Fidelity: the markup and every class match the reference; the only structural change is a small
  `getStatCardsLayout` helper instead of a nested ternary for `data-layout` (same values, `isOneRow` first).
- Tones come from `src/notion/tones.ts` (#720); no tone map is duplicated. An aside or pill without a tone uses
  the `default` tag colour, as in the reference.
- Tailwind: `Stats.tsx` is under `src/notion/`, a declared theme source, so the literal classes reach the app's CSS.
- Tests (10): closed fold with its `h2` and content slot, caller class, the three layouts (`isOneRow` over
  `isFullWidth`), hint and aside absent and present with `data-tone`, default aside, pill order and tones, empty pills.
- Gates: typecheck, ESLint, language gate and the theme-notion tests (70) green locally.
- Docs: README example and an `Unreleased` CHANGELOG entry with the app's migration.

Verdict: approved, no changes.
