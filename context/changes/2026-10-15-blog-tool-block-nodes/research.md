---
change_id: blog-tool-block-nodes
---

# Research: tool blocks as data (issue #509)

## Current state (master f854efc)

- `defineToolBlock` (`modules/blog/src/ui/tool-block.tsx`, exported from `/ui`) takes `name`, `schema`,
  `renderStatic`, `Island` (a component) and returns `BlockPlugin<ReactNode>` whose `render` returns
  `{ kind: "node", node: <BlogToolIsland …><Island …/></BlogToolIsland> }`. The module imports React (JSX), so a
  config that registers the plugin pulls React into every graph that loads the config.
- `BlogToolIsland` (`src/ui/tool-island.tsx`, `"use client"`) renders the static HTML in the mount point until
  hydration (`useSyncExternalStore`), then the children in its place. Replace only.
- `ArticleBody` (`src/ui/blog-article.tsx`) renders a node segment as it is (`{segment.node}`): a plain object would
  crash React. It gets `context` (class slots) from `BlogArticleView` and `GlossaryTermView`.
- The ready-made pages take `view: BlogViewOptions` (class names, layout, disclaimer); `getViewContext` spreads the
  view into `BlogPageContext`, which reaches `ArticleBody` as `context`.
- The root entry, `render/` and `server/` are React-free today (no `react` import), so a React-free
  `defineToolBlock` fits in `render/` and can be exported from the root and `/server`.
- `BlockPlugin` has one static `requires` list; the gate checks it per block (`checkBlockRequires`).

## Options

1. **Data node + page-side island map (chosen).** `render` returns `{ kind: "node", node: BlogToolNode }` with
   `{ kind: "blog-tool", directive, tool, props, html, mode, className }` (serializable). The page renders tool
   nodes through `renderToolNode(node, islands)`; the island map (tool name → client component) reaches the pages as
   `view.tools`. Lazy loading is a client helper, `lazyToolIsland(() => import("./x"))`, called in the app's own
   `"use client"` module: `React.lazy`, rendered only after hydration, so the import runs after mount; the mount
   point keeps the static HTML (replace) or nothing (append) as the Suspense fallback.
2. `loadIsland` on the definition (the issue's literal ask 2). Keeps the island's module in the config graph (a
   bundler resolves every `import()` it can reach) and a function cannot cross from a server component to the
   client island. Rejected; option 1's `lazyToolIsland` gives the same behaviour on the page side.

## Asks

- Ask 1 (`mode: "replace" | "append"`): append renders the static HTML in its own element and an island element
  after it, empty on the server and in the first client render.
- Ask 2 (lazy): `lazyToolIsland`.
- Ask 3 (no React in the plugin): `defineToolBlock` moves to a React-free module (root and `/server`); `/ui` gets
  `renderToolNode`, `isBlogToolNode` and the island map type.
- Ask 4 (one directive, several tools): `defineToolBlocks({ name, tools })`; the `type` attribute picks the tool and
  the rest of the attributes go to that tool's schema. An unknown or missing `type` is a `block-directive` finding.
