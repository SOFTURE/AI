# Plan: blog-tool-block-nodes

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (three phases).

## Goal

`defineToolBlock` and `defineToolBlocks` (root and `/server`) return React-free plugins whose nodes are data;
`/ui` renders them with the app's islands (`view.tools`), eagerly or through `lazyToolIsland`, in `replace` or
`append` mode. README and CHANGELOG carry the migration. All gates green.

**Out of scope:** per-tool `requires` on a shared directive (one plugin-level list; YAGNI), a release.

## Approach

Research option 1.

## Phase 1: React-free definitions

**Discipline:** TDD. **Files:** `modules/blog/src/render/tool-block.ts` (new; moved from `ui/tool-block.tsx`),
`src/render/index.ts`, `src/index.ts`, `src/ui/index.ts`, `tests/tool-block.test.tsx`, `tests/architecture.test.ts`.

- `BlogToolNode { kind: "blog-tool"; directive; tool; props; html; mode; className }`, `isBlogToolNode(value)`.
- `defineToolBlock({ name, schema, renderStatic, mode?, requires?, markdown?, numbers?, renderInvalid?, className? })`
  → `BlockPlugin<BlogToolNode>`; `tool` = `name`.
- `defineToolBlocks({ name, tools: { [type]: ToolDefinition }, requires?, renderInvalid?, className? })`; `type`
  is stripped before the tool's schema; missing or unknown `type` → `validate` message
  `type must be one of: a, b`; invalid → `renderInvalid` or nothing; `markdown`/`numbers` per tool.
- Architecture test: `render/` and the root import no `react`.

Done when: tests cover both factories (page node, Markdown, gate, numbers, invalid and unknown types).

## Phase 2: Page-side rendering

**Discipline:** TDD. **Files:** `src/ui/tool-island.tsx`, `src/ui/tool-node.tsx` (new), `src/ui/lazy-tool-island.ts`
(new), `src/ui/blog-article.tsx`, `src/ui/page-context.ts`, `src/ui/index.ts`, `tests/tool-island.test.tsx`.

- `BlogToolIsland` gets `mode`; replace keeps today's markup; append renders
  `<div data-blog-tool-part="static">` + `<div data-blog-tool-part="island">` (empty until hydrated). Children sit
  in a `Suspense` whose fallback is the static mount (replace) or nothing (append).
- `renderToolNode(node, islands)`; a tool without an island renders its static HTML only.
- `ArticleBody` renders tool nodes through `renderToolNode(node, context.tools ?? {})`; `BlogViewOptions.tools` and
  `BlogPageContext.tools`.
- `lazyToolIsland(load)`: `React.lazy` over the loader.

Done when: hydration tests cover replace, append, a lazy island (no load before mount, the static HTML until it
resolves) and a missing island, with no hydration error.

## Phase 3: Docs

**Files:** `modules/blog/README.md`, `modules/blog/CHANGELOG.md`.

- README tool block section rewritten (config file, client islands file, page wiring, modes, lazy, multi-tool).
- CHANGELOG `Unreleased`: breaking entry with step-by-step migration.

## Progress

- [x] Phase 1: da7311d (one commit with Phase 2: the `/ui` export of `defineToolBlock` and its new home change together)
- [x] Phase 2: da7311d
- [x] Phase 3: d44b4d7
