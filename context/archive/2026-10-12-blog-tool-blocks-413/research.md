---
change_id: blog-tool-blocks-413
---

# Research: blog-tool-blocks-413

Sources: `modules/blog/src/render/render-article.ts`, `src/render/article-markdown.ts`, `src/quality/rules/blocks.ts`,
`src/quality/catalog.ts`, `src/ui/blog-article.tsx`, `src/ui/index.ts`, `src/discovery/rss.ts`, `src/pages/body.ts`,
`modules/blog/README.md` (block and directive plugins), client components in other modules
(`modules/waitlist/src/ui/waitlist-form.tsx`), tests using `happy-dom`.

- `BlockPlugin` (`render-article.ts`) already covers directives (`syntax: "directive"`, `attributes` parsed by
  `parseDirectiveAttributes`, `null` when unreadable), a `markdown` form and node output. `renderArticle` emits node
  outputs as `{ kind: "node" }` segments; `ArticleBody` (`ui/blog-article.tsx`) renders them as they are. So a tool
  block is a directive plugin whose `render` returns a React node: no renderer change is needed.
- The Markdown answer (`toArticleMarkdown` → `replaceArticleBlocks`) uses `plugin.markdown`; without it the directive
  line stays.
- The gate's `checkDirectives` reports unknown names and unreadable attributes as `block-directive`; it has no hook for
  attributes that are readable but wrong. `checkBlockNumbers` shows the pattern for calling a plugin hook and turning a
  throw into a finding.
- RSS items carry no body (`discovery/rss.ts` header), so RSS needs nothing.
- A server component can pass a client component's element as `children` to another client component; the element's
  props must be serializable. Client components in this repo are single files starting with `"use client"` (tsc keeps
  the directive in `dist`). DOM tests use `// @vitest-environment happy-dom`; `react-dom/client` `hydrateRoot` is
  available.
- `/ui` imports nothing from Next (`ui/index.ts` header); the config (`softure.config.ts`) holds `blocks`, so the
  tool's `Island` module is imported wherever the config is; it must stay a plain component module.
