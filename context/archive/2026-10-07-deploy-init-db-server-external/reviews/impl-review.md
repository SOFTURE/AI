# Implementation review: deploy-init-db-server-external

Reviewed: commits `69ee1f1` (code and tests) and `37e3c85` (docs and version), against `plan.md`, `change.md` and
issue #184. Verdict: **approved**, no open findings.

## Plan conformance

| Item | Decision | Where | Evidence |
|---|---|---|---|
| Detection | D1 | `app-facts.ts` `isDbListedAsServerExternal`, `SERVER_EXTERNAL_LIST`, `DB_PACKAGE_LITERAL` | CLI tests: entry present, entry only in a comment next to the list (warns), no key (warns), list from a variable (no warning) |
| Optional field | D2 | `AppFacts.isDbServerExternal?` | hand-built facts in `generate.test.ts` and `server-files.test.ts` compile unchanged; `listWarnings` checks `=== false` |
| Warning text | D3 | `init-command.ts` `listWarnings` | exact line asserted in `init-cli.test.ts` |
| Order, no-config case | D4 | `listWarnings` | "prints it after the standalone warning"; no config keeps its single warning (existing path, unchanged) |
| Issue: app without `@softure-ai/db` | — | `facts.hasDatabase` guard | "gives no warning in an app without @softure-ai/db" |
| README, 0.1.4 | Phase 2 | `tools/deploy/README.md`, `package.json`, `package-lock.json`, workflow defaults | `tests/repo/deploy-workflows.test.ts` green after the defaults moved |

The three warning tests were seen red before the code (missing second line), the three no-warning tests green
before and after.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Suggestion | The default `next.config.ts` of `init-cli.test.ts` now lists `@softure-ai/db`; the first test (a database app) would otherwise print the new warning, which is the intended behaviour. | Accepted: the default stands for a well-configured app; the warning cases set their own config. |
| R2 | Suggestion | A commented-out `// serverExternalPackages: ["@softure-ai/db"]` counts as listed (text matching, like `isStandalone`). | Accepted: the check leans towards no warning on unusual shapes; a false warning would be noise in every `init` run. |
| R3 | Suggestion | `deploy-app.yml` and `deploy-report.yml` changed outside `tools/deploy` (plan drift, recorded in Decisions (auto)). | Accepted: the repository test ties their `deploy-cli-version` default to the package version, as for earlier bumps. |

## Gates

`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm test` (318 files passed, 6 skipped),
`npm run build`: green before `37e3c85`.
