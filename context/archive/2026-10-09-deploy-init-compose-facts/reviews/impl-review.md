# Implementation review: deploy-init-compose-facts

Reviewed: commits `0ef8df6` (code, templates and tests) and `60558a5` (README, examples, CHANGELOG, repository test),
against `plan.md`, `change.md` and issue #297. Verdict: **approved**, no open findings.

## Plan conformance

| Item | Decision | Where | Evidence |
|---|---|---|---|
| Compose facts | D1 | `src/init/compose-facts.ts` `readComposeFacts` | 8 unit tests: init's own compose file, FIRE's shape (`postgres:17-alpine`, `fire_tracker_app`), quoted image with registry and list-form env, `pgvector:pg17` and `postgis:17-3.5-alpine`, unreadable tags, variable/encoded/missing roles, other services ignored, empty file |
| Facts field | D2 | `AppFacts.compose?`, `readAppFacts` | hand-built facts in `generate.test.ts` and `server-files.test.ts` compile unchanged |
| Values | D3 | `getPostgresVersion`, `getReportRole`, `REPORT_ROLE={{reportRole}}` | CLI: kept PG17 compose → `-pg17`, `postgresql17-client`, `REPORT_ROLE=fire_tracker_app`; `--force` → `postgres:17` in the new compose and `softure_app` (review F1) |
| Warnings | D4 | `listComposeWarnings` | CLI: `latest` and a variable role give both warnings and the defaults; an app without a database reads nothing |
| Workflow ref | D5 | `answers.workflowsRef`, `listWorkflowsRefWarnings`, both caller templates | CLI: SHA in both `uses:` lines and no warning; `@master` plus the warning without it; no warning when both callers are kept; a non-SHA ref refused before anything is written |
| Docs | Phase 2 | README §Deploy workflow "Which ref callers pin", §init, §run/report; CHANGELOG `## Unreleased`; examples `@master` | `tests/repo/deploy-workflows.test.ts` and the release-caller equality test green |

The new tests were seen red (15 failures) before the code, then green.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Suggestion | The line-based reader misses a compose file that sets the image through a YAML anchor or `extends`. | Accepted: such a file gives null and a warning naming the default, the behaviour before this change plus a hint. |
| R2 | Suggestion | The README example of `git ls-remote` names `deploy@0.1.6` and will age. | Accepted: it is an example of the form; the warning `init` prints names the running version. |
| R3 | Suggestion | `master` as the default ref follows every merge. | Accepted (Decisions (auto)): it works out of the box, and the warning gives the immutable pin each run that writes a caller. |

## Gates

`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm test` (380 files passed, 7 skipped; 5611
tests), `npm run build`: all green.
