---
change_id: theme-notion-tones
title: "theme-notion: tones, a figure's colour by what it means (issue #720)"
status: archived
roadmap_item: null
issue: 720
branch: claude/project-thread-rw66gq
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #720](https://github.com/SOFTURE/AI/issues/720): `@softure-ai/theme-notion` exports a shared tone
vocabulary (`Tone`, `TONE_COLORS`) and literal class maps per tone (`TONE_TEXT`, `TONE_FILL`, `TONE_EDGE`), so an
adopting app keeps only its own meaning-to-tone table and no class maps of its own.

## Context

- Labels: enhancement, pkg: theme-notion, adoption. Found while an app moved onto theme-notion 0.1.1.
- The blocks proposed in the issues that follow (#718 and later) take a `tone`.

## Constraints

- Generic through the theme-kit contract: the class names sit in a folder named in `softureTheme.sources`, so the
  shipped `theme.css` makes Tailwind generate them without an app `@source`.
- No release in this change; the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the exports and the acceptance.
