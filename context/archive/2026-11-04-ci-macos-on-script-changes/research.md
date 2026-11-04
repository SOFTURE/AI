# Research: ci-macos-on-script-changes

## What the macOS job runs

`npx vitest run tools/deploy/tests tests/repo/deploy-workflows.test.ts` with `/usr/bin:/bin:/usr/sbin:/sbin` first in
`PATH`. The tests execute or read:

- `tools/deploy/**` (the CLI, `deploy.sh`, the e2e scripts, `examples/*.yml`, `package.json`);
- `.github/workflows/*.yml` (the deploy workflows' `run:` steps, read from the whole folder) and
  `.github/actions/deploy/action.yml`;
- `tests/repo/deploy-workflows.test.ts` and its helper `tests/repo/repo-files.ts`.

So a pull request that touches none of these runs exactly the same tests on macOS as on master.

## Run history (last 60 `ci` runs, 2026-11-03 15:47 to 2026-11-04 16:22 UTC)

- With a runner: 1.5 to 3.5 minutes; queue up to 10 minutes at times.
- Without a runner: 6 runs, job cancelled after 15 minutes with no runner name and no step; the run concludes
  `failure` (runs 41857674894, 41858165758, 41861662963 and others).
- `unit and repository tests` takes 18 to 26 minutes and is the critical path of `ci`.

## Precedent in the repository

`release.yml` already filters its pull request trigger with `paths` and `tests/repo/ci-workflows.test.ts` asserts
the list. `ci.yml` must stay without a paths filter, so the job moves to a workflow of its own.
