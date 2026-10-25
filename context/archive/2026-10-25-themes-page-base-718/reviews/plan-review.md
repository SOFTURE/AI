---
change_id: themes-page-base-718
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `themes/theme-kit/package.json`, `tests/repo/themes.test.ts` and
`tests/repo/packages.test.ts`.

- Scope: matches the issue's two asks; nothing outside `themes/`.
- Generic: reads `--background`, `--foreground` (contract roles) and `--font-sans` (theme or Tailwind default).
- Risks: `--theme()` needs the app's Tailwind; documented like `sft-bridge.css`. The MapLibre rule must stay
  unlayered; a test pins it. The package `files` already include `dist`, so the new exports ship.
- Tests: rule shape and the export/copy lists cannot drift.

Verdict: approved, no changes.
