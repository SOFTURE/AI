# Plan review: release-version-inline-manifest

Date: 2026-10-06 · Verdict: approved with one fix applied

Checked against change.md, research.md, `scripts/release/version.mjs`, the twelve `modules/*/src/index.ts`,
`tests/repo/release-version.test.ts` and lessons on unseen-green tests.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The first draft wrote `src/index.ts` without a pre-check, so a module the scan cannot read would fail after `npm version` had already changed `package.json` and the lockfile, unlike every other refusal of the script. | Fixed: "Refuse before changing anything" in Key decisions; the check runs next to the range check. |
| 2 | Suggestion | privacy's doc comment holds `version: "2026-10-01"` outside the manifest; a test on that exact shape guards the scan against a text replace. | Accepted: in the Phase 1 test list ("comment outside the manifest left alone"). |
| 3 | Suggestion | The sweep test should read real files, not fixtures, so a new module with an unusual manifest fails in `npm test` instead of at release time. | Already in the plan (1.2). |

No missing phase: the change is one script and its tests. No migration, no public API change, no version bump.
Criterion 1.3 is verifiable in the container (a local worktree, tag removed, nothing pushed).
