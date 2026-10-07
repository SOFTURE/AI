# Plan: release-pending-changes

Input: change.md. Complexity: small (one phase).

## Phase 1: Patch bumps

**Discipline:** test-after (the repo tests check versions, manifests and changelogs).
1. `## Unreleased` entry for security (deploy, ops and marketing-kit have theirs).
2. `npm run release:version -- <package> patch` for deploy, security, ops, marketing-kit (charts, ui and seo left to #194 and #197);
   delete the local tags it creates.
3. Gates: typecheck, lint, test.
4. After merge: `auto-release` with the four names; confirm each version with `npm view`.

## Progress

- [x] Phase 1: patch bumps (commits fc045ba..b00d7de and this change's merge)
