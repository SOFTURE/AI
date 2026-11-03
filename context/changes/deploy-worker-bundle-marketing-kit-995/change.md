---
change_id: deploy-worker-bundle-marketing-kit-995
title: "deploy: the worker Dockerfile from init bundles a worker that imports marketing-kit's footage blocks (issue #995)"
status: in_progress
roadmap_item: null
issue: 995
branch: claude/project-thread-cug6zn
created: 2026-11-03
updated: 2026-11-03
---

## Intent

Close [issue #995](https://github.com/SOFTURE/AI/issues/995). The starter worker Dockerfile that
`softure-deploy init --worker-dockerfile` writes (deploy 0.5.0, #948) bundles `scripts/worker.ts` with esbuild and
keeps only `pg` and the drizzle driver adapters external. A worker importing `@softure-ai/marketing-kit` (the use case
#948 was made for) fails to bundle (`.node` files of `@resvg/resvg-js`, `chromium-bidi` subpaths of
`playwright-core`), and the kit resolves `hyperframes` and `gsap` at run time through `createRequire(import.meta.url)`,
which needs the kit to stay a package in `node_modules`. Keep the kit external, test it, and tell 0.5.0 apps the line
to add.

## Context

Labels: `bug`, `pkg: deploy`. The runtime stage already copies the pruned `node_modules`, so an external kit loads
from there. No release in this change: the coordinator releases in the next combined release.

## Constraints

- Only the worker starter changes; the app image's Dockerfile (Next standalone, traced `node_modules`) stays as it is.
- Nothing in an app's repository changes; the CHANGELOG carries the one-line migration.

## Notes

- Framing: skipped. The issue names the problem, a measurement and the fix.
