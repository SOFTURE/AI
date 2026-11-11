---
change_id: marketing-kit-caption-entrance-underline
title: "marketing-kit: a caption entrance (none, fade, pop) and an underlined lit word"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-lw7ast
created: 2026-11-10
updated: 2026-11-10
---

## Intent

An adopting app lets its brand set the whole caption pill: font size, words per card, lines, radius and padding are
already film or brand inputs, but the pill's entrance (always a short rise and fade) and the lit word's look (its text
colour or a box) are not. Add `FootageFilm.captionEntrance` (`none | fade | pop`; `pop` scales from 96 % to 100 %
without overshoot) and a third `captionHighlightStyle`, `underline`: the lit word keeps its text colour and gets an
accent underline in `captionHighlight`, in the render and in the draft.

## Constraints

- Backward compatible: without `captionEntrance` the pill enters as before (the 14 px rise and fade); `text` and
  `box` highlights draw as before.
- `pop` never passes 100 % (no overshoot ease); entrances stay short (0.16 s), nothing that looks generated.
- The draft shows no entrance (as before, it draws the captions still); its underline matches the render's: under the
  lit word, in the accent, for the word's 0.32 s.
- Tests on fakes only.

## Notes

- Research skipped: the caption drawing was read in full for this change (`footage/compose.ts`, `footage/draft.ts`,
  `footage/caption-highlight.ts`); the plan names every touched function.
