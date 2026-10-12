---
change_id: deploy-report-role
title: "deploy: name the report role when init cannot read it (issue #383)"
status: archived
roadmap_item: null
issue: 383
branch: claude/project-thread-vgsti1
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #383](https://github.com/SOFTURE/AI/issues/383) (labels `bug`, `pkg: deploy`, `adoption`):
`softure-deploy init` takes `REPORT_ROLE` in `deploy.sh` from the role in the `app` service's `DATABASE_URL` of a kept
compose file, else `softure_app`. An app whose URL comes whole from a variable (`DATABASE_URL: ${DATABASE_URL:?}`)
gets `softure_app` and a warning, with no way to name its real role, so `softure-deploy report` fails on the server.

Outcome: `init --report-role=<role>` names the role `deploy.sh`'s report reads as. It is an init answer, validated
like the role init reads from the compose file, and it wins over that role and the default, so an app's drift guard
that renders `planInitFiles` with the same answers gets the same `deploy.sh`.

A reviewer checks `tools/deploy/tests/init-cli.test.ts`, `src/init/answers.test.ts`, `src/init/generate.test.ts`, the
README `init` section and the CHANGELOG `Unreleased` entry.

## Context

deploy is at 0.1.9 on master. Releases are batched by the coordinator, so this change bumps no version: the CHANGELOG
gets an `## Unreleased` section.

## Constraints

- Without `--report-role` nothing changes: the compose role, else `softure_app`, and the same warning.
- The value lands unquoted in bash and as psql's `--username`: the same pattern as the compose role.

## Process notes

- Framing: skipped. The issue names the cause (`getReportRole`) and two possible asks.

## Decisions (auto)

- The init answer (`--report-role`), not `database.reportRole` in `deploy.json`: `deploy.sh` does not read
  `deploy.json` for its own constants today, and an answer keeps the value in the file the drift guard compares.
- Precedence: the answer, then the role of a kept compose file, then `softure_app`. With `--force` the answer still
  wins (the owner named it); the missing-role warning is not printed when the answer is given, and otherwise names
  `--report-role`.
- Without a database part the answer is accepted and unused, like `--tables`.
