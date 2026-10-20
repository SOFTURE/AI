---
change_id: deploy-checks-pr-cost-627
title: "deploy-release-checks.yml: no billed prepare job without a tag, and an optional static cache (issue #627)"
status: archived
roadmap_item: null
issue: 627
branch: claude/project-thread-jl433u
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20
---

## Intent

Close [issue #627](https://github.com/SOFTURE/AI/issues/627): a pull request that calls `deploy-release-checks.yml`
pays a billed minute for `prepare`, a job that does seconds of work without a tag, and `static` starts from scratch
every run because nothing keeps `.eslintcache` or `*.tsbuildinfo`. Cut both costs without removing a gate.

## Context

Labels: `pkg: deploy`. The workflow is called at `master` or a pinned SHA, so the change reaches callers without a
package release; README and CHANGELOG ship with the next `@softure-ai/deploy` release (`## Unreleased`).

## Constraints

- Every input check and the tag/branch guard stay; a release (with a tag) behaves as before.
- The output `sha` keeps its meaning with and without `prepare`.
- The cache is opt-in: a caller that passes nothing gets exactly today's job.

## Notes

- Framing: skipped. The issue names the problem, the measurements and the proposal.
