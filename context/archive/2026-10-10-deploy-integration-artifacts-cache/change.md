---
change_id: deploy-integration-artifacts-cache
title: "deploy-integration.yml: failure artifacts, sparse checkout, npm cache (issue #368)"
status: archived
roadmap_item: null
issue: 368
branch: claude/project-thread-9mm1z7
created: 2026-10-10
updated: 2026-10-10
archived_at: 2026-10-10
---

## Intent

Close [issue #368](https://github.com/SOFTURE/AI/issues/368): an adopting app that moved its remote integration run
onto `deploy-integration.yml` (deploy 0.1.8) lost three things its own workflow had.

1. `artifact-paths`: the suite's own debugging files (Playwright traces, screenshots) are uploaded when the suite is
   red or the job fails, next to the report.
2. `sparse-checkout`: patterns passed to `actions/checkout` (cone mode off); empty, the default, checks out the whole
   tree as today.
3. `node-cache`: `setup-node` caches the package manager's downloads (`npm` default, empty to disable).

## Context

Issue #368 (labels `enhancement`, `pkg: deploy`, `adoption`). No roadmap item; the PR closes the issue.
`@softure-ai/deploy` 0.1.8 is released, so the change ships as 0.1.9 (the workflows' `deploy-cli-version` default
follows the package version, a repository test requires it).

## Constraints

- Scope: `.github/workflows/deploy-integration.yml`, the `deploy-cli-version` default of the other two deploy
  workflows (version), `tools/deploy` (README, CHANGELOG, example caller, version), `tests/repo/deploy-workflows.test.ts`.
- The test job keeps `contents: read` and no credentials; no new input reaches a shell unvalidated.
- Shell stays within bash 3.2 (AGENTS.md).

## Process notes

- Research: skipped. The issue names the three gaps and the remedies; the inputs map one to one onto documented
  options of `actions/checkout` (`sparse-checkout`, `sparse-checkout-cone-mode`), `actions/setup-node` (`cache`) and
  `actions/upload-artifact` (multi-line `path`).
- Framing: skipped. The problem is observed by the adopting app and the issue's proposal is taken.
