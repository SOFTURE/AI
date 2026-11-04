# Implementation review: ci-area-gated-jobs

Verdict: approved.

- The script reads only Node built-ins and `scripts/build-workspaces.mjs`, so the `changes` job needs no `npm ci`
  (one checkout, under a minute).
- Every path that cannot be decided runs every area: a non-PR non-push event, a push without a `before`, the API
  limits, an API error. A malformed manifest throws and turns the run red.
- The closure uses shipped dependencies only; the test pins that marketing-kit (a development dependency of deploy)
  does not reach the deploy area.
- The repository test ties each gated job to an output of `changes` and keeps static, test, build and actionlint
  ungated, so a later edit cannot gate a hook gate by accident.
- Gates: typecheck, ESLint and language gate green (pre-commit); `tests/repo` 839 passed, 69 skipped. actionlint and
  the first real `changes` run follow on the pull request.
