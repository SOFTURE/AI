---
change_id: deploy-report-role
---

# Research: deploy-report-role

Sources: `tools/deploy/src/init/{answers,compose-facts,generate}.ts`, `src/cli/init-command.ts`,
`templates/docker/server/deploy.sh.tmpl`, `tests/init-cli.test.ts`, `README.md` (`init`).

- `getReportRole(facts, replacesCompose)` returns the compose role unless the compose file is replaced, else
  `DEFAULT_APP_ROLE`; `buildValues` puts it in `reportRole`, which only the `{{#database}}` block of `deploy.sh.tmpl`
  uses (`REPORT_ROLE={{reportRole}}`, then `psql --username "$REPORT_ROLE"` in `report`).
- `readComposeFacts` accepts a role only when it matches `ROLE` (`^[A-Za-z_][A-Za-z0-9_]{0,62}$`), because it lands
  unquoted in bash. A URL from a variable yields `null`, and `listComposeWarnings` prints the warning.
- Init answers go through `initAnswersSchema` (zod strict object, narrow patterns); the CLI maps flags to it in
  `runInit`. `planInitFiles` takes the answers, so a new optional answer reaches the template with no extra plumbing,
  and an adopting app's drift test that calls `planInitFiles` passes the same answer.
- The e2e writer (`scripts/write-e2e-app.ts`) and `tests/server-files.test.ts` build answers without the new key;
  an optional key keeps them valid.
