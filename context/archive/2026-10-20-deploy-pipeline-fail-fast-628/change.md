---
change_id: deploy-pipeline-fail-fast-628
title: "A failed release attempt stops at once: cancel-on-failure watchers and an early deploy preflight (issue #628)"
status: archived
roadmap_item: null
issue: 628
branch: claude/project-thread-jp4cc5
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20
---

## Intent

Close [issue #628](https://github.com/SOFTURE/AI/issues/628): an adopting app's release pipeline (checks, image,
integration, deploy) keeps paying for jobs after a part has already failed (a red image while four unit shards run on
for ~40 minutes), and it checks the deploy prerequisites (SSH secrets, known hosts, the rendered env names) only at
the very end, after 70+ minutes of green work. Give callers a fail-fast pattern and a preflight, without removing a gate.

## Context

Labels: `pkg: deploy`. Workflows and the action are called at `master` or a pinned SHA, so they reach callers without
a package release; README, CHANGELOG and the new example ship with the next `@softure-ai/deploy` release
(`## Unreleased`, batched with #627).

## Constraints

- Every gate stays; nothing that passes today fails, and a caller that changes nothing gets exactly today's run.
- A running deploy is never cancelled halfway: only parts that run before the deploy are watched.
- `deploy-release-checks.yml` keeps `contents: read` only (a pull request's caller grants nothing more).
- The preflight never connects to the server (its forced command would deploy) and never prints a secret.

## Notes

- Framing: skipped. The issue names the problem, the measurements and the proposal.
