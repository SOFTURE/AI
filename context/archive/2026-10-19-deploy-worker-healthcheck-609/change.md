---
change_id: deploy-worker-healthcheck-609
title: "deploy: the worker service gets a health check that `compose up --wait` accepts (issue #609)"
status: archived
roadmap_item: null
issue: 609
branch: claude/project-thread-qfomlz
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #609](https://github.com/SOFTURE/AI/issues/609): the `worker` service that `softure-deploy init` writes
turns its health check off (`healthcheck: disable: true`). Current Docker Compose fails `up --wait` on a service
without a health check ("has no healthcheck configured"), so the generated `deploy.sh` fails on every deploy of an app
with `@softure-ai/jobs`, and so does an integration stack started with `up --wait`.

## Context

Labels: `bug`, `pkg: deploy`, `adoption`. deploy 0.4.2 is the latest on npm. Another change (#600, PR #606) also edits
the deploy package and merges first: fresh master is merged in before this one merges. Releases are batched by the
coordinator: no version bump, the CHANGELOG gets `## Unreleased`. The compose file belongs to the app; the migration
is described, never applied to an app's repository.

## Constraints

- `docker compose up --wait` succeeds with a running worker and fails when the worker process dies.
- No new secret, no new dependency in the image (alpine has no curl or procps).
- The check runs as the image's user (`nextjs`), not root.

## Notes

- Framing: skipped. The issue names the problem, the place and a working fix.
