---
change_id: marketing-kit-caption-keep-with-next-1081
title: "marketing-kit: a footage film's caption card never ends on a word that keeps with the next (issue #1081)"
status: archived
roadmap_item: null
issue: 1081
branch: claude/project-thread-o87129
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Close [issue #1081](https://github.com/SOFTURE/AI/issues/1081): `captionChunks` breaks only after punctuation or after
`maxWords` words, so a card can end on a one-letter word, a short preposition or a number torn from its unit. Only
the kit sees the film-time words (`remapWords`), where two words split by a cut are adjacent, so only the kit can keep
them on one card.

## Context

Labels: pkg: marketing-kit (found in an adopting app). Not parallel-safe with #1077 (per-segment caption box), which
owns the same caption paths: the implementation is built on master after #1077 merges. No version bump: the
coordinator releases.

## Scope

- `captionChunks(words, options)` takes `{ maxWords?, keepsWithNext? }` (a number still means `maxWords`).
- `phraseChunks(words, options)` takes `{ keepsWithNext? }`.
- A card never ends on a word the predicate keeps (unless the word ends a sentence or clause by punctuation, or every
  word of a full card is kept); the kept word moves to the next card, so cards stay within their word limit.
- Footage film option `captionKeepWithNext?: string[]` (marketing.json schema, config mapping); absent: the
  language's default (`DEFAULT_CAPTION_KEEP_WITH_NEXT`), empty: only numbers. A number always keeps with its unit.
- Applied in film time by the render (`composeFootage`) and the draft (`buildFootageDraftCaptions`).
- Exports, tests, CHANGELOG `## Unreleased`, README.

## Constraints

- `captionChunks(words)` and `captionChunks(words, 4)` keep their output for screen films (no predicate).
- No change to an app's repository.

## Notes

- Framing: skipped. The issue states the problem, the cause and the option's shape.

## Done

A footage film's caption cards (`phrase` and `highlight`, render and draft) no longer end on a word that keeps with
the next: `captionKeepWithNext`, else the language's `DEFAULT_CAPTION_KEEP_WITH_NEXT`, and every number; cut in film
time, so it holds across a cut. Tests in `tools/marketing-kit/src/compose/timeline.test.ts`,
`src/footage/captions.test.ts`, `compose.test.ts`, `draft.test.ts`; CHANGELOG `## Unreleased`, README captions and
draft sections. Ships with the next marketing-kit release.
