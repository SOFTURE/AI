# Plan: bump-softure-packages-2026-11-25

## Approach
One phase: install `@softure-ai/skills@^0.39.1`, run the installer, declare `autonomy.cockpitWake`, add the project
note to `AGENTS.md`, regenerate the context state, run the doctor and the gates.

## Decisions (auto)
- D1 The obsolete key `autonomy.ownerWordWake` is replaced, not kept beside `cockpitWake`: 0.39 reads only the new key.
- D2 The proof (one cockpit issue, the routine's start time) runs after the merge and is reported in the chat; it
  changes no file.

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`, `context/workflow.json`.
- Done when: the doctor exits 0; typecheck, lint and tests pass.

## Progress
- [x] Phase 1: skills 0.39.1 installed; managed block refreshed; cockpitWake declared; state.json unchanged; doctor exit 0.
