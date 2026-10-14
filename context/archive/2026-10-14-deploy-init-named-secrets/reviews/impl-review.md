# Implementation review: deploy-init-named-secrets

Reviewed 2026-10-14 against `plan.md` on `5badde2`: the template, the generator, the example, the tests, README and
CHANGELOG. actionlint 1.7.12 passes on the example and on the generated caller with and without required secrets.

| # | Finding | Severity | Decision |
|---|---|---|---|
| F1 | The generated caller still has no `report` job, unlike the example. | Suggestion | Plan D2: unchanged behaviour; the action uploads `deploy-report`, so an app can add the job as the example shows. |
| F2 | The no-secret comment in the template sits in the `with:` mapping; YAML keeps it a comment. | Suggestion | Verified by the no-database test parsing the file. |
| F3 | The CodeQL shape guard now reads every example and caller template, so a future template with `toJSON(secrets)` fails `npm test`. | Suggestion | Intended (issue #486). |
| F4 | README called the single form "needs the whole secrets context"; it can also be built from named secrets, which CodeQL flags too. | Warning | Fixed: the wording names the flagged expression instead. |

No blocking finding. Verdict: done.
