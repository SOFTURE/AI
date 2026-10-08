# Plan: deploy-integration-run

Input: change.md, research.md. Complexity: medium.

## Goal

`softure-deploy integration run`, `integration lookup` and `integration record` exist in `@softure-ai/deploy`;
`.github/workflows/deploy-integration.yml` runs an app's suite for a pushed `integration/<name>` (or the main branch),
records the result as a note on the tested commit and deletes the integration ref. A project sets
`integration.remote: "npx softure-deploy integration run"` and `integration.lookup: "npx softure-deploy integration
lookup"` and `wt-integration.sh` gets the contract it documents.

**Out of scope:** the skills package (SOFTURE/SKILLS), this repository's own `context/workflow.json`, flaky-test
detection, building a Docker image inside the workflow (the app's test command does what its suite needs), a version
bump.

## Approach

**Starting point:** the contract is `wt-integration.sh:2-26`; git helpers in `tools/deploy/src/notes/git.ts`; the
CLI word map in `src/cli/run.ts:44-53`; reusable workflows split write permission off as in `deploy-report.yml`.

**Chosen:** git as the only channel. `run` pushes the commit to `refs/heads/integration/<name>`, then fetches
`refs/notes/integration` until a note other than the one it saw before the push appears on the SHA. The workflow
writes that note with `record` from a job without app code. Everything is testable with a local bare repository.
Rejected: polling the GitHub API for the run (needs a token and the API, which the issue rules out); a status file in
a branch (pollutes history, merge races).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Names | branch prefix `integration/`, notes ref `refs/notes/integration` | English rule; fixed, so every project shares the contract | change |
| Note | one JSON object `{version:1, result, sha, name, ref, passed, total, red[], run, finishedAt}`; `passed`/`total` null without a report | versioned, zod-parsed at the boundary | plan |
| Result truth | the test command's exit code; JUnit only adds counts and names | a suite that fails before writing a report is still red | plan |
| Counts | optional JUnit XML (`--junit`); `total` = non-skipped test cases, `passed` = total minus failed or errored | Vitest and Playwright write JUnit | research |
| `new-red` | red names absent from the red list of the newest first-parent commit of `<remote>/<main>` with a note; no main result → no `new-red` lines | contract: "cannot tell → none, every red counts as new" | research |
| Main branch | `--main`, else `mainBranch` of `context/workflow.json`, else `main` | the skills' config already names it | plan |
| Busy name | remote ref on another commit → exit 1 "could not start"; on the same commit → wait without pushing | never replace someone's run; never force-push | plan |
| Stale note | `run` waits for a note text different from the one read before the push | a stored red must not end a new run | research |
| Notes race | `record` retries fetch + re-add + push, 5 attempts | two workflows finishing together | research |
| Exit codes | run: 0/1/75, lookup: 0/1/3, usage 2 | the contract | research |
| Workflow jobs | `test` (contents: read, no persisted credentials, runs app code) and `record` (contents: write, runs only the CLI and git) | app code never holds a write token | research |

**Critical details:** `run` must read the existing note *before* pushing the ref, or a fast workflow could write the
new note in between and `run` would wait forever for a change. `record` sets a committer identity when git has none
(the runner has none).

## Phase 1: note, contract lines and JUnit counts

**Discipline:** TDD. **Files:** `tools/deploy/src/integration/note.ts`, `junit.ts`, `contract.ts`, their tests,
`src/integration/index.ts`, `src/index.ts`.

1. `note.ts`: `IntegrationNote` type, `parseIntegrationNote(text): Result` (zod, JSON), `formatIntegrationNote(note)`.
2. `junit.ts`: `readJunitCounts(xml): { passed, total, red: string[] }`: test cases, skipped excluded, a case with
   `<failure` or `<error` is red under `<classname> › <name>`, XML entities decoded.
3. `contract.ts`: `formatContractLines(note, mainNote | null): string` with `integration:`, `counts:` (when known),
   `run:` (when known), `red:` per name, `new-red:` per name when a main result exists.

**Tests:** valid note, invalid JSON, wrong shape, null counts; JUnit with passes, failures, errors, skipped,
self-closing cases, entities, empty report; contract green, red with and without a main result, unknown counts.

**Done when:**
- Automated: unit tests seen red, then green; Gates green (typecheck, lint, test).

## Phase 2: git and the three commands

**Discipline:** TDD. **Files:** `tools/deploy/src/integration/git-notes.ts`, `run-integration.ts`,
`src/cli/integration-command.ts`, `src/cli/run.ts`, `tools/deploy/tests/integration-cli.test.ts`.

1. `git-notes.ts`: `fetchNotes`, `readNote`, `writeNote` (with identity fallback), `pushNotes` (retry), `readRemoteRef`,
   `pushRef`, `findMainNote`. All refs checked with `isSafeRef`.
2. `run-integration.ts`: `lookupIntegration`, `recordIntegration`, `runIntegration` with injected `sleep` and `now`.
3. `integration-command.ts`: flags and env defaults (`INTEGRATION_NAME`, `INTEGRATION_SHA`,
   `INTEGRATION_WAIT_MINUTES`); exit codes per the contract; `run.ts` gets the three words and usage lines.

**Tests (bare remote + clones):** lookup green 0, red 1, none 3, offline remote falls back to local notes; record
writes and pushes, a second record on another commit after a concurrent push (retry), counts from a JUnit file;
run pushes the ref and returns green when a note appears, red with `new-red` against a main note, 75 on timeout,
refuses a busy name, waits on a same-commit ref without pushing, ignores the stale note present before; usage errors.

**Done when:**
- Automated: CLI tests seen red, then green; Gates green (typecheck, lint, test).

## Phase 3: reusable workflow and caller

**Discipline:** test-after. **Files:** `.github/workflows/deploy-integration.yml`,
`tools/deploy/examples/integration.yml`, `tests/repo/deploy-workflows.test.ts`.

1. Workflow: `workflow_call` inputs `test-command` (required), `setup-command` (`npm ci`), `junit-report` (empty),
   `node-version`, `deploy-cli-version` (package version). Job `test`: validate inputs, checkout the pushed SHA
   without credentials, setup node, setup command, test command with its exit code kept, upload the JUnit report.
   Job `record` (`needs: test`, `if: always()`): checkout, download the report, `integration record`, delete the ref
   when it is `refs/heads/integration/*`.
2. Example caller: `on: push` of `integration/**` and the main branch, `concurrency` per ref.
3. Guards: `record` in the `contents: write` map; version default; the test step keeps the exit code (run with stub
   commands); the delete step touches only `integration/` refs.

**Done when:**
- Automated: guard tests green; Gates green (typecheck, lint, test).

## Phase 4: docs

**Discipline:** test-after. **Files:** `tools/deploy/README.md`, `tools/deploy/CHANGELOG.md`.

1. README: section "Integration run" (workflow.json lines, caller, note, exit codes), the library list, the
   FIRE parity paragraph.
2. CHANGELOG `## Unreleased` entry.

**Done when:**
- Automated: link check in `npm test` green; Gates green (typecheck, lint, test, build).

## Risks and rollback

- A caller that pins the `deploy-cli-version` default before the release gets "unknown command": documented; the
  version bump moves the default. Rollback: each phase is its own commit; revert them in reverse order. Nothing is
  stored outside git notes and a throwaway branch.

## Decisions (auto)

- Separate `record` command or shell in the workflow → command (testable, the retry lives in tested code).
- Flaky lines → not produced (no portable signal in JUnit; the contract makes them optional).
- Phase 2 drift: an unreachable remote made `git ls-remote` throw out of `run`; `readRemoteRef` now returns
  `unreachable` and `run` exits 1 ("cannot reach <remote>; the run did not start"), with a test for it.
- Phase 3 drift: `tests/repo/ci-workflows.test.ts` requires a numeric `timeout-minutes` on every reusable job, so the
  suite job has a fixed 120 minutes instead of a `timeout-minutes` input. The example caller joined the actionlint
  step of `ci.yml`.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: note, contract lines and JUnit counts

#### Automated
- [x] 1.1 Unit tests for note, JUnit counts and contract lines seen red, then green — 39d3e71
- [x] 1.2 Gates green (typecheck, lint, test) — 39d3e71

### Phase 2: git and the three commands

#### Automated
- [x] 2.1 CLI tests against a bare remote seen red, then green — 16516ea
- [x] 2.2 Gates green (typecheck, lint, test) — 16516ea

### Phase 3: reusable workflow and caller

#### Automated
- [x] 3.1 Workflow guard tests green — ce6b14c, 12165db
- [x] 3.2 Gates green (typecheck, lint, test) — 12165db

### Phase 4: docs

#### Automated
- [x] 4.1 README and CHANGELOG, gates green (typecheck, lint, test, build) — 8058158
