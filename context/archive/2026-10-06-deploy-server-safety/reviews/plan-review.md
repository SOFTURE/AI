# Plan review: deploy-server-safety

Reviewed: plan.md against change.md, research.md, the DF-1, DF-7 and DF-8 archives, FIRE's two server scripts and
the code (`templates/docker/server/deploy.sh.tmpl`, `.github/workflows/deploy-app.yml`,
`tests/server-files.test.ts`, `src/cli/db-commands.ts`, `src/init/render-template.ts`).
Verdict: **ready to implement** after the accepted fixes below.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical (checked, no change) | The script that runs a release is the one already installed; a newer `deploy.sh` takes effect from the next release. A server still on a pre-DF-9 script prints no `result|ok`, so the stricter workflow would fail a release that went live. | No server runs a workflow-shipped script yet: DF-7's shipping, the `deploy-workflows-v1` tag and `@softure-ai/deploy` 0.1.3 are all unreleased, and an app's first setup copies `deploy.sh` by hand. The README states that the workflow needs a server script from 0.1.3 on; no fallback that would accept a missing result line. |
| 2 | Warning | The `postgres` step runs `compose up --wait postgres` with the **new** files, before the backup. A release that changes the postgres service restarts it there, and a later failure restores the files but not that container. | Accepted as a documented limit: the header and README say a changed postgres service takes effect at that step; the restore covers files, not containers already started. Same as today. |
| 3 | Warning | The lock wait must stay under the deploy job's `timeout-minutes: 15`, or a release waiting on a long `maintain` is killed by the runner with no result line. | Fixed in the plan: `flock -w 600`. |
| 4 | Warning | A crontab line breaks on `%` and newlines, and the app folder comes from the filesystem, not from `init`'s checked answers. | Accepted: the cron step refuses a folder path outside `^/[A-Za-z0-9_./-]+$` with a failed result naming it. |
| 5 | Warning | `flock` is not on macOS by default, so tests that run the real script with it would fail on a Mac. | Accepted: tests put a stub `flock` on `PATH` like `docker`, `npx` and `crontab`; the host requirement is in the README. |
| 6 | Suggestion | `maintain` is reachable over SSH with the deploy key too, so the key can trigger a backup. | Kept: the key already triggers a backup on every release, and `maintain` takes no argument. |
| 7 | Suggestion | `.env.prod.prev` written before the switch would be overwritten by a failed release with the current file. | The plan already writes it at the switch only; a test asserts a failed release leaves it untouched. |

Contracts checked: `backup` takes `--max-age-days` and prunes per prefix (`db-commands.ts`, `backup.ts`), so a daily
`backup` with the release's prefix keeps one policy for both; `renderTemplate` replaces only `{{key}}` starting with
a letter, so `{{.Service}}` and `{{.Tag}}` reach the script unchanged; `cp` onto an existing file keeps its inode, so
the restore keeps Traefik's bind mount. No migration, no new dependency, no version bump (0.1.3 unpublished).
Lessons: the new behaviour is test-first; each restore test fails on the current template.
