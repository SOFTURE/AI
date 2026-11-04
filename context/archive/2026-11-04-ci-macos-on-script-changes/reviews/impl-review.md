# Implementation review: ci-macos-on-script-changes

Verdict: approved.

- `macos.yml` carries the job's steps unchanged (system tools first in `PATH`, the same vitest command, 20-minute
  timeout); `ci.yml` lost only the job and keeps its triggers and its no-paths-filter rule.
- The paths filter is the same on push and pull request and covers what the tests execute and read; the repository
  test ties it to the vitest command, so adding a test target without a matching path turns the gate red.
- `AGENTS.md` names the new workflow in the project section, outside the managed block.
- Gates: typecheck, ESLint and language gate green (pre-commit); `tests/repo` 810 passed, 69 skipped. actionlint runs
  in CI (`workflows` job).
