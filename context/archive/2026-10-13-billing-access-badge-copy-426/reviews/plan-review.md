---
change_id: billing-access-badge-copy-426
reviewed: 2026-10-13
verdict: approved
---

# Plan review: billing-access-badge-copy-426

Checked plan.md against change.md, research.md, issue #426 and the files it touches.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | With `responsive`, both texts are in the DOM; a screen reader would read both unless the hidden one is `display: none` at every width. | Taken: the `full` slot is `sft:hidden sft:md:flex`, the `short` slot `sft:md:hidden`; both are display-based, so only one is ever exposed. Documented that `unstyled` callers must hide one themselves. |
| 2 | Warning | `unstyled` drops `sft:sr-only` from the prefix, which would show it. | Taken: README says an unstyled badge styles the `prefix` slot; the slot is named so it can. |
| 3 | Warning | Functions in `texts` cross from `CurrentAccessBadge` (server) to `AccessBadge` (server-safe, rendered on the server): fine; but a client component cannot pass them to a server component. | No change: `CurrentAccessBadge` is used from server components; README notes `texts` are functions. |
| 4 | Check | The default render must keep its exact DOM: new attributes only add `data-kind`/`data-tone`, no wrappers without `variant`/`srPrefix`. | Kept in the tests (existing exact `textContent` and class assertions stay). |
| 5 | Check | `findInlineCopy` (architecture guard) flags JSX text: the separator space after the prefix goes in as `{" "}`-free string concatenation of a prop value. | Taken into Phase 1. |

No Critical findings.
