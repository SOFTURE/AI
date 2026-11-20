# Plan: skills-0-24

## Approach
One phase: install `@softure-ai/skills@^0.24.0`, regenerate `context/state.json`, rename the existing doctor job in
`.github/workflows/ci.yml` to `context-doctor`, run the doctor and the gates.

## Decisions (auto)
- D1 The job keeps `npm ci` + `npx softure-skills doctor` instead of the installer's pinned `npx --package
  @softure-ai/skills@<version>`: the doctor's version then comes from the lockfile and cannot drift from the
  devDependency at the next bump.
- D2 `project` is left to the fallback: `context/state.json` already reads "SOFTURE AI", the name the project uses.
- D3 Since 0.24.0 an idle roadmap placeholder contributes nothing to `owner_queue`, so the off-site backup owner step
  under `## Owner decisions and checks` of the idle `roadmap.md` no longer appears there. The step stays in the
  markdown; the gap is filed as SOFTURE/SKILLS#63.

## Phase 1: bump (test-after)
- Files: `package.json`, `package-lock.json`, `AGENTS.md` (managed block only), `context/state.json`,
  `.github/workflows/ci.yml`.
- Done when: the doctor exits 0; the `AGENTS.md` diff sits inside the managed block; typecheck, lint and tests pass.

## Progress
- [x] Phase 1: skills 0.24.0 installed; state.json regenerated; job `context-doctor`; doctor exit 0; gates green.
