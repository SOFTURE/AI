---
change_id: blog-method-sections
---

# Research: method page sections (issue #380)

## Today (master `0949d88`)

- `modules/blog/src/ui/blog-method.tsx`: `SECTIONS` lists five `[id, titleKey, bodyKey]` tuples over
  `messages.method`; `getSections(isAiDisclosed)` prepends `["ai", "aiTitle", "aiBody"]` and swaps "who" to
  `whoBodyAi` with `aiDisclosure`. Each renders `<section id aria-labelledby class=section><h2/><p/></section>`,
  then `BlogFooterNote` (with `methodPath: null`, so the note does not link to the page itself).
- `modules/blog/src/next/pages.tsx`: `BlogMethodPage({ view }: BlogViewPageProps)`; the other pages carry their
  page-specific content as their own props (`BlogIndexPageProps.cta`, `renderCard`; `BlogArticlePageProps.afterArticle`),
  while `view` (`BlogViewOptions` in `ui/page-context.ts`) is the look every page shares (classes, `unstyled`, layout,
  disclaimer).
- `BlogFooterNote` already renders a `ReactNode` disclaimer: a string in a `<p>`, any other node as given.
- Tests: `tests/adoption-gaps-317.test.tsx` pins the default method markup and the AI disclosure order;
  `tests/next/pages.test.tsx` pins `BlogMethodPage` mounting and its 404.
- Docs: README "The package's views in the app's look" (`view`, `renderCard`), CHANGELOG `## Unreleased` (#379).

## Findings

- A page prop fits the existing split better than `view.methodSections`: `view` is one object an app passes to
  every page, and a method-only field there would be ignored by four of five pages.
- The string-or-node rule of `disclaimer` gives plain-string bodies the same `<p>` as today, so an app moving its
  copy over keeps its markup.
