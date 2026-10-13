---
change_id: release-batch-3
status: planned
---

# Plan: release-batch-3

Input: change.md. Complexity: small (three phases).

## Phase 1: Widen

**Discipline:** test-after (the repository tests check internal ranges).
1. Every internal range on a package that goes to 0.2.0 / 0.3.0 also accepts the new version (`|| ^0.2.0`), so
   `release:version` accepts each bump while the workspace still links.
2. ops CHANGELOG: a line for the `softure-deploy run --local` README addition. db and observability: a CHANGELOG
   `## Unreleased` line for the widened core range.

## Phase 2: Bumps

**Discipline:** test-after.
1. `npm run release:version -- <package> <bump>`: minor for the eighteen packages with breaking entries, patch for db
   and observability. Delete the local tags.

## Phase 3: Require the new versions

**Discipline:** test-after.
1. Internal ranges between the released breaking packages become `^<new>` only; `dependsOn` in `module.json` and
   the inline manifests likewise. db and observability keep `^0.1.x || ^0.2.0`.
2. deploy: the `deploy-cli-version` defaults of deploy-app, deploy-report and deploy-integration and the README pin
   example follow 0.2.0.
3. Tests that pin ranges follow. `npm install` refreshes the lockfile.
4. Gates: typecheck, lint, test, build.
5. After merge: `auto-release` with the twenty names; confirm each version with `npm view`.

## Progress

- [ ] Phase 1: widen
- [ ] Phase 2: bumps
- [ ] Phase 3: require the new versions
