# Plan: theme-notion touch-target size (issue #742)

## Phase 1: the touch-target size

Files: `themes/theme-notion/src/tokens.ts`, `tests/fixtures/notion-tokens.json`, `tests/theme-css.test.ts`,
`README.md`, `CHANGELOG.md` (Unreleased).

1. Add `"touch-target": "44px"` to `NOTION_THEME.sizes`, after `row-height`, and the same token to the snapshot's
   `size.tokens`.
2. Test: the built `theme.css` declares `--spacing-touch-target: 44px`.
3. README sizes: `touch-target` 44, with the rule "rows and controls meant to be tapped on a phone".
4. CHANGELOG entry with what the adopting app replaces (`min-h-11` → `min-h-touch-target`).

## Decisions (auto)

- No component switches to the token: the pointer sizes stay the desktop default; an app opts in per screen (e.g.
  `min-h-touch-target md:min-h-row-height`). Changing component heights would be a visual break.
- No version bump: the coordinator releases in a batch.

## Progress

- [x] Phase 1: the touch-target size (8b9ea0d)
