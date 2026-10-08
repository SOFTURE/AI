---
change_id: deploy-run-ops-on-server
title: "deploy: run an ops script or a read-only SQL report on the server through the forced-command gateway (issue #247)"
status: archived
roadmap_item: null
issue: 247
branch: claude/project-thread-qhr9r9
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close [issue #247](https://github.com/SOFTURE/AI/issues/247): an app should not need its own shell per ops script to
run it against production. Two commands of `@softure-ai/deploy`, both reaching the server through the forced SSH
command `init`'s `deploy.sh` already is:

1. `softure-deploy run --host=<ssh-host> <script> [--commit] [--key=value …]` runs an `@softure-ai/ops/scripts`
   script (`runOpsScript`: dry run by default, `--commit` writes, one transaction) inside the live app container;
2. `softure-deploy report --host=<ssh-host> <file.sql> [--key=value …]` runs a SQL file in a read-only transaction
   with `psql` in the postgres container, each `--key=value` a `psql -v` variable, and prints psql's table.

The app then keeps only its scripts' definitions (one runner file per script under `scripts/ops/`) and its `.sql`
reports. A reviewer checks `tests/remote-cli.test.ts`, the `run`/`report` blocks of `tests/server-files.test.ts`,
the README section "Ops scripts and reports on the server" and the CHANGELOG.

## Context

Issue #247, filed while FIRE_TRACKER adopted the packages: FIRE keeps ~500 lines of shell (`dostep.sh`, `haslo.sh`,
`prog-report.sh`, `kanaly-report.sh`) with one pattern: ssh to the host alias, a forced command or
`compose exec -T postgres psql`, dry run by default, arguments as `psql -v` variables, a small printed report.
Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue.

## Constraints

- The gateway stays a forced command: no code is shipped to the server. A script runs from the live image
  (`ops/<name>.mjs`, bundled at build time), so what runs in production is what the release built and reviewed.
- Nothing from the command line is ever evaluated by a shell: the server splits `SSH_ORIGINAL_COMMAND` on blanks
  and passes the words as an argument list; arguments are validated on both sides.
- Secrets stay off argv: `--<key>-file=<path>` is read on the operator's machine and sent on stdin.
- Scripts run with the app's own `DATABASE_URL` (the least-privilege `softure_app` role); reports as the same role.
- Shell stays within bash 3.2 and flags BSD and GNU tools both accept (AGENTS.md).
- English-only code and docs.

## Process notes

- Research: skipped as a separate file. FIRE_TRACKER is not in this checkout; the issue describes its pattern, and
  reading `deploy.sh.tmpl`, `Dockerfile.tmpl`, `docker-compose.yml.tmpl`, `initdb/01-roles.sql.tmpl`,
  `@softure-ai/ops/scripts` (`runOpsScript`, `--<key>-file`) and the CLI's `run.ts` answered every unknown; the
  findings are in plan.md's "Today" section.
- Framing: skipped. The issue proposes the shape; the open choice (ship the script vs. run it from the image) is
  settled in the plan's key decisions.
