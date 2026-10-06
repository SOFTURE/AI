# Plan: deploy-cut-release

Input: change.md, research.md. Complexity: low (one new reusable workflow, one caller example, a repository test,
an actionlint path, README lines).

## Goal

`deploy-cut-release.yml`, called from an app's `release.yml` started with *Run workflow* on the default branch, cuts
the next free date tag and its GitHub Release on the dispatched commit and starts the app's deploy workflow on it.

**Out of scope:** `deploy-app.yml` and its caller (DF-9, DF-10, DF-11), `init` writing the release caller (the
example is copied by hand, like `deploy.yml` was before DP-5), semver tags (packages keep `auto-release.yml`), any
real release.

## Approach

**Chosen:** one job, `cut`, with `permissions: contents: write, actions: write`, `concurrency` per repository
without cancelling. Steps, every value through `env:`:

1. **Check:** inputs (`tag-prefix` matches `^[A-Za-z0-9._-]*$`, `timezone` matches `^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$` and is a file under `/usr/share/zoneinfo`,
   `deploy-workflow` empty or `^[A-Za-z0-9._-]+\.ya?ml$`), and the ref is `refs/heads/<default branch>`; each failure
   is one `::error::` line naming the input and the value.
2. **Pick the tag:** `base="<prefix>$(TZ=<timezone> date +%Y.%m.%d)"`, existing tags from
   `gh api --paginate repos/<repo>/git/matching-refs/tags/<base>`, first free of `base`, `base-2`, `base-3`, …
3. **Create the release:** `gh release create "$TAG" --target "$SHA" --title "$TAG" --notes "$DESCRIPTION"
   --generate-notes`.
4. **Start the deploy:** when `deploy-workflow` is set, `gh workflow run "$DEPLOY_WORKFLOW" --ref "$TAG" -f tag="$TAG"`;
   a job summary names the tag, the commit and the link to the deploy runs. Outputs: `tag`, `sha`.

The caller example `tools/deploy/examples/release.yml`: `workflow_dispatch` with `description`, top-level
`permissions: contents: write, actions: write`, one job calling `deploy-cut-release.yml@deploy-workflows-v1`.

**Rejected:** a checkout with `git fetch --tags` (FIRE's way; runs the app's checkout for one list, the API is
enough); a `pattern` input with semver (no app here uses it); starting the deploy through `release: published` (a
`GITHUB_TOKEN` release does not trigger it); `secrets: inherit` or a PAT (the caller's token is enough).

## Phase 1: The cut-release workflow and its caller

**Discipline:** test-first (the repository test is extended and red before the workflow exists).
**Files:** `tests/repo/deploy-workflows.test.ts`, `.github/workflows/deploy-cut-release.yml`,
`tools/deploy/examples/release.yml`, `.github/workflows/ci.yml`, `tools/deploy/README.md`.

1. Test: the generic checks over `deploy-*.yml` keep applying (trigger, permissions, no interpolation); the SSH and
   `packages: write` checks move to workflows that have SSH or a build job. New: the check step refuses a branch that
   is not the default one and each invalid input, and accepts the defaults (run with `bash`); the tag step picks
   `base`, then `base-2`, then the next after a gap-free run, against a fake `gh` on `PATH`; the release step passes
   the description only through `env:` with `--generate-notes`; the deploy step runs only when `deploy-workflow` is
   set and passes `--ref "$TAG" -f tag="$TAG"`; the job grants exactly `contents: write` and `actions: write`. The
   example caller is dispatch-only, grants the same two, passes only declared inputs, and its default deploy
   workflow is the `deploy.yml` caller this folder ships, which declares the `tag` dispatch input.
2. Workflow and caller as in the approach, header comments explaining the `GITHUB_TOKEN` rule.
3. `ci.yml`: actionlint also over `tools/deploy/examples/release.yml`.
4. README: a "Cut a release" section after "Deploy workflow" (inputs table, permissions, the token rule, the
   deploy workflow's required `tag` dispatch input).
5. Gates: typecheck, lint, test, build; actionlint 1.7.12 with shellcheck over the workflows and both examples.

## Progress

#### Automated
- [ ] Phase 1: the cut-release workflow and its caller (test red before the workflow, then green)

#### Manual
- [ ] Owner: the first real run in an app (needs `@softure-ai/deploy` on npm, DP-8, and the `deploy-workflows-v1` tag
  moved to a commit that has `deploy-cut-release.yml`).
