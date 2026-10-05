# Research: release-dispatch

## Current state

- `.github/workflows/release.yml` runs on `push: tags ["*@*.*.*"]`, `pull_request` and
  `workflow_dispatch` (input `package`, dry run). Every publishing job is gated on
  `github.ref_type == 'tag'`; "Pack and check" packs `--tag "$GITHUB_REF_NAME"` when `REF_TYPE` is
  `tag`. A `workflow_dispatch` started with a tag as its ref has `github.ref_type == 'tag'` and
  `github.ref_name` = the tag, so it takes the same path as a pushed tag: the master check, the gates,
  the pack, npm stage, GitHub Packages, GitHub Release. Nothing in `release.yml` needs to change.
- The concurrency group is `release-${{ github.ref }}`: one group per tag, so dispatched releases run
  side by side.
- Tags created with `GITHUB_TOKEN` start no `push` workflow (GitHub's rule against recursive runs), so
  creating the tag does not start a second release; `gh workflow run` (needs `actions: write`) is the
  documented exception.
- `scripts/build-workspaces.mjs` exports `findWorkspaces` and `orderWorkspaces` (dependency order);
  `scripts/release/pack.mjs` exports `readReleasePackages`; `scripts/release/version.mjs` exports
  `getReleaseTag`.

## FIRE_TRACKER pattern (read only)

`auto-release.yml`: `workflow_dispatch` only; refuses any ref but `refs/heads/master`; `permissions: {}`
at the top and `contents: write` + `actions: write` on the job; computes a free tag; creates it; runs
`gh workflow run release.yml --ref "$TAG"`; links the runs in the step summary. Inputs reach the shell
through `env`, never `${{ }}` inside the script.

## Here

Tags are per package and the version comes from `master` (`package.json`), so the dispatched workflow
takes a package list (`all` or short names), plans `<name>@<version>` for each public package, skips a
tag that already exists, creates the rest and dispatches `release.yml` on each.

## Risks

- A typo in the package list: the planner refuses unknown and private names before any tag exists.
- The input is user text: it reaches the shell only through `env` and is validated by the planner.
- A tag created on a commit that fails the gates: `release.yml` refuses to publish; the tag stays and
  marks the attempt, as with a pushed tag.

## Open questions

None.
