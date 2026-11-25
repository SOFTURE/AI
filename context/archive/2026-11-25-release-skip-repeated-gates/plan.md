# Plan: release-skip-repeated-gates

## Approach
A small script `scripts/release/master-gates.mjs` asks the Actions API for `ci.yml` push runs on master of the tagged
commit and prints `passed` or `run`. It waits (polling) while such a run is queued or in progress, up to a limit, and
answers `run` on no run, a failed or cancelled run, a timeout or any API error. `release.yml` runs it before `Gates`
on a tag ref and runs `Gates` only when the answer is `run`. A pure function decides from a list of runs, so the
decision is unit-tested.

## Decisions (auto)
- D1 Wait limit 30 minutes, poll every 30 s: a master run takes 6 to 10 minutes; after the limit the gates run.
- D2 Any API failure falls back to the gates (never to a skip).
- D3 A success of any attempt of a matching run counts (a re-run that went green is green).
- D4 The validate job gets `actions: read` only; the workflow default stays `contents: read`.

## Phase 1: decision and script (test-first)
- Files: `scripts/release/master-gates.mjs`, `tests/repo/release-master-gates.test.ts`.
- Done when: tests cover success, in progress, failure, cancelled, empty list, mixed lists.

## Phase 2: workflow wiring
- Files: `.github/workflows/release.yml`, `tests/repo/release-workflow.test.ts`, `scripts/release/README.md`.
- Done when: the `Gates` step is conditional on the script's answer; a repository test pins it; actionlint passes.

## Progress
- [x] Phase 1: `decideGates` + CLI (6a2b5dd); `npx vitest run tests/repo/release-master-gates.test.ts` 6/6 green;
  live API filter checked: `ci.yml` push run of master 74532eb answers completed/success; CLI falls back to `run`
  on a bad SHA and on HTTP 401.
- [x] Phase 2: `release.yml` step "Gates already passed on master" and conditional `Gates` (9749d12); repository
  tests 15/15 green in the two release files; ESLint, typecheck and the language gate green in the hooks.
