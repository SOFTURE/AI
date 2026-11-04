---
change_id: deploy-worker-bundle-marketing-kit-995
status: done
---

# Plan: keep marketing-kit external in the worker starter (issue #995)

Input: change.md, research.md. Complexity: small (one template line, one test, docs).

## Phase 1: test first, then the template

1. `tools/deploy/tests/worker-bundle.test.ts`: generate the worker Dockerfile with `planInitFiles`, read the
   `--external:` and `--alias:` flags and the banner from its esbuild command, bundle an entry that imports
   `@softure-ai/marketing-kit` with them, and check the output parses (`node --check`). Red on master.
2. `templates/worker.Dockerfile.tmpl`: add `--external:@softure-ai/marketing-kit` with a comment why (native `.node`
   binaries, playwright's optional imports, the kit's run-time `createRequire`).
3. `@softure-ai/marketing-kit` as a devDependency of deploy, so the test's import is declared.

## Phase 2: docs

CHANGELOG `## Unreleased`: the fix and the line a 0.5.0 app adds to `docker/worker.Dockerfile`. README: the starter
section names the external kit.

## Decisions (auto)

- Only the kit external, not `--packages=external` (research.md: `server-only` alias and pruned devDependencies).
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: `004deeb`
- [x] Phase 2: `004deeb` (docs landed with phase 1)
