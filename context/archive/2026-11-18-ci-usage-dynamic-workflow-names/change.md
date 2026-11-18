---
change_id: ci-usage-dynamic-workflow-names
title: "ci-usage reports GitHub's dynamic workflows under a stable name"
status: archived
roadmap_item: null
issue: 1369
branch: claude/project-thread-xvy7o9
created: 2026-11-18
updated: 2026-11-18
archived_at: 2026-11-18
---

## Intent

The report names each workflow the same way every week. GitHub's dynamic workflows (CodeQL default setup,
Dependabot) get a readable, stable name instead of the title of one of their runs ("PR #1240").

## Context

Issue #1369, found in the first live report (#1368). The owner asked to fix it once confirmed as a real bug.

## Notes

- Frame skipped: the cause is known from the report and the code (`summarizeUsage` takes the first job's
  `workflowName`, which GitHub sets to the run title for `dynamic/...` paths).

## Done

- `@softure-ai/ci-usage` 0.1.2: `getWorkflowName` names `dynamic/...` workflows from their path. Release: right after
  the merge (`auto-release.yml`, `ci-usage`), then a `ci-usage-self.yml` run shows "CodeQL (default setup)".
