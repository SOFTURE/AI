# Research: merge-only pre-push (issue #868)

## Current state

- `tools/config/presets/lefthook.yml`: `pre-push` is `piped` with jobs `typecheck`, `lint`, `language`, `test`
  (`npm test`). The heavy jobs carry `skip: - run: npx softure-context-only-push`.
- `tools/config/src/cli/context-only-push-command.ts`: `listPushedFiles` diffs `@{push}` against `HEAD`; a git error
  or a missing upstream returns "run everything". Injected `RunGit` keeps it testable; tests build a real git
  repository with a bare remote in a temp folder.
- `tools/config/tests/presets.test.ts` pins the job names, runs and skips, and checks with `lefthook dump` that an
  app's second `extends` file changes one job and keeps the order.
- lefthook 2.1.16: a job's `skip` and `only` accept `- run: <command>`; the condition holds when the command exits 0.
  Several `skip` entries: any one that holds skips the job.

## What a merge-only push is

The pushed range is `@{push}..HEAD`. Commits already on the upstream main branch are excluded
(`git rev-list --parents HEAD ^@{push} ^<remote>/<main>`); what is left is the branch's own new commits:

- a non-merge commit must touch only `context/` (workflow state the agent writes around a merge);
- a merge commit must bring in, through every parent but the first, commits already on `<remote>/<main>`
  (`git merge-base --is-ancestor`); its own conflict resolution touches files both sides changed, so the branch's
  related tests cover it;
- at least one merge commit, otherwise it is not this case (a context-only push has its own bin).

Incoming files are `git diff --name-only @{push} HEAD`. Any of them matching a migration, a dependency manifest or
lockfile, a test setup or a tool config forces the full suite. The app adds patterns of its own in `package.json`.

The main branch: `mainBranch` of `context/workflow.json` (the SOFTURE workflow's source of truth), else the remote's
`HEAD`, else `main`, else `master`. The remote is the one of `@{push}`.

Related tests: files the branch changes are `git diff --name-only --diff-filter=d <merge-base> HEAD` with the main
branch; `vitest related --run --passWithNoTests <files>` runs every test that imports them.

## Options

1. Change the `test` job's `run` to a bin that picks `npm test` or the related run. Breaks apps that override
   `test.run` (their override would silently drop the choice).
2. Keep `test` as `npm test`, add a second `skip` entry (`is-merge`), and a new job `test-related` that runs only for a
   merge push (`skip` on `is-full`). An app overriding `test.run` keeps working; a crash of the bin never skips the full
   suite (it exits non-zero, so `skip` does not hold).

Chosen: 2.
