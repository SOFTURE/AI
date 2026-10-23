---
change_id: deploy-reused-workspace-687
status: done
---

# Research: sparse checkout left behind on a reused work directory (issue #687)

## Findings

- Reproduced locally with git 2.x and the exact commands of actions/checkout (non-cone mode): the first checkout sets
  `core.sparseCheckout true` in `.git/config` and writes `/package.json` to `.git/info/sparse-checkout`. The next
  checkout with an empty `sparse-checkout` runs `git sparse-checkout disable` (which writes `core.sparseCheckout
  false` into `config.worktree` and turns on `extensions.worktreeConfig`), then
  `git config --local --unset-all extensions.worktreeConfig`. That hides `config.worktree` again, the local `true`
  wins, and `git checkout --force <sha>` exits 0 with only `package.json` in the tree. The partial-clone filter
  (`remote.origin.partialclonefilter=tree:0`) also stays in the config, but lazy fetches still complete; the sparse
  state is what loses the files.
- So any non-cone sparse checkout followed by a full one in the same directory is affected, not only `prepare`'s
  treeless one: `deploy-release-checks.yml` (`prepare` → `static`, `unit`), `deploy-app.yml` (`check` with
  `/<compose-file>`, `build` with `sparse-checkout`, `deploy`'s server files, `.softure-ai-deploy`),
  `deploy-release-image.yml`, `deploy-integration.yml`, `deploy-report.yml` and `blog-links.yml` all check out into a
  directory the previous job may have left sparse.
- Hosted runners give each job a fresh directory, so the tests and e2e runs never saw it.
- `blog-links.yml` sets `defaults.run.working-directory` to a folder inside the checkout, which does not exist
  before the checkout: a step that runs earlier needs its own `working-directory`.

## Options

1. Empty `$GITHUB_WORKSPACE` at the start of every job of the reusable workflows that checks out (one step, the same
   in each). Fixes every sparse/full pair, costs nothing on a hosted runner, and makes a self-hosted job start like a
   hosted one.
2. Check `prepare`'s and `check`'s treeless clones out into their own `path:`. Fixes those two only; `build`'s
   `sparse-checkout` input followed by a later full checkout still breaks, and a work directory an earlier run already
   left sparse stays broken.
3. Document a job-started hook on the runner. Needed for the app's own jobs anyway, but leaves the workflows broken by
   default.

Recommendation: option 1, plus option 3 in the README for the app's own jobs.
