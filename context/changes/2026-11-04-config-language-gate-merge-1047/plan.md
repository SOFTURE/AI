---
change_id: config-language-gate-merge-1047
status: open
---

# Plan: the language gate on a merge commit (issue #1047)

Input: change.md, research.md. Complexity: small (one command, its tests, docs).

## Phase 1: merge-aware file check (TDD)

Files: `tools/config/src/cli/check-language-command.ts`, `tools/config/src/cli/check-language.ts`,
`tools/config/tests/check-language-command.test.ts`.

- `readMergeParentLines(cwd, runGit?)`: `null` when no merge is in progress or git fails; else a function
  `(path) => ReadonlySet<string> | null` with every line of `path` in `HEAD` and each `MERGE_HEAD` commit (a parent
  without the file adds nothing; a git error for one file returns `null` = check the file in full).
- `CheckLanguageEnvironment` gains optional `readMergeParentLines?: (cwd) => ...`; the bin passes the git one.
- In file mode only, a hit is dropped when its line text is in the parents' set. `--all` and `--commit-msg` untouched.
- Tests: injected fake (dropped hit, new hit kept, null = full check, `--all` unaffected) and a real git repository
  (main branch adds a Polish line, branch merges with a conflict in another file, Polish line resolved in → only the
  new line is a hit).

## Phase 2: docs

`tools/config/README.md` (language gate section: merge rule), `tools/config/CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Line filter over whole-file skip (research, option 2).
- Every head of `MERGE_HEAD` is read, so an octopus merge is covered too.
- Unsure means full check: any git failure keeps today's behaviour.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: merge-aware file check
- [ ] Phase 2: README and CHANGELOG
- [ ] Implementation review
