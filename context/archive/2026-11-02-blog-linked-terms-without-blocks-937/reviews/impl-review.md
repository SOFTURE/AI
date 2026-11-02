---
change_id: blog-linked-terms-without-blocks-937
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: blog-linked-terms-without-blocks-937

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | SUGGESTION | `findLinkedTerms` must match `renderArticle(...).linkedTerms` for every input shape, not only prose. | Held by `render-glossary.test.ts` (`it.each` over mentions, manual links, headings, footnotes, fence and directive blocks, plain code). |
| F2 | SUGGESTION | The page test must fail on the old code. | Checked: with the old `findArticlesLinkingTerm` the plugin's `render` throws and the test fails. |

Gates: typecheck, ESLint on the touched files, the language gate, blog tests for render, pages and next (76) green.
