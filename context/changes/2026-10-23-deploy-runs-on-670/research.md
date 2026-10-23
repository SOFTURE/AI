# Research: a runs-on input on the reusable workflows (issue #670)

## Current state (master 9719be8)

- 16 jobs hard-code `runs-on: ubuntu-latest` across the nine reusable workflows the issue lists (`deploy-app` 5,
  `deploy-release-checks` 3, `deploy-integration` 2, one each in the other six). `ci.yml`, `e2e*.yml`, `release.yml`
  and `auto-release.yml` are this repository's own workflows, not reusable, and stay as they are.
- Input checks differ per workflow: `deploy-release-checks` repeats one `&check-inputs` step in every job (YAML
  anchor, already used in the repository); `deploy-app`, `deploy-integration`, `deploy-release-image`, `deploy-report`
  have a `reject()` step in their first job; `deploy-cut-release` and `deploy-release-notes` a `fail()`-style step;
  `deploy-cancel-run` and `blog-links` none (`deploy-cancel-run` has no inputs at all).
- `tests/repo/deploy-workflows.test.ts` runs workflow steps with `bash -e -c` and an env (the pattern to test a
  check step); `tests/repo/ci-workflows.test.ts` covers the reusable workflows (`REUSABLE`) including `blog-links`.
- `e2e-deploy.yml` calls `deploy-app.yml` and `deploy-report.yml` on real runners; nothing in CI calls
  `deploy-release-checks.yml`.

## GitHub behaviour

- `runs-on` takes a label string, an array of labels, or an object (`group`, `labels`). `fromJSON` on a string input
  gives either of the first two from one input of type string.
- `runs-on` is evaluated before the job gets a runner. A value that is not JSON fails at that evaluation (GitHub's
  error names the workflow line, which is the `runs-on` line); no step of the job can run first. A JSON value of a
  shape GitHub takes (an object, an array of numbers) does reach a runner, and a step can refuse it there.

## Options for the check

1. Extend each existing input-check step with a `RUNS_ON` env and one more `reject` line. Nine different steps,
   two workflows without one, and testing the runner check means building every step's full env.
2. One identical "Check the runner" step, first in every job (anchored once per file). One script to test, one shape
   for the guard to assert, a few milliseconds per job. Chosen.

Validation in bash only (a self-hosted runner may lack `jq` or Node before `setup-node`): a quoted label without
quotes or backslashes, or a non-empty array of such labels, whitespace allowed. Labels never carry those characters.
