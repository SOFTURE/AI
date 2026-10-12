---
change_id: blog-method-sections
status: implementing
---

# Plan: the method page takes the app's own sections (issue #380)

Input: change.md, research.md. Complexity: small (one view and one page of one package).

## Decisions (auto)

1. **A page prop, not `view.methodSections`.** `BlogMethodPage({ view, sections })` (`BlogMethodPageProps`) and
   `BlogMethodView({ context, sections })`. `view` is the look shared by every page; page-specific content is a page
   prop, as `cta`, `renderCard` and `afterArticle` are. The issue offers either shape.
2. **`BlogMethodSection = { id: string; title: string; body: ReactNode }`**, exported from `/ui` (and the type from
   `/next`). A string body renders in a `<p>` (today's markup), any other node as given, like `disclaimer`. `id` is the
   section's anchor and heading id, as today.
3. **Replacement, not merge.** `sections` replaces the five default sections (an empty array leaves none). With
   `aiDisclosure` the AI section still opens the page; the package's "who" text, AI or not, is not added. The README
   tells the app that its own "who" section must not claim human editorial control when the texts are AI-written,
   and that `ai` is taken as an id then.
4. **No runtime id check.** Duplicate ids are an app's markup bug, documented rather than thrown at render time.

## Phase 1: tests and implementation

One phase: the tests pass `sections`, which does not type-check before the prop exists (the pre-commit hook runs
typecheck).

### Tests

- `modules/blog/tests/adoption-gaps-380.test.tsx`:
  - the view with sections renders them in order with a node body as given (a list, a link, a `mailto:`) and a string
    body in a `<p>`, and none of the default section ids;
  - with `aiDisclosure` the AI section comes first, then the app's sections, and neither `whoBody` nor `whoBodyAi`;
  - the footer note still closes the page;
  - an empty array leaves only the footer (and the AI section with the disclosure);
  - `BlogMethodPage({ sections })` passes them through (pages test, mounted config).
- The existing default-markup tests stay unchanged.

### Implementation

- `ui/blog-method.tsx`: `BlogMethodSection`, `BlogMethodViewProps`; resolve the default sections to
  `BlogMethodSection` from the copy, prepend the AI section to either list; render a string body in `<p>`.
- `ui/index.ts`: export `BlogMethodSection`, `BlogMethodViewProps`.
- `next/pages.tsx`, `next/index.ts`: `BlogMethodPageProps extends BlogViewPageProps { sections? }`.
- README "The package's views in the app's look", the pages header comment, CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: tests and implementation (SHA in the next commit; tests run red first: 3 of 5 failed)
