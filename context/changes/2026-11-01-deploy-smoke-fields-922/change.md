---
change_id: deploy-smoke-fields-922
title: "ops, deploy: the smoke check compares the app's own build info fields and hands its result to later jobs (issue #922)"
status: in_progress
roadmap_item: null
issue: 922
branch: claude/project-thread-kuni86
created: 2026-11-01
updated: 2026-11-01
---

## Intent

Close [issue #922](https://github.com/SOFTURE/AI/issues/922): an adopting app with its own build info route and smoke
check cannot move onto `createBuildInfoRoute` + `softure-deploy smoke` (ops 0.2.2, deploy 0.4.10) without losing:

- app fields in the comparison (e.g. the MCP tool list version and tool count): the route has to answer them and the
  smoke check has to compare them with expected values;
- a smoke result a later job of the caller can gate on (`smoke-result` output);
- extra roadmap columns in `softure-deploy changelog` (e.g. the finding numbers an item closes).

## Context

Labels: `enhancement`, `pkg: ops`, `pkg: deploy`, `adoption`. Follows #878 (`context/archive/2026-10-29-ops-build-info-878/`).
No release in this change: the coordinator releases the batch.

## Constraints

- Opt-in: an app that sets none of the new options deploys and answers exactly as before.
- The build info route is public: app fields and changelog columns are the app's choice and documented as public.
- Shell steps stay within bash 3.2 and BSD/GNU-neutral flags (AGENTS.md).
- No change to any app repository.

## Notes

- Framing: skipped. The issue names the problem and the proposal.
