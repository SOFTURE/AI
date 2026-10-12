---
change_id: release-batch-2
status: archived
---

# Plan: release-batch-2

Input: change.md. Complexity: small (two phases).

## Phase 1: Ranges

**Discipline:** test-after (the repository tests check internal ranges).
1. Widen every `@softure-ai/ui` peer range to also accept `^0.2.0`; dev ranges to `^0.2.0`.
2. mcp-access: `@softure-ai/auth` `^0.1.13`. seo and blog: `@softure-ai/core` `^0.1.11`.
3. CHANGELOG `## Unreleased` lines for the range changes; `npm install` to refresh the lockfile.

## Phase 2: Bumps

**Discipline:** test-after.
1. `npm run release:version -- <package> <bump>`: ui minor; charts, core, db, testing, agent-ready, auth, blog,
   mcp-access, seo, deploy, billing, feature-switches, mailing, privacy, waitlist patch. Delete the local tags.
2. deploy: the `deploy-cli-version` defaults of deploy-app, deploy-report and deploy-integration and the README pin
   example follow the new version.
3. Gates: typecheck, lint, test.
4. After merge: `auto-release` with the sixteen names; confirm each version with `npm view`; comment the released
   versions on the batch's issues.

## Progress

- [x] Phase 1: ranges (`f4143f0`)
- [x] Phase 2: bumps (`bff5b33`..`0437448`; typecheck, lint and tests green)
