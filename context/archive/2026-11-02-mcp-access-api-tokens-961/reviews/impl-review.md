---
change_id: mcp-access-api-tokens-961
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: mcp-access-api-tokens-961

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | CRITICAL (checked) | Kind separation: `findValidToken` filters on `kind`, so a legacy-pattern or `sftmcp_` value never passes `requireApiToken` and an API token never opens the endpoint. | Holds; covered both ways in `tests/api-tokens-961.test.ts`, plus the database check. |
| F2 | WARNING | The adoption test verified tokens after adopting files 1 and 2 only; with 0004 the later files must run, as on an app's next deploy. | Fixed in p2: the test runs `migrate` after `adoptModule`. |
| F3 | WARNING | A scope the app later drops from `apiTokens.scopes` stays on old tokens. | Accepted: a route cannot ask for an undeclared scope (it throws), so the stale scope grants nothing; documented by behaviour. |
| F4 | SUGGESTION | Both issue forms label their field "Name"; each sits under its own heading. | Kept: copy is overridable (`apiIssue.name`). |
| F5 | SUGGESTION | The token page still needs `serverName` and the MCP routes declared in the manifest for an app without MCP. | Out of scope; README "Without MCP" says to mount only the page; a split package can follow if an app needs it. |

Gates: `npm run typecheck`, `npm run lint` green; `vitest run modules/mcp-access tests/repo` 934 passed (the deploy-workflows suite needs `ssh-keygen`, installed for the pre-push run).
