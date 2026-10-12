---
change_id: release-ready-packages
status: archived
---

# Plan: release-ready-packages

Input: change.md. Complexity: small (one phase).

## Phase 1: Patch bumps

**Discipline:** test-after (the repository tests check versions, manifests and changelogs).
1. `npm run release:version -- <package> patch` for charts, core, observability, ui, blog, mailing, mcp-access,
   ops, privacy, config and deploy; delete the local tags it creates.
2. Gates: typecheck, lint, test.
3. After merge: `auto-release` with the eleven names; confirm each version with `npm view`; comment the released
   version on the closed issues.

## Progress

- [x] Phase 1: patch bumps (`3e020cd`..`086c144`; typecheck, lint and tests green before deploy was added, `npm test` again in pre-push)
