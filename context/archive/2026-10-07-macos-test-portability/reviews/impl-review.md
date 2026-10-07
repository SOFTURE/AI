---
change_id: macos-test-portability
reviewed: bdc7357..HEAD
date: 2026-10-07
verdict: approved
---

# Implementation review: macos-test-portability

Checked the diff against `plan.md` and the issue, then ran the tests on a real Mac through the new CI job.

## Verification

| where | bash | tar | deploy tests + deploy workflow repository tests |
| --- | --- | --- | --- |
| Linux, emulation of change.md first in `PATH` (after merging master) | 3.2.48 | bsdtar 3.7.2 | 252 passed, 14 skipped (Docker-only) |
| Linux, runner tools | 5.2.21 | GNU tar | 250 passed, 14 skipped (before the merge) |
| `macos` CI job, `macos-latest` arm64 | 3.2.57 | bsdtar 3.5.3 | 252 passed, 14 skipped |

The Mac run includes the three `server-files.test.ts` tests the issue could not explain (the schema-guard restore,
the cron step report, the send step's ssh failure): all pass there with the portable pack step, so they most likely
failed through the pack step's `--owner` flag. Full `npm test` on Linux: 318 files passed, 6 skipped. On the PR's first head the rest of CI
(static, build, actionlint with shellcheck, e2e, the deploy e2e through `deploy-app.yml`) is green; the full suite runs
again on the final head.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `deploy-app.yml` ships to apps with `@softure-ai/deploy`; a change to its steps belongs in that package's changelog even when the runner behaves the same. | Fixed: a line under `## Unreleased` in `tools/deploy/CHANGELOG.md`. |
| 2 | Suggestion | The pack step's `tar --version` probe runs on every release. | Accepted: one process, and it keeps the GNU flags on the runner. |
| 3 | Suggestion | The issue's mailing `suppressions` and ops `health` failures are not shell related and did not reproduce on Linux (8 shuffled runs green) nor ran in the `macos` job (it runs the shell script tests only). | Left as Manual 1.5: `npm test` on the owner's Mac. |

No open blocking finding.
