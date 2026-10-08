---
change_id: deploy-integration-run
title: "deploy: the remote integration run with its result in a git note ships with the package (issue #248)"
status: archived
roadmap_item: null
issue: 248
branch: claude/project-thread-of4fxl
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

A project on the SOFTURE skills can set `integration.remote` and `integration.lookup` in `context/workflow.json` to
commands from `@softure-ai/deploy` (`softure-deploy integration run` and `softure-deploy integration lookup`) and a
caller workflow of one `uses:` line, instead of copying FIRE_TRACKER's scripts. Pushing `integration/<name>` runs the
app's full suite on CI for that commit, stores the result in a git note on the tested SHA and deletes the ref; `run`
waits for the note and prints the fixed contract that `wt-integration.sh` reads (`integration:`, `counts:`, `run:`,
`red:`, `new-red:`; exit 0 green, 1 red, 75 no result in time); `lookup` prints a stored result for a SHA without a
new run (exit 0 green, 1 red, 3 none). It works the same locally and in a cloud session: git only, no docker or
GitHub API.

A reviewer checks the CLI tests against real git repositories (a bare remote stands in for GitHub), the workflow
guard tests, the README section and the example caller.

## Context

Issue [#248](https://github.com/SOFTURE/AI/issues/248), verbatim:

> Generic code FIRE_TRACKER still owns that the Softure skills already depend on.
>
> `context/workflow.json` → `integration.remote` and `integration.lookup` are called by `softure-worktree(-manager)`
> (`wt-integration.sh`), but the implementation is FIRE's: `scripts/ci-integration.sh` (71),
> `scripts/ci-integration-lookup.sh`, `scripts/integration-note.mts` (106), `src/lib/integration-note.ts` (236), and
> the `integration-tests.yml` workflow.
>
> How it works: push `integracja/<name>` → the workflow builds the image from that commit, runs the full suite,
> writes the result to `refs/notes/integracja` on the tested SHA and deletes the ref; the script waits, prints a
> fixed contract (`integration:`, `counts:`, `run:`, `red:`, `new-red:` against the last main-branch result), exit
> 0/1/75; lookup reuses a green result for the same SHA instead of a new run (saves Actions minutes). Works the same
> locally and in a cloud session, no docker or GitHub API needed.
>
> Proposal: ship it with `@softure-ai/deploy` (CLI `softure-deploy integration run|lookup` + a reusable workflow
> taking the app's test command), so every project on the skills gets the same contract instead of copying FIRE's
> scripts.

Known state: the contract the commands must meet is written in `.claude/skills/softure-worktree/scripts/wt-integration.sh`
(lines 2-26). `@softure-ai/deploy` already reads git through `execFile` (`tools/deploy/src/notes/git.ts`) and ships
reusable workflows (`.github/workflows/deploy-*.yml`) guarded by `tests/repo/deploy-workflows.test.ts`.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- Changes `tools/deploy` (source, tests, README, CHANGELOG, an example caller), a new reusable workflow in
  `.github/workflows/`, and `tests/repo/deploy-workflows.test.ts`. Not the skills package (it lives in SOFTURE/SKILLS
  and already has the contract) and not this repository's own `context/workflow.json` (its integration stays local).
- Parallel issues #246 and #247 also change `@softure-ai/deploy`: new code goes in new files; shared files
  (`src/cli/run.ts`, `README.md`, `CHANGELOG.md`, `src/index.ts`) get additive edits only.
- No version bump: the entry goes under `## Unreleased` in `tools/deploy/CHANGELOG.md`; releasing stays with the owner.
- English names: `integration/<name>` and `refs/notes/integration`, not FIRE's Polish `integracja`.

## Notes

- Placement: unlinked (`roadmap_item: null`, `issue: 248`), per the project rule that each GitHub issue is one change.
- Archived 2026-10-08: `softure-deploy integration run|lookup|record` and `deploy-integration.yml` give every project
  on the skills the remote integration contract (result in `refs/notes/integration`); listed under `## Unreleased`.
