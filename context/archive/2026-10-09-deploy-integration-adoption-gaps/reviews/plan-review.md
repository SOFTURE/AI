# Plan review: deploy-integration-adoption-gaps

Reviewed plan.md against change.md, issue #308 and the #248 code (`tools/deploy/src/integration`,
`deploy-integration.yml`). Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Major | The note schema is strict: a `flaky` key always written would make the 0.1.7 `lookup` call every new note invalid. | D1 writes the key only when non-empty; mixed versions differ only on runs with flaky tests. |
| F2 | Major | A registry login in the suite job would leave a token where the app's code runs. | D6 logs in with a throwaway `DOCKER_CONFIG`, pulls and deletes it in one step before set-up. |
| F3 | Minor | Accepting tag refs in general would let a tag push of an integration caller run the suite with no meaning. | D6 accepts `refs/tags/*` only with `image` set (the release path). |
| F4 | Suggestion | A `migrate-notes` command was the issue's other option. | Not taken (change.md, Decisions): the old notes' format is the app's own. |

No finding blocks the plan after the decisions above.
