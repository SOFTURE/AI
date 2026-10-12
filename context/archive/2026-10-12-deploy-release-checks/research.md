---
change_id: deploy-release-checks
---

# Research: deploy-release-checks (issue #406)

## What exists

- `.github/workflows/deploy-app.yml`: `check` validates every input in one step (`reject`/`expect` helpers, `::error::`
  per input) and refuses a tag off the release branch from a commits-only checkout (`fetch-depth: 0`, `filter:
  tree:0`, `git merge-base --is-ancestor`). `build` is the only job with `packages: write`; it logs in to GHCR with
  `docker/login-action@v4` and builds with `docker/build-push-action@v7` (gha cache). `prebuilt-image` takes
  `<image>@sha256:<64 hex>` in the `image` repository (default `ghcr.io/<owner>/<repo>` lower-cased) and re-tags it.
- `.github/workflows/deploy-cut-release.yml`: tags are `<prefix><YYYY.MM.DD>`, then `-2`, `-3`; `gh` with
  `GH_TOKEN: github.token`, a single job `cut` with `contents: write`.
- `tests/repo/deploy-workflows.test.ts`: every `deploy-*.yml` is guarded (workflow_call only, permissions,
  `packages: write` only for `build`, `contents: write` per a map of job ids, no `${{ inputs|secrets|github.event }}`
  in `run:`, SSH host keys). Step scripts are executed with fake `gh`/`date`/`npx` on `PATH`.
- `tests/repo/ci-workflows.test.ts`: reusable workflows need `timeout-minutes` on every job (checked there).
- `tools/deploy/src/init/generate.ts`: `TEMPLATE_FILES`, `{{workflowsRef}}`; `generate.test.ts` checks the generated
  release caller equals `examples/release.yml` after parsing.
- `ci.yml` runs actionlint 1.7.12 over `.github/workflows/` and the example callers listed by name.

## Tools

- Vitest accepts `--shard=<index>/<count>`.
- `next typegen` (Next 15.5+) writes the route types without a build; `examples/next-app` uses Next 16.
- `gh release edit <tag> --notes-file <file>` replaces the body.
- A matrix from a job output: `strategy.matrix.shard: ${{ fromJSON(needs.prepare.outputs.shards) }}`.

## Risks

- A caller's command is code of the caller's own repository, so running it is not an injection; it still goes
  through `env:` so the interpolation guard holds.
- `build` after skipped jobs: `needs` with a skipped dependency skips the job unless the `if:` starts with
  `always()`/`!cancelled()`; the condition must accept `skipped` and `success` only.
