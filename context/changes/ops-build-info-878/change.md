---
change_id: ops-build-info-878
title: "ops, deploy: build info (release, commit, built and started times) and a smoke check that production runs the released tag (issue #878)"
status: in_progress
roadmap_item: null
issue: 878
branch: claude/project-thread-0g1cpe
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close the ops and deploy part of [issue #878](https://github.com/SOFTURE/AI/issues/878): `deploy-app.yml` waits for
the health route and runs `verify`, but nothing proves the container answering is the release just tagged. A stale
container, a failed pull or a rolled-back compose project still passes.

- `@softure-ai/ops` answers the build: the release tag (container environment, read per request), the commit and the
  build time (inlined at build by a `next.config` helper), the process start time, and an optional changelog.
- `@softure-ai/deploy` checks it after a deploy: `softure-deploy smoke` and a smoke step in the deploy action and
  `deploy-app.yml`, which fail the run when the release, the commit or the start time do not match, and write
  `Smoke check: passed/failed` to the job summary. `softure-deploy changelog` writes the newest roadmaps' finished
  items for the build to embed.

## Context

Labels: `enhancement`, `pkg: ops`, `pkg: deploy`. No release in this change: the coordinator closes the wave with one
batch release.

## Constraints

- Out of scope: the optional MCP `get_server_info` tool of `@softure-ai/mcp-access`; it depends on #877 (the tool
  list) and follows as a small change after #877 merges.
- Opt-in: an app that does not set `build-info-path` deploys exactly as before.
- The build info route carries only the build, never user data, and is not cached.
- Shell steps stay within bash 3.2 and BSD/GNU-neutral flags (AGENTS.md).

## Notes

- Framing: skipped. The issue names the problem and the proposal.
