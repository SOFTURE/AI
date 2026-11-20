# Plan: skills-0-22

## Approach
One phase: install `@softure-ai/skills@^0.22.0`, let its postinstall refresh the managed files, run the gates.

## Decisions (auto)
- D1 The doctor's CI job and any `context/` repair stay out of this change: the bump only takes the new rules in.

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md` (managed block only), `.gitignore` (managed lines only).
- Done when: the `AGENTS.md` diff sits inside the managed block; typecheck, lint and the tests pass.

## Progress
- [x] Phase 1: skills 0.22.0 installed; managed block and `.gitignore` refreshed; gates green.
