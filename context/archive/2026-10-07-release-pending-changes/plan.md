# Plan: release-pending-changes

Input: change.md. Complexity: small (one phase).

## Phase 1: Patch bumps

**Discipline:** test-after (the repo tests check versions, manifests and changelogs).
1. `## Unreleased` entries for security, charts and ui (deploy, ops and marketing-kit have theirs).
2. `npm run release:version -- <package> patch` for deploy, security, ops, marketing-kit, charts, ui (seo left to #194);
   delete the local tags it creates.
3. Gates: typecheck, lint, test.
4. After merge: `auto-release` with the six names; confirm each version with `npm view`.

## Progress

- [x] Phase 1: patch bumps (commits fc045ba..966d34f and this change's merge)
