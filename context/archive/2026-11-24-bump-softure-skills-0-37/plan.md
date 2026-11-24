# Plan: bump-softure-skills-0-37

## Approach
One phase: install `@softure-ai/skills@^0.37.0`, run the installer, settle owner answers given `later` (WORKFLOW
§8.6), declare `autonomy.ownerWordWake`, regenerate the context state, run the doctor and the gates.

## Decisions (auto)
- D1 `project` stays unset in `context/workflow.json` (the installer's hint), as decided in skills-0-24 (D2).
- D2 `ownerWordWake: "routine"`: the project's issue routine is event-driven (no cron) and its last run fired on the
  opening of #1456, which verifies the GitHub trigger.

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`, `context/workflow.json`.
- Done when: the doctor prints no error and no note; typecheck, lint and tests pass.

## Progress
- [x] Phase 1: skills 0.37.0 installed; managed block refreshed; no `later` entry to move; ownerWordWake declared;
  state.json unchanged; doctor clean.
