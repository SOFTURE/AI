# Implementation review: og-font-loader-414

Reviewed: the branch diff against plan.md, change.md and issue #414.
Verdict: **approve** after finding 1.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The blog wrapper spread `options` after `label`, so a caller passing `label: undefined` got core's `OG card: fonts` instead of the blog's label. | Fixed: `label: options.label ?? BLOG_LABEL`. |
| 2 | Check | Drift from plan: `OG_FONT_WEIGHTS` stays defined in the blog's `options.ts` too. Importing `@softure-ai/core/og` there would pull `node:fs` into the blog's root entry (read by `softure.config.ts` and the proxy); nine numbers are cheaper than that. | No change; noted. |
| 3 | Check | seo stays an optional peer of the blog: the blog imports only `@softure-ai/core/og`, a dependency it already has. | No change. |
| 4 | Check | The blog's OG, check CLI and adoption tests pass untouched, so its exports and messages are unchanged; core has 7 loader tests, seo asserts the re-export is the same function. | No change. |
| 5 | Check | `loadOgFonts` creates its loader on first call, not at import (seo has `sideEffects: false`). | No change. |
| 6 | Check | Docs: core README (entry), seo README (`### OG card fonts` with a route example), blog README pointer, three CHANGELOG `## Unreleased` entries; release order under change.md `## Before the next release`. | No change. |

Gates: see plan.md Progress.
