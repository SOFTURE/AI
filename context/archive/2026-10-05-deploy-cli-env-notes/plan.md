# Plan: deploy-cli-env-notes

Input: change.md, research.md. Complexity: medium (new package, two commands).

## Goal

`@softure-ai/deploy` exists in `tools/deploy/` with a `softure-deploy` CLI: `env render` and `release-notes`, both
covered by tests that run in the normal `npm test`.

**Out of scope:** backup, schema guard, verify, init, workflows (DP-2…DP-5); the GitHub API; publishing (DP-8).

## Approach

**Chosen:** pure functions for parsing and formatting (`src/env/`, `src/notes/`), thin I/O (file write, `git log`
through `execFile`), and a `runCli(argv, io)` that returns an exit code so the CLI is tested in process; `main.ts` is
only the bin shim. **Rejected:** shelling out to bash (the roadmap replaces it); reading the GitHub API (research
answer 1); spawning the built bin in tests (needs a build before `npm test`).

## Phase 1: Package scaffold and env rendering

**Discipline:** TDD.
**Files:** `tools/deploy/{package.json,tsconfig.json,tsconfig.build.json,README.md}`, `src/index.ts`,
`src/env/required-names.ts`, `src/env/env-file.ts`, `src/env/*.test.ts`.

1. Scaffold from `templates/package/` (no `module.json`: a tool, not a module), `bin.softure-deploy`, version 0.1.0.
2. `findRequiredNames(composeText)`: `${NAME:?…}` (empty refused) and `${NAME?…}` (empty allowed), `$$` skipped,
   sorted and unique, the stricter form wins.
3. `renderEnvFile({ names, env })`: a result value, either the file text or the missing and unsafe names; values are
   bare when safe, single-quoted otherwise, refused with a newline or a single quote.
4. Tests: every form, empty compose, missing and empty values, quoting, unsafe values.

## Phase 2: Release notes

**Discipline:** TDD.
**Files:** `src/notes/git-log.ts`, `src/notes/release-entries.ts`, `src/notes/release-notes.ts`,
`src/messages/{en,pl,index}.ts`, tests.

1. `parseGitLog(raw)`: records split by control characters from a fixed `--format`.
2. `toReleaseEntries(commits)`: pull request (GitHub merge, this repository's merge, squash `(#N)`) or direct commit.
3. `formatReleaseNotes({ entries, from, to, date, repoUrl, messages })`: Markdown with a heading, a summary line,
   "Pull requests" and "Other commits"; an empty range says so.
4. `readReleaseCommits({ cwd, from, to })` and `findPreviousTag({ cwd, to, match })` through `execFile`; refs
   validated first.
5. Tests: parsing and formatting units; one test on a temporary git repository with two tags and a merge.

## Phase 3: CLI

**Discipline:** TDD.
**Files:** `src/cli/{main,run,failure,env-command,release-notes-command}.ts`, `tests/cli.test.ts`, root `README.md`.

1. `runCli(argv, io)`: `env render [--compose] [--out]`, `release-notes [--from] [--to] [--match] [--repo-url]
   [--locale] [--out]`, `help`; unknown command or option → usage and exit 2.
2. `env render` writes the file with mode 0600 and prints only names and the count; a test asserts a sentinel value
   never reaches stdout or stderr, including on failure.
3. Root `README.md` lists the tool.
4. Gates: typecheck, lint, test, build.

## Progress

#### Automated
- [x] Phase 1: package scaffold and env rendering — dc17ae2
- [x] Phase 2: release notes — dc17ae2
- [x] Phase 3: CLI — dc17ae2 (the three phases landed in one commit; each was test-first in the working tree)

#### Manual
