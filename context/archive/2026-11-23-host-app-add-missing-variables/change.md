---
change_id: host-app-add-missing-variables
title: "host: app add no longer reports variables it set, or that exist, as still to set (issue #1434)"
status: archived
roadmap_item: null
issue: 1434
branch: claude/project-thread-p6s6wa
created: 2026-11-23
updated: 2026-11-23
archived_at: 2026-11-23
---

## Intent

`softure-host app add` lists only the names the app's compose file requires that are really missing: neither the
variables it has just set (`APP_HOST`, `EDGE_NETWORK`) nor the repository and Environment variables that already exist
are reported as "still to set by hand".

## Context

Issue #1434 (no labels). `app-add-command.ts` subtracts the existing Environment secrets and `plan.secrets` from
`findRequiredNames(compose)`, but no variables. The release workflow renders `.env.prod` from `toJSON(secrets)` and
`toJSON(vars)`, so a variable satisfies a required name as well as a secret.

## Scope

- `tools/host`: list the repository and Environment variable names; subtract them and `plan.variables` from the missing
  names; the report line says a missing name can be a secret or a variable.
- Tests from the issue's acceptance criteria; README step 6 and CHANGELOG `## Unreleased`.

## Constraints

- `--check` still reads nothing under an Environment that does not exist.
- Names only: variable values are never requested.

## Notes

- frame skipped: the issue names the defect and the fix; no product question.

## Done

- `softure-host app add` subtracts the variables it has just written (`APP_HOST`, `EDGE_NETWORK`) and the existing
  repository and `production` variables from the names the compose file requires; the line lists only names set
  nowhere and says each can be a `production` secret or a repository variable.
- Tests from the issue's acceptance criteria in `tools/host/src/cli/cli.test.ts`; README step 6, CHANGELOG Unreleased.
- Release: `@softure-ai/host` next release (batched by the coordinator).
