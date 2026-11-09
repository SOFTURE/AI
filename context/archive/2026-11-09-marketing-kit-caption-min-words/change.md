---
change_id: marketing-kit-caption-min-words
title: "marketing-kit: no one-word caption cards, a brand's words per card"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-7css9u
created: 2026-11-09
updated: 2026-11-09
archived_at: 2026-11-09
---

## Intent

An adopting app's reels show caption cards of one word ("mate,", "on.") because `captionChunks` ends a card at
every comma and full stop, and a sentence's last word is left alone after a full card. Its brand sheet also names a
number of words per caption the kit cannot take. Let a footage film ask for a fewest number of words per card and a
target, so the app's render and draft (which both cut cards through `getFootageCaptionChunks`) never show a one-word
card. Without the new options every card is cut as before.

## Notes

- No frame: the gap is measured in the adopting app's storyboard; research recorded in research.md.

## Done

- `balanceCaptionGroups` (exported) evens out short groups: join to the group before when it fits (target + 1 words,
  `maxCharacters`), otherwise words move over; a short first group does it with the group after.
- `captionChunks` and `phraseChunks` take `minWords`, `maxCharacters` (`phraseChunks` also `maxWords`); a footage
  film and `marketing.json` take `captionMinWords`, `captionMaxWords`, `captionMaxCharacters`. Released as
  marketing-kit 0.23.0; deploy's peer range takes it.
