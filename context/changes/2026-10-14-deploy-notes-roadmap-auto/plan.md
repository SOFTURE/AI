---
change_id: deploy-notes-roadmap-auto
status: open
---

# Plan: release-notes --roadmap=auto (issue #465)

Input: change.md, research.md. Complexity: small (one command, two git reads, a file-name sort, docs).

## Phase 1: --roadmap=auto (TDD)

Files: `tools/deploy/src/notes/git.ts`, `tools/deploy/src/notes/roadmap-files.ts` (new),
`tools/deploy/src/notes/index.ts`, `tools/deploy/src/cli/release-notes-command.ts`, `tools/deploy/src/cli/run.ts`,
tests next to them and in `tools/deploy/tests/cli.test.ts`, `tools/deploy/README.md`, `tools/deploy/CHANGELOG.md`.

1. Tests first:
   - `roadmap-files`: the pattern accepts `2026-10-03-roadmap.md` and `2026-10-03-2-roadmap.md`, rejects other
     files; the sort puts date then counter in order (`-roadmap` before `-2-roadmap`, `-2` before `-10`).
   - `git`: `listAddedFiles` returns only files added in the range under the directory, and the whole directory at
     `to` with no `from`; `readFileAt` returns the file as it is at the ref.
   - CLI: main roadmap present → its rows; only an archived roadmap added since the previous tag → its `done_code`
     rows; an archived roadmap from before the previous tag → no table, exit 0; neither → no table, exit 0; explicit
     missing path still fails.
2. Implement the git reads, the file module and the command branch.
3. Docs: README release-notes section and usage, CLI usage text, CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: --roadmap=auto
