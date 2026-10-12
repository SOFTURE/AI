---
change_id: blog-method-sections
reviewed: 2026-10-12
verdict: approved
---

# Plan review: blog-method-sections

Checked plan.md against change.md, research.md, issue #380, `src/ui/blog-method.tsx`, `src/next/pages.tsx`,
`src/ui/page-context.ts` and `tests/adoption-gaps-317.test.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | With `aiDisclosure` an app's own "who" text could still claim human editorial control, which the AI disclosure contradicts. The package cannot check prose. | Accepted: decision 3 documents it next to `sections`; the disclosure section itself cannot be dropped. |
| 2 | Warning | An app section with id `ai` collides with the disclosure's anchor. | Accepted: documented (decision 3, 4); a render-time throw would take a production page down over an anchor. |
| 3 | Check | Default rendering builds the same tuples into objects; the #317 tests pin the markup byte for byte, so a regression shows. | No change. |
| 4 | Check | A page prop instead of `view.methodSections` matches `cta`/`renderCard`; the issue allows either. | No change. |

No Critical findings. Framing skip is justified in change.md.
