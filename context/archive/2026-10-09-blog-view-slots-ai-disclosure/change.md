---
change_id: blog-view-slots-ai-disclosure
title: "blog: class slots and a layout for the views, an AI disclosure on the method page, a node disclaimer, an OG card with a logo, getBodyOptions from /server (issue #317)"
status: archived
roadmap_item: null
issue: 317
branch: claude/project-thread-e89581
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #317](https://github.com/SOFTURE/AI/issues/317). An adopting app with its own design system rebuilt
the five `ui` views of `@softure-ai/blog` (about 870 lines) and kept a near-clone of the OG card, because:

1. the views hard-code `blog-*` classes and their own `<main className="blog-page">` frame;
2. the method page has no AI disclosure, and its default "who writes" copy implies human editorial control;
3. the disclaimer is a plain string, so it cannot carry links;
4. the OG card has no logo slot, label override or muted colour, and `createOgFontLoader` is only on `/next`;
5. `getBodyOptions` is only on `/next`, so a renderer outside Next cannot build the pages' body input.

After the change the app keeps the package's views and gives them its look: `classNames` per element (the
`ClassNames`/`unstyled` pattern of `@softure-ai/ui`), a `layout` component that puts the header in the app's
page frame, `renderCard` for the listing cards, a node disclaimer, `aiDisclosure: true` for the method page, and an
OG card route built by `createBlogArticleOgImage({ logo, label })` with `brand.colors.muted`.

A reviewer checks `tests/ui/view-slots.test.tsx`, `tests/next/og-image.test.tsx`, `tests/server-entry.test.ts`, the
README sections on the views and the OG card, and the CHANGELOG entry.

## Context

Issue #317, filed by an adopting app on `@softure-ai/blog` 0.1.10. No roadmap: work comes from GitHub issues. 0.1.10
is on npm, so the change ships as 0.1.11. Other threads touch the blog in parallel (#312, #313); whoever merges
second folds into the unreleased CHANGELOG section.

## Constraints

- Without the new options the markup of every view is byte for byte what 0.1.10 renders (the existing page tests
  stay unchanged and green).
- The views stay server components that import nothing from Next.
- No inline copy: the AI disclosure copy is in `messages.method` (en and pl).
- English-only code and docs; Polish copy only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue names the files and lines; reading `src/ui/*`, `src/next/*`,
  `src/server/*`, `options.ts`, the messages, `styles.css`, the architecture test and `@softure-ai/ui`'s
  `class-names.ts` answered every unknown; findings are in plan.md's "Today" section.
- Framing: skipped. The issue lists five concrete gaps with proposals; the choices are settled in plan.md.
