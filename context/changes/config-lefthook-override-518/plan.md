---
change_id: config-lefthook-override-518
status: in_progress
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

- [ ] Phase 1: guard the mechanism with a test
- [ ] Phase 2: docs
