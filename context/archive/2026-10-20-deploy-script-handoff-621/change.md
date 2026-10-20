---
change_id: deploy-script-handoff-621
title: "deploy: a release runs the deploy.sh it ships, so a new service starts in that release (issue #621)"
status: archived
roadmap_item: null
issue: 621
branch: claude/project-thread-4a6w82
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20
---

## Intent

Close [issue #621](https://github.com/SOFTURE/AI/issues/621): `deploy.sh` replaces itself by a rename and the running
copy finishes the release, so a release whose new `deploy.sh` starts a new service (the jobs `worker`) is executed by
the old script, which never starts it. The deploy still reports `result|ok`. A release must run the server script it
ships.

## Context

Labels: `bug`, `pkg: deploy`. deploy 0.4.3 is the latest on npm. Releases are batched by the coordinator: no version
bump, the CHANGELOG gets `## Unreleased`. `deploy.sh` belongs to the app once `init` wrote it; the migration is
described, never applied to an app's repository.

## Constraints

- Works with the scripts already on servers: a rollback to a tag whose `deploy.sh` predates this change still deploys.
- One lock for the whole release: no window in which a `maintain` run can slip in between the two scripts.
- The step and result lines the workflow reads stay one set per release, printed by the script that ran it.
- bash 3.2 and BSD/GNU-neutral flags (AGENTS.md).

## Notes

- Framing: skipped. The issue names the problem, the place and three directions.
