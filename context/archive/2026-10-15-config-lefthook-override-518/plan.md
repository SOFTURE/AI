---
change_id: config-lefthook-override-518
status: archived
---

# Plan: change one job of the lefthook preset (issue #518)

Input: change.md, research.md. Complexity: small (docs, a preset comment, one test).

## Phase 1: guard the mechanism with a test (TDD)

Files: `tools/config/tests/presets.test.ts`.

1. In a scratch git repository inside `node_modules/.cache`, write the preset under
   `node_modules/@softure-ai/config/presets/`, an app `lefthook.yml` with `extends: [preset, lefthook.app.yml]` and a
   `lefthook.app.yml` that changes the `typecheck` job of `pre-commit` and `pre-push` to the Next.js command.
2. Run `lefthook dump --format json`; assert the app's `run` for both jobs, the preset's other jobs unchanged, and the
   preset's job order in `pre-push`.
3. A second case documents the trap: the same job in the app's `lefthook.yml` keeps the preset's `run`.

## Phase 2: docs

`tools/config/README.md` (git hooks: how to change a job, the Next.js example, skipping the language checks moved to
the second file), `tools/config/presets/lefthook.yml` header comment, `tools/config/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: guard the mechanism with a test (`9e04bbd`; two `lefthook dump` cases. They pass on the current
  preset, as the fix is documentation: the first guards the documented mechanism, the second the README's warning)
- [x] Phase 2: docs (`9e04bbd`; README git hooks section with the Next.js and skip examples, preset header
  comment, CHANGELOG `## Unreleased`)

Gates on the branch: typecheck, ESLint and the language gate green (pre-commit); config preset tests 9 passed; the
full `npm test` runs in pre-push.
