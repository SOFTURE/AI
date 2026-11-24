# Plan: skills-bump-0-37

## Approach
One phase: install `@softure-ai/skills@^0.37.0`, run the installer, settle "later" answers in the owner queue,
declare the owner-word wake, regenerate the context state, run the doctor and the gates.

## Decisions (auto)
- D1 `project` stays unset in `context/workflow.json` (the installer's hint), as decided in skills-0-24 (D2).
- D2 `autonomy.ownerWordWake: "routine"`: the project's GitHub-triggered routine on issues.opened claims owner-word
  issues; its firing for #1456 is the verification the installer asks for.

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md`, `context/workflow.json`.
- Done when: the doctor exits 0; typecheck, lint and tests pass.

## Progress
- [x] Phase 1: skills 0.37.0 installed; managed block refreshed; no "later" answers to settle (queue: one open
  entry); state.json unchanged; doctor exit 0.
