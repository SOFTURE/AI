---
change_id: deploy-bundle-banner-681
title: "deploy: the esbuild banner no longer collides with a bundled createRequire (issue #681)"
status: archived
roadmap_item: null
issue: 681
branch: claude/project-thread-x9p21p
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23
---

## Intent

Close [issue #681](https://github.com/SOFTURE/AI/issues/681): the `Dockerfile` written by `softure-deploy init` bundles
`migrate.mjs`, `worker.mjs` and `ops/<name>.mjs` with the banner
`import { createRequire } from 'module'; const require = createRequire(import.meta.url);`. Since
`@softure-ai/observability` 0.4.0 imports `createRequire` from `node:module` at the top level, esbuild keeps that
import next to the banner's, and every bundle that includes `startObservability` fails to load with
`SyntaxError: Identifier 'createRequire' has already been declared`. Import it in the banner under a name no package
uses (`__bundleCreateRequire`), in the template and in the README, guard it with a test that bundles code using
observability with the template's banner and runs `node --check` on the bundle, and note it in observability's
CHANGELOG 0.4.0 for apps that copied the banner.

## Context

Labels: `bug`, `pkg: deploy`. No release in this change: the coordinator releases deploy in the next combined
release. The adopting app fixes its own `Dockerfile`; this change touches only the package.

## Constraints

- The banner still defines `require` for CJS dependencies inside the ESM bundle.
- The test uses the banner exactly as the rendered `Dockerfile` carries it, so the template cannot drift from it.

## Notes

- Framing: skipped. The issue names the cause, the fix and the test.
