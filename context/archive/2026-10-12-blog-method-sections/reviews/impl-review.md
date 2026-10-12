---
change_id: blog-method-sections
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: blog-method-sections

Checked `2f8b4b6` against plan.md, change.md and issue #380: `src/ui/blog-method.tsx`, `src/ui/index.ts`,
`src/next/pages.tsx`, `src/next/index.ts`, `tests/adoption-gaps-380.test.tsx`, `tests/next/pages.test.tsx`, README
"The package's views in the app's look", CHANGELOG.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Without `sections` the default list is built from the same five keys with `whoBodyAi` under the disclosure; the #317 tests pin the markup byte for byte and pass unchanged. | No change. |
| 2 | Check | The disclosure section is prepended outside the app's list, so `sections` cannot drop it; test "keeps the AI disclosure first" covers it. | No change. |
| 3 | Check | `BlogMethodPage` still answers 404 without `methodPage`, with or without sections (pages test). | No change. |
| 4 | Check | A string body keeps today's `<p>`; any other node renders as given, the same rule as `disclaimer`. | No change. |
| 5 | Check | Duplicate ids (or an app id `ai` under the disclosure) give duplicate anchors and a React key warning; documented in the README as decided in the plan review. | No change. |

Gates: typecheck, lint (ESLint and the language gate), `vitest run modules/blog tests/repo` green (1108 passed).
