# Plan: ci-macos-on-script-changes

## Phases

1. New `.github/workflows/macos.yml`: the `macos` job of `ci.yml` unchanged, triggered on `pull_request` and `push`
   to master with the same `paths` list, `workflow_dispatch`, and a weekly `schedule`; `concurrency` as in `ci.yml`;
   `permissions: contents: read`. Remove the job from `ci.yml`. Repository tests in `tests/repo/ci-workflows.test.ts`:
   `ci.yml` runs no macOS job; `macos.yml` filters push and pull request with the same list, which covers every path
   its vitest command names and the workflows and actions its tests read. `AGENTS.md` names `macos.yml`.
   Gates: typecheck, lint (language, actionlint locally if available), `tests/repo`.

## Decisions (auto)

- A weekly schedule (Monday 06:00 UTC) keeps a check on a new macOS runner image even when no script changes; the
  repository is public, so macOS minutes cost nothing.
- `.github/workflows/**` rather than only the deploy workflows: the tests read the whole folder, and workflow changes
  are rare.
- `package-lock.json` is not in the list: a dependency bump does not change the shell scripts, and releases touch the
  lockfile almost daily.

## Progress

- [ ] p1
