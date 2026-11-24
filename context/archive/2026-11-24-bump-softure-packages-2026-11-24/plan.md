# Plan: bump-softure-packages-2026-11-24

## Approach
One phase: install `@softure-ai/skills@^0.34.0`, run the installer, regenerate the context state, run the doctor and
the gates.

## Decisions (auto)
- D1 `project` stays unset in `context/workflow.json` (the installer's hint), as decided in skills-0-24 (D2).

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`.
- Done when: the doctor exits 0; typecheck, lint and tests pass.

## Progress
- [x] Phase 1: skills 0.34.0 installed; managed block refreshed; state.json unchanged; doctor exit 0.
