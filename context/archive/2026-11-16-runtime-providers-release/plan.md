# Plan: runtime-providers-release

## Approach

Close the two gaps the audit found in `init --host=cloudflare` (inside the unreleased deploy 0.7.1), write the
adoption guide in `docs/07`, archive the change and the roadmap, then release every untagged package with
`auto-release.yml` (`packages: all`) once the pull request is merged.

## Decisions (auto)

- The observability wrapper goes into the generated `worker.ts`, because that file is the Worker's host entry, as
  `instrumentation.ts` is on Node. Without a database no `worker.ts` is written; `init` warns instead of adding a file.
- No version bump beyond the unreleased ones: deploy 0.7.1 is not on npm yet, so its changelog takes the entries.

## Phase 1: init wiring (TDD)

- `AppFacts.hasObservability` and `usesDatabaseBuild`; the template's `{{#observability}}` wrapper, the health route
  ignored with ops; warnings for observability without a database on Cloudflare and for a database app without
  `withDatabaseBuild` on Cloudflare; no `serverExternalPackages` warning with `withDatabaseBuild`.
- Tests in `init-cloudflare.test.ts` and `init-cli.test.ts`; the example's `worker.ts` regenerated from the template.
- Done when: `npx vitest run tools/deploy` green, the example builds for Cloudflare and its whole e2e passes in
  workerd with the wrapper.

## Phase 2: guide, archive

- `docs/07`: observability on both hosts, moving between hosts (both ways, database, secrets, jobs, backups,
  rollback), adding a host. Archive the change, close the roadmap (`## Summary`, merge SHAs).
- Done when: the repository tests (links, roadmap contract) pass.

## Phase 3: release

- After the merge: `auto-release.yml` from master with `packages: all`; every `release.yml` run green.

## Progress

- [x] Phase 1: init wiring
- [x] Phase 2: guide, archive
- [x] Phase 3: release (after the merge; recorded in the thread's report) — done: merge 20f608b3 (#1317), released from it on 2026-11-17 (`deploy@0.7.1`, `core@0.2.9`, `db@0.1.16` and the other packages, `auto-release.yml` with `all`)
