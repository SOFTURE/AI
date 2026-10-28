---
change_id: theme-notion-timeline-838
status: done
---

# Plan: theme-notion Timeline (issue #838)

Input: change.md, research.md. Complexity: small (one composition, tests, docs, gallery).

## Phase 1: the composition

Files: `themes/theme-notion/src/notion/Timeline.tsx`, `themes/theme-notion/src/index.ts`,
`themes/theme-notion/tests/notion/Timeline.test.tsx`.

1. Types: `TimelineSize` (`default` | `compact`), `TimelineLine` (`solid` | `dashed`), `TimelineItem` (`key`, `title`,
   `time?`, `description?`, `badges?`, `children?`, `aside?`, `size?`, `color?`, `icon?`, `line?`, `data?`, and
   either `onSelect` + `actionLabel` or neither), `TimelineProps` (`label`, `items`).
2. Markup: `<ol aria-label data-slot="timeline">`; each `<li data-slot="timeline-item" data-size data-color
   data-line>` with the item's `data` spread on it. Inside: the rail segment (`timeline-rail`, absolute, in the marker
   column), the marker (`timeline-marker`, `aria-hidden`), a column with the body (`timeline-body`: `timeline-time`,
   `timeline-title`, `timeline-description`, `timeline-badges`) and the content (`timeline-content`), then the aside
   (`timeline-aside`). With `onSelect` the body is a `<button type="button" aria-label={actionLabel}>`; content and
   aside stay outside it.
3. Rail: one segment per entry in the marker column; the first entry's starts at its marker's centre, the last
   entry's ends at its marker's centre, a single entry has none. `dashed` draws its segment dashed.
4. Export `Timeline` and its types from `src/index.ts`.
5. Tests: the exact markup of one entry; slots in order; both sizes; a colour per palette entry; icon vs no icon;
   rail start, middle, end and a single entry; dashed line; button body with its name vs plain body; content and aside
   outside the button; data attributes; root export.

## Phase 2: gallery, docs

Files: `themes/theme-notion/tests/gallery/cases.tsx`, `themes/theme-notion/tests/fixtures/notion-slots.json`,
`themes/theme-notion/visual/baselines/**`, `themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. Gallery: one case per size (`Timeline[size=default]`, `Timeline[size=compact]`), each a mix of entries.
2. Parity fixture and the visual baselines refreshed for the new cases.
3. README: name `Timeline` in "Components" with an example; CHANGELOG `## Unreleased` entry.

## Decisions (auto)

- An items array like `Steps`, not compound parts: the rail's first and last segment depend on the position, which
  the list knows.
- Marker sizes: `default` a 24 px circle in `bg-<c>-tag text-<c>-tag-foreground` with a 14 px icon; `compact` a 16 px
  icon in `text-<c>` or an 8 px `bg-<c>` dot, on `bg-background` (the page) so the rail stops at it, in a 20 px box.
- Rail: 1 px `border-accent-strong` (research), `border-dashed` for `dashed`.
- Text: default title `text-ui-medium`, compact title `text-small`; time `text-small text-muted-foreground
  tabular-nums`; description `text-small text-muted-foreground`.
- `badges`, `children` and `aside` are nodes: the app brings its own `Badge`, `Status` or `MarkPopover`.
- No built-in copy: `label` and `actionLabel` are required where they apply.
- Implementation: `actionLabel` is not an `aria-label` but an `sr-only` prefix of the button's content. axe's
  `label-content-name-mismatch` (WCAG 2.5.3, label in name) failed the gallery with an `aria-label` that hid the
  visible words; now the name is "<actionLabel>, <visible words>", so a speech-input user can say what they see.

## Progress

- [x] Phase 1: cdc681e
- [x] Phase 2: d76be36
