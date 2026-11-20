---
change_id: theme-notion-prose
title: "theme-notion: Prose, the text styles of a long read"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-zx9u7s
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Give apps one shared way to show a long read whose elements they do not draw themselves (Markdown rendered to HTML: a
documentation article, a help page): headings, lists, links, code, quotes and tables in the Notion theme. An adopting
app's public documentation pages need it; without it every app writes its own descendant selectors.

## Context

`@softure-ai/theme-notion` 0.24.0 styles each element it renders (`PageHeader`, `Code`, `CodeBlock`, `Table`), but a
block of rendered HTML takes none of them: inside a design-system root the scoped preflight resets headings and lists
to plain text. The owner's standing order for the adopting app: every new UI component goes into the Notion design
system kit right away, so apps share it.

## Scope

- `Prose` in `src/notion/Prose.tsx` (server-safe), exported with `PROSE_CLASSES`.
- Tests, gallery case, parity fixture, inline gallery baselines, README, CHANGELOG; release 0.25.0 (minor).

## Constraints

- No existing component changes; only the theme's tokens (text styles, `link`, `code-foreground`, `muted`, `border`).

## Notes

- Research and frame skipped: one small additive composition; its styles repeat the ones `Code`, `CodeBlock`,
  `PageHeader` and `Table` already use, so the look is decided by the theme.

## Decisions (auto)

- A wrapper with descendant selectors instead of a Markdown renderer in the theme: the theme stays free of a parser,
  and an app picks its own (or renders its own elements); the README asks for trusted HTML only.
- `asChild` like `List`, so an app keeps its `article` or `main`.
- A wide table scrolls inside its own block, so a phone page never scrolls sideways.
