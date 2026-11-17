# Plan: connections-fake-github-repository-contents

## Approach
Contents per repository full name inside `createFakeGithubApp` (blobs by git id, commits with parents, trees by sha),
four GET routes behind the installation token check, two mutators for pushes and force-pushes.

## Decisions (auto)
- Contents keyed by full name, not by installation: a repository outlives an installation of the App.
- Folders listed as `tree` entries in a recursive tree, as GitHub does; sorted by path.
- Renames paired by equal blob ids between a removed and an added path (GitHub's similarity detection, simplified).
- Minor bump (0.6.0): new public members of the testing entry.

## Phases
1. Fake and tests (test-after). Done when the connections tests, typecheck and lint are green.
2. README example, CHANGELOG, version bump.

## Progress
- [x] Phase 1: `npx vitest run modules/connections/tests/github-app.test.ts` 13/13 (3 new).
- [x] Phase 2: README, CHANGELOG 0.6.0, package.json, module.json, inline manifest and lockfile at 0.6.0.
