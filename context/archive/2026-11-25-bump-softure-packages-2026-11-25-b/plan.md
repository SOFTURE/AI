# Plan: bump-softure-packages-2026-11-25-b

## Approach
One phase: install skills 0.41.1, run the installer, drop the obsolete key, update the project note, state, doctor.

## Decisions (auto)
- D1 The COCKPIT command task is not created here: a new routine needs the owner's word (he asked for no second routine).

## Phase 1 (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`, `context/workflow.json`.
- Done when: the doctor exits 0.

## Progress
- [x] Phase 1: skills 0.41.1; block refreshed; cockpitWake removed; state.json unchanged; doctor exit 0.
