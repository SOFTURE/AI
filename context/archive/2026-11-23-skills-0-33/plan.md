# Plan: skills-0-33

## Approach
One phase: install `@softure-ai/skills@0.33.0`, run the installer, run the doctor (and `doctor --fix --write` plus
manual fixes if it reports `roadmap-item-shape`), regenerate `context/state.json`, run the doctor again.

## Decisions (auto)
- D1 `project` stays unset in `context/workflow.json` (the installer's hint): `context/state.json` already reads
  "SOFTURE AI" through the fallback, as decided in skills-0-24 (D2).
- D2 `context/state.json` is regenerated with `npx softure-skills state`, never edited by hand (WORKFLOW §12).

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`, `context/state.json`.
- Done when: the doctor exits 0; the CI gates pass.

## Progress
- [x] Phase 1: skills 0.33.0 installed; managed block refreshed; doctor reports no problem; state.json regenerated;
  doctor exit 0.
