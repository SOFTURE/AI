# Plan review: deploy-adoption-prebuilt-image

Reviewed plan.md against change.md, research.md, the template and the tests on master `c323892`. Mode: autonomous
(decisions taken, recorded here).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Critical | `compose exec … pg_dump \| softure-deploy backup --stdin`: a `pg_dump` that dies halfway still leaves a stream that starts with `PGDMP`. The CLI would keep the truncated dump as the newest backup and its retention could remove an older good one before bash's `pipefail` stops the step. | Accepted. The template dumps into a hidden file in the backup folder first (`.incoming-<pid>.dump`, never a backup name), checks `pg_dump`'s status, then hands that file to `backup --stdin`; the README says `--stdin` takes a finished dump only. |
| F2 | Warning | compose-exec still calls `connect_database`, which fails without `POSTGRES_PASSWORD` in `.env.prod`: an app whose compose uses another password variable could not deploy. | Accepted. Only `host` access reads `POSTGRES_PASSWORD`; compose-exec reads `POSTGRES_USER`/`POSTGRES_DB` with defaults. |
| F3 | Warning | `install_release` installs every shipped file 0644, so `run: ["./hooks/x.sh"]` is not executable on the server. | Accepted. README examples call `bash hooks/x.sh`; the schema description says so. |
| F4 | Warning | The app journal path may be missing in the image (wrong path, a build without it): `docker cp` fails with a bare Docker message. | Accepted. The schema step fails with "the image has no <journal>" before the guard runs; tested. |
| F5 | Warning | `maintain <name>` for a name that is not a scheduled hook (removed from deploy.json since the crontab line was written) must not run the daily work silently. | Accepted. It fails naming the hook; the next release rewrites the crontab lines anyway. |
| F6 | Suggestion | Phase 2 makes the stub `npx` call the real CLI through `tsx`; each call costs a Node start. | Accepted as is: only `server-settings` and `--print-query` go to the real CLI, and the stubs stay for the DB work. |
| F7 | Suggestion | `prebuilt-image` re-tagging needs `packages: write` and buildx, which the build job already has; checkout is not needed. | Accepted, matches the plan. |

No finding blocks the plan; F1–F5 are folded into plan.md's key decisions.
