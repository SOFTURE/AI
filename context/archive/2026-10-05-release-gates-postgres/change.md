---
change_id: release-gates-postgres
title: "A tag release runs its test gate with the Postgres server and browser the tests need"
status: archived
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

`release.yml`'s "validate and pack" job runs `npm test` on a tag (step "Gates"). It now has the same
test setup as `ci.yml`'s test job: a `postgres:16` service with `SOFTURE_TEST_POSTGRES_URL`, and
`PLAYWRIGHT_CHROMIUM_PATH` for the marketing-kit screenshot tests. A repository test keeps the two
workflows in step.

## Context

The first tag release (auto-release run 37335587576, 2026-10-05, all 16 packages at 0.1.0) failed in
every `release.yml` run at "Gates": 3 tests failed, 3340 passed. All three are the "is configured in CI"
guards (`foundation/db/tests/postgres-env.test.ts`, `modules/billing/tests/lock-races.test.ts`,
`modules/blog/tests/publish-race.test.ts`): `POSTGRES_ADMIN_URL` was undefined because the release job
had no Postgres service. Pull request runs of `release.yml` skip "Gates", so the gap stayed hidden
until the first tag. Nothing was published: every later job was skipped.

## Constraints

- Owns: `.github/workflows/release.yml` (validate job setup only), `tests/repo/release-workflow.test.ts`.
- Publishing jobs unchanged; the workflow file name stays `release.yml` (npm trusted publishers).
- `STRIPE_SECRET_KEY` stays out of the release job: the sandbox test skips without it, and a release
  has no reason to hold the key.

## Notes

- Placement: no main roadmap in flight; a fix to the release the owner asked for (`release-dispatch`).
- Research and framing skipped: the cause is read from the run log above, and the fix copies ci.yml.
- Open after the merge: the 0.1.0 tags point at 69b743a, whose `release.yml` lacks this fix, so a
  re-run on them fails the same way. Moving a tag is not something this session may do; the owner
  decides between new versions and deleting the tags (thread).
