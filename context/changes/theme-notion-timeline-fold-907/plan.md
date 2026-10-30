---
change_id: theme-notion-timeline-fold-907
status: in_progress
---

# Plan: folding timeline entry and FoldRow touch size (issue #907)

Input: change.md, research.md. Complexity: small.

## Phase 1: components (TDD)

Files: `themes/theme-notion/src/notion/Timeline.tsx`, `src/notion/FoldRow.tsx`, `src/index.ts`,
`tests/notion/Timeline.test.tsx`, `tests/notion/FoldRow.test.tsx`, `tests/gallery/cases.tsx`,
`tests/fixtures/notion-slots.json`, `visual/baselines/**`.

- `TimelineItemFold { isOpen?, isOpenInitially?, onOpenChange? }`; `TimelineItem` becomes a base plus a union where
  `fold` and `onSelect` exclude each other. With `fold`, the body is a `CollapsibleTrigger`
  (`data-slot="timeline-item-body"`, `min-h-touch-target`, a chevron turning on `data-state=open`) and `children` a
  `CollapsibleContent` (`timeline-item-content`).
- `FoldRow size?: "default" | "touch"`; `touch` swaps `min-h-row-height` for `min-h-touch-target`.
- Tests: toggling by click with `aria-expanded` and `aria-controls`, initially open, controlled with `onOpenChange`,
  the touch height and the action label; FoldRow default and touch heights.
- Gallery cases `Timeline[fold]` and `FoldRow[size=touch]`; regenerate the fixture and the baselines.

## Phase 2: docs

README (`FoldRow` and `Timeline` paragraphs), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Both options of the issue: the folding entry for the timeline, `FoldRow size="touch"` for plain lists.
- The fold body is always at least 44 px high: it is new, so no default changes; a caller keeps the content compact.
- Keyboard comes from the native button (Enter, Space); no extra key handling.
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: components
- [ ] Phase 2: docs
- [ ] Implementation review
