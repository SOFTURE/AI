---
change_id: quality-review-self
title: "quality-review: SOFTURE/AI reviews itself with a by-hand quality-review-self workflow"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-amoubq
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Let the owner start the quality review, general or security, on SOFTURE/AI itself, for the whole repository or one
package (first runs: `modules/auth` and `modules/mcp-access` with the security focus).

## Context

Asked in chat (no issue). The reusable `.github/workflows/quality-review.yml` exists for adopting apps; SOFTURE/AI has
no caller of its own. The repository is public, so a report pull request is public too.

## Scope

- `.github/workflows/quality-review-self.yml`: `workflow_dispatch` with `focus`, `scope`, `paths`, `max-budget-usd`,
  calling `./.github/workflows/quality-review.yml`.
- A repository test for the caller; one paragraph in the quality-review README.

## Constraints

- No schedule and no push or pull request trigger: every run costs API credits.
- The reusable workflow and the package stay unchanged (no release).

## Notes

- Research and frame skipped: the reusable workflow, its example caller and their tests already define the shape;
  `ci-usage-self.yml` is the in-repository precedent of a local `uses: ./` caller.

## Decisions (auto)

- `focus` defaults to `security` and `max-budget-usd` to 15, the README's recommendation for a security run: the
  first runs the owner asked for are security runs.
- Public delivery of a security report: the owner's choice on 2026-11-19 (over a private reports repository and
  general-only runs), recorded in the workflow's header comment.

## Done

- `quality-review-self.yml` on master; first security runs of `modules/auth` and `modules/mcp-access` started after
  the merge.
