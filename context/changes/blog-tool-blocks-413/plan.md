---
change_id: blog-tool-blocks-413
status: planned
---

# Plan: blog tool blocks (issue #413)

Input: change.md, research.md. Complexity: small to medium (one new contract, one hook in the gate, docs).

## Phase 1: `BlockPlugin.validate` and the gate (TDD)

Files: `modules/blog/src/render/render-article.ts`, `src/quality/rules/blocks.ts`, `src/quality/catalog.ts` (rule
description), tests in `tests/quality/settings.test.ts`.

1. Tests first: a directive plugin with `validate` returning a message gets a `block-directive` finding at its line; `null`
   gets none; a throw becomes a finding naming the block; unreadable attributes keep the existing message and do not
   call `validate`.
2. Implement `validate?: (block: ArticleBlock) => string | null` and call it in `checkDirectives`.

## Phase 2: `defineToolBlock` and the island mount (TDD)

Files: new `src/ui/tool-block.tsx`, `src/ui/tool-island.tsx` (`"use client"`), `src/ui/index.ts`; test
`tests/tool-block.test.tsx` (node) and `tests/tool-island.test.tsx` (happy-dom).

1. Tests first:
   - server markup through `renderArticle` + `ArticleBody`: the static HTML inside `<div class="blog-tool"
     data-blog-tool="<name>">`, `Island` not rendered; invalid attributes render nothing (or `renderInvalid`);
   - `toArticleMarkdown`/`replaceArticleBlocks`: the static HTML by default, `markdown(props)` when given, the source line
     when invalid;
   - the gate: a schema issue becomes `block-directive` with the path and message; `requires` and `numbers(props)` pass
     through;
   - hydration: the server markup hydrates without a mismatch, then `Island` shows with the parsed props;
   - `name` must be a directive name (kebab-case), checked at definition time.
2. Implement.

## Phase 3: docs

README (a "Tool blocks" paragraph after the directive plugins), CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: `BlockPlugin.validate` and the gate
- [ ] Phase 2: `defineToolBlock` and the island mount
- [ ] Phase 3: docs
