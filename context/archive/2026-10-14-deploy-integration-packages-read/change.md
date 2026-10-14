---
change_id: deploy-integration-packages-read
title: "deploy-integration.yml's test job may read packages, so a private prebuilt image pulls (issue #462)"
status: archived
roadmap_item: null
issue: 462
branch: claude/project-thread-udzng8
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

A release that tests a private prebuilt GHCR image through `deploy-integration.yml` fails at "Pull the image" with
`manifest unknown`: the `test` job declares `permissions: contents: read`, so the `registry-token` the caller passes
(its `secrets.GITHUB_TOKEN`) carries no `packages: read`, and GHCR answers a pull of a private package without it as
if the manifest did not exist. The release never reaches the deploy. Give the `test` job `packages: read` and pin it
with a repository guard.

## Context

Issue #462 (labels: none yet; package `@softure-ai/deploy`, its reusable workflows). Surface:

- `.github/workflows/deploy-integration.yml`: header comment, `jobs.test.permissions`.
- `tools/deploy/examples/integration.yml`: the copied caller grants `contents: write` only.
- `tools/deploy/README.md`, "Integration workflow".
- `tests/repo/deploy-workflows.test.ts`: asserts `jobs.test.permissions` equals `{ contents: read }` and the example
  caller's permissions equal `{ contents: write }`.
- `tools/deploy/CHANGELOG.md`: `## Unreleased` for the next release.

## Constraints

- A reusable workflow's job can only narrow the caller's token: a called job that asks for `packages: read` while
  the calling job grants none is refused when the run starts. So every caller must grant `packages: read`, the
  branch-push integration caller included.
- The suite still runs with no credentials of its own: checkout keeps `persist-credentials: false`, and the token
  reaches only the pull step, through a Docker config deleted in the same step.
- No release and no deploy in this change (the coordinator releases).

## Notes

- Research: skipped. The cause, evidence and fix are in the issue; the surface is the five files above, found by one
  grep for `deploy-integration` and `registry-token`.
- Frame: skipped. The problem is a measured failure with a measured cause.
