---
change_id: blog-tool-blocks-413
reviewed: 2026-10-12
verdict: approved
---

# Plan review: blog-tool-blocks-413

Checked plan.md against change.md, research.md, issue #413 and the blog's block plugin code.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `Island` as a function prop cannot cross the server/client boundary; pass `<Island {...props} />` as `children` of the client mount, so only serializable props travel. | Taken into Phase 2. |
| 2 | Warning | The mount must render the same markup on the server and in the first client render, or React reports a hydration mismatch; use `useSyncExternalStore` with a `false` server snapshot rather than an effect that sets state. | Taken into Phase 2 (and the hydration test). |
| 3 | Warning | `validate` must not run for unreadable attributes (`null`): those already have their own message. | Taken into Phase 1. |
| 4 | Check | `defineToolBlock` returns `BlockPlugin<ReactNode>`; `blog({ blocks })` takes `BlockPlugin` with `unknown` nodes, which it accepts (covariant output). | Assert with a typed test. |
| 5 | Check | `/ui` stays free of Next imports; the `"use client"` file stays first-line (repo `packages` tests and the build keep it). | Check in the build. |

No Critical findings.
