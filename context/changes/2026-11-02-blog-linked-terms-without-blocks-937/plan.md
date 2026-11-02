# Plan: blog-linked-terms-without-blocks-937

## Approach
1. `render-article.ts`: export `findLinkedTerms(markdown, options)`, which builds the same markdown-it instance as
   `renderArticle`, parses and returns `state.linkedTerms`, never calling a block plugin's `render`.
2. `pages/body.ts`: extract the shared render options into one function; `findArticlesLinkingTerm` uses
   `findLinkedTerms` instead of `renderPageBody`.
3. Tests: `findLinkedTerms` equals `renderArticle(...).linkedTerms` (manual link, first mention, self slug,
   footnote, heading, directive and fence blocks); `findArticlesLinkingTerm` never calls a plugin's `render`
   (a plugin that throws in `render`). Changelog entry under Unreleased.

## Decisions (auto)
- D1 No memoisation: the parse is cheap once blocks are not run; no cache to invalidate.
- D2 `findLinkedTerms` is exported from `/render` too: an app that calls `renderPageBody` for the links can switch.

## Progress
- [ ] Phase 1: findLinkedTerms, findArticlesLinkingTerm, tests, docs
