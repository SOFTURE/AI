# Implementation review: backup-verify-live-release

Verdict: **approved** (auto, autonomous mode).

- Both asks of #1386 are in the example: the release walk (newest 20 published releases, first tag the registry holds,
  login before it) and the failure issue (label, one issue per streak, comment on the open one, best-effort assignee,
  close on green). The Cloudflare template carries the issue steps, as planned.
- Evidence: `tests/repo/backup-verify-workflows.test.ts` runs every new step with bash and fake `gh`/`docker` (16
  cases: in-flight release skipped, newest taken, none and no release fail, issue opened, opened without assignee,
  commented, closed, nothing to close; both files) and holds the example's CLI pin to the package version;
  `tools/deploy/tests/init-cloudflare.test.ts` checks the generated permission and step order.
  `npx vitest run tests/repo tools/deploy modules/backup`: 1957 passed, 0 failed.
- Shell: POSIX `[ ]`, `for … in $(…)`, no arrays or GNU-only flags (bash 3.2-safe).
- Versions: backup 0.1.3, deploy 0.7.7 (both free on npm), `deploy-cli-version` 0.7.7 in the three workflows; the
  lockfile changed only the two version lines.
