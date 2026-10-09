---
change_id: blog-quality-helpers
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Plan review: blog-quality-helpers

Checked plan.md against change.md, issue #318, `src/quality/*`, `src/render/render-article.ts`, `src/proxy/index.ts`,
`src/next/data.ts`, `src/pages/listing.ts` and `src/cli/*`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Comparing block numbers as strings would miss `4.5` against `4,5%` in a Polish text. | Accepted: decision 1 compares parsed values; a string from the plugin is parsed in the ruleset's notation. |
| 2 | Warning | A `RegExp` with the `g` flag keeps `lastIndex` between `test` calls and skips matches. | Accepted: fact patterns are matched with `String.search`, which ignores `lastIndex`. |
| 3 | Warning | `refresh` as a command name could be confused with the cache refresh route (`refreshBlogCache`). | No change: the usage text says it lists texts to refresh and never connects; the route is not a command. |
| 4 | Suggestion | `readArticleDir` throwing would be shorter for scripts. | No change: expected failures are values (AGENTS.md); a script writes `if (!result.ok) throw`. |
| 5 | Check | Without `numbers` or `facts` the catalog and findings are unchanged; existing tests stay green. | No change. |

No Critical findings. Research and framing skips are justified in change.md.
