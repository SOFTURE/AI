# Plan review: mailing-adoption-gaps-322

Reviewed plan.md against change.md, issue #322 and the package on master `e13ae0c`. Mode: autonomous (decisions
taken, recorded here).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `softure-deploy run` passes only `--key` and `--key=value` words, so the positional content file of `campaign` cannot travel; and only one file goes over stdin, so a campaign's `html:` file cannot either. | Accepted: `--content-file` is added; the README says a campaign run that way takes its recipients from `listCampaignRecipients` and has no HTML file. |
| F2 | Warning | A dry-run preview signs a real link; printed for a real recipient it would be a working unsubscribe credential in a terminal log. | Accepted: the preview is rendered for the test address or a placeholder, and the CLI redacts the signature. |
| F3 | Suggestion | `lower()` in SQL depends on the database ctype; PGlite runs the C locale. | Accepted: tests cover ASCII case and Unicode whitespace; the README states the non-ASCII limit. |
| F4 | Suggestion | Refusing pasted links inside `sendCampaign` makes a re-run of an already registered campaign with such content throw. | Accepted: such content carries another recipient's credential and must never go out again. |

No finding blocks the plan.
