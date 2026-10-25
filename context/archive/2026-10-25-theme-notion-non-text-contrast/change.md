---
change_id: theme-notion-non-text-contrast
title: "theme-notion: control boundaries and states meet WCAG 1.4.11 non-text contrast (issue #759)"
status: archived
roadmap_item: null
issue: 759
branch: claude/project-thread-74fdjg
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #759](https://github.com/SOFTURE/AI/issues/759): every boundary needed to find a control (text fields,
select triggers, the switch track) and every state indicator (switch on/off, checkbox checked, progress fill) reaches
3:1 against its surroundings in light and dark (WCAG 2.2 SC 1.4.11), while the theme keeps the Notion look: lightness
shifts only, hue kept, decorative separators (`border`, `sidebar-border`) untouched.

## Context

- Labels: bug, adoption, pkg: theme-notion. Follow-up to #756 (text contrast, PR #758), whose `tests/contrast.test.ts`
  this change extends. The owner asked for WCAG compliance that still looks good.
- Based on the branches of PR #758 (#756) and PR #757 (#746), both waiting to merge.

## Constraints

- Tokens stay equal to the snapshot in `tests/fixtures/notion-tokens.json`; the snapshot is updated with them.
- No version bump; the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue measures every failing pair and names the outcome.
