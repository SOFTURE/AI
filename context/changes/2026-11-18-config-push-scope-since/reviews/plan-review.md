# Plan review: config-push-scope-since

Reviewed: plan.md against change.md, research.md and both command files. Mode: autonomous.
Verdict: approve after the fix below (applied to plan.md).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | On a `pull_request` checkout `HEAD` is GitHub's synthetic merge commit, so `--since` would count the base's files as the push's. | Fixed: the README recipe checks out the head sha with full history; documented in research. |
| 2 | Suggestion | `merge-push-scope related` must keep `--` as the command separator when `--since` comes first. | Planned: `--since` is parsed only before `--`. |
| 3 | Suggestion | `--since HEAD` (nothing new) must not skip. | Covered: empty range answers 1 / `full`, as without `--since`. |

Contracts hold: exports keep their signatures (new optional trailing parameter), bins behave as before without the option.
