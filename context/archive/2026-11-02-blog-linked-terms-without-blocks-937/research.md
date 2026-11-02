# Research: blog-linked-terms-without-blocks-937

- `linkedTerms` is filled by the core rule `blog_glossary_links` (`render-article.ts`, `addGlossaryLinks`), which runs
  inside `md.parse`. The renderer, the block plugins' `render`, images and external links add nothing to it.
- A plugin block is a `blog_block` token (fence or leaf directive), never an `inline` token, so it never contributes
  a link. The plugins must still be registered for the parse: without them a `::chart{...}` directive line would be a
  paragraph whose text could link a term.
- `termHref` matters (manual links are matched by path), `selfSlug` matters (a term page never links itself).
- So parsing with the same markdown-it setup and skipping the render gives exactly the same `linkedTerms`, without
  calling any plugin's `render`.
- Memoising per content hash (issue's optional ask) is left out: the parse alone is cheap, and a cache keyed on the
  glossary would add invalidation for little gain.
