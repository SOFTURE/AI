# Plan review: deploy-verify-app-checks

Reviewed plan.md against change.md and issue #309. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Major | A sitemap's `<loc>` names the production host; joining it to a verified URL with a path prefix would double the prefix. | Accepted in D5: the entry's path is requested on the verified URL's origin. |
| F2 | Suggestion | A sitemap index (nested sitemaps) is not followed. | Accepted as a limit, documented: point `sitemap` at the child sitemap that lists the entries. |
| F3 | Suggestion | "Exactly one per group" (robots.txt) is a count per group, not per file. | Accepted as a limit: the count is per scope; per-group parsing is robots-specific and stays out of the engine. |
| F4 | Minor | The goal line named a key that does not exist. | Fixed in plan.md (`originSeverity`). |

No finding blocks the plan.
