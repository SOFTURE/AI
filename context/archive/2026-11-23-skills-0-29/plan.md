# Plan: skills-0-29

## Approach
One phase: install `@softure-ai/skills@^0.29.0`, run the installer, drop the project merge rule the package now
carries, run the doctor and fix what it names, run the gates.

## Decisions (auto)
- D1 `project` stays unset in `context/workflow.json` (the installer's hint): `context/state.json` already reads
  "SOFTURE AI" through the fallback, as decided in skills-0-24 (D2).
- D2 The stale `owner_queue` is fixed by regenerating `context/state.json` with `npx softure-skills state`, never by
  hand (WORKFLOW §12).

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`, `context/state.json`.
- Done when: the doctor exits 0; typecheck, lint and tests pass.

## Progress
- [x] Phase 1: skills 0.29.0 installed; merge rule section removed; state.json regenerated; doctor exit 0.
