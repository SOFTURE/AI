---
change_id: theme-notion-code-badge-contrast
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `src/notion/Code.tsx`, `src/ui/badge.tsx`, `src/tokens.ts` and
`tests/contrast.test.ts` on the base branch.

- Scope: one new token, two parts; `red` and every other part unchanged. No version bump.
- Look: the code red moves by about 1.5 % OKLCH lightness in light and 4 % in dark, same hue and chroma.
- Risks: a new colour token must be in the snapshot fixture (`tests/tokens.test.ts` checks order and values) and gets
  a generated `--code-foreground` variable and `text-code-foreground` utility; `cn` must not merge
  `text-code-foreground` with the `text-code` text style (a test renders `Code` with both). `compoundVariants` keeps
  the cva output order: base, variant, then the colour, as before.
- Behaviour change for apps: `<Badge variant="destructive" color="…">` stops drawing the colour's text. The colour had
  no visible meaning on the destructive fill; the CHANGELOG says so.

Verdict: approved, no changes.
