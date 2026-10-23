---
change_id: blog-copy-check-690
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: every ask of the issue is met. `checkCopyText(text, { mode, quality })` runs the ruleset's patterns, the
  app's voice, profit promises (with YMYL) and the rhythm rules over plain paragraphs; `channel` mode reports each
  kind of markup once with its first line and leaves bare URLs, `- ` / `1. ` lists, `snake_case` and arithmetic
  stars alone. The five rules exist: `not-x-but-y-bare` (warning in articles, error in copy through
  `copySeverity`), `verdict-label`, `fragile-spot` (pl and en), `stacked-asides`, `dash-pivot`.
- Compatibility: `copySeverity` is optional; `checkStyle`, `checkRhythm` and `getEffectiveSeverity` accept a
  narrower input than before. Both model articles (FIRE baseline, English fixture) still give no finding, and the
  AI-sounding fixtures give the same rules as before.
- Consistency: the catalog and the skill's rules table gain the article rules (`skill.test.ts` checks both ways);
  every new pattern has a sample. Copy-only rules are documented in the README and stay out of the article catalog.
- Deviation from the plan: in `channel` mode `bold-density` and `bold-labels` are dropped, since every bold is
  already a `channel-markup` finding (the same text would be reported twice).
- Gates: typecheck, ESLint on the changed folders, language gate, blog tests (744 passing). The new copy tests
  failed before the code existed (`checkCopyText` was missing).

Verdict: approved, no changes.
