---
change_id: deploy-integration-ref-delete-684
title: "deploy: the integration workflow deletes its ref through git/refs (issue #684)"
status: active
roadmap_item: null
issue: 684
branch: claude/project-thread-hj72x4
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #684](https://github.com/SOFTURE/AI/issues/684): the `record` job's step "Delete the integration ref" in
`deploy-integration.yml` calls `DELETE repos/<o>/<r>/git/heads/<branch>`, which is not an endpoint. GitHub answers
404, the step exits 1, every `integration/*` run ends red and its ref is never deleted. Call
`DELETE repos/<o>/<r>/git/refs/heads/<branch>` instead, and make the test assert the endpoint, so a wrong path fails.

## Context

Labels: `bug`, `pkg: deploy`. Touches `.github/workflows/deploy-integration.yml`,
`tests/repo/deploy-workflows.test.ts` and `tools/deploy/CHANGELOG.md`. No release in this change: the coordinator
releases in the next batch.

## Constraints

- A ref that is already gone (GitHub's 422 "Reference does not exist") still passes; any other failure still fails.
- Refs outside the prefix (main, tags) are never touched.

## Out of scope

- Deleting the stale `integration/*` refs an adopting app already has: the app removes them itself.

## Notes

- Framing: skipped. The issue names the defect and the fix.
