# Implementation review: deploy-server-safety

Reviewed: commit `3e64e56` and the review fixes after it, against plan.md (phases 1 and 2), the plan review's
accepted fixes and FIRE_TRACKER's `docker/server/gateway.sh` and `deploy.sh`. Verdict: **approve** after the three
fixes below; no open findings.

## Against the plan

- `status`, `deploy <tag>` and `maintain` are the only commands; anything else, or a command over several lines,
  exits 2 with `result|failed|command|…`. `status` takes no lock, writes nothing and prints the four `status|…` lines
  (`none` before the first release).
- `save_previous` copies every installed file the release is about to replace (`.env.prod` and `deploy.sh`
  included) and lists what it adds; `restore_previous` runs from the EXIT trap while `restore_armed` is set (from the
  `files` step until the switch), copies onto the installed files (Traefik's inode kept), renames the script back and
  removes the added files and folders, deepest first. `.env.prod.prev` is written at the switch only.
- `TAG=<tag>` replaces any `TAG=` line of the rendered `.env.prod`. Traefik is recreated (`up --detach --wait
  --force-recreate traefik`) when `traefik.yml` changed, instead of DF-7's `restart`.
- `maintain`: with a database `backup --keep=7 --max-age-days=30` (the release's backup takes `--max-age-days` too),
  then this app's image tags without a release folder and dangling images. The cron line calls the script with
  `SSH_ORIGINAL_COMMAND=maintain` and a fixed `PATH`, so no password goes into the crontab.
- `step|<name>|ok[|detail]` per step, `result|ok` or `result|failed|<step>|<message>` from the EXIT trap, so an
  unexpected exit also ends with a result line. `flock -w 600` on `.deploy.lock` around `deploy` and `maintain`.
- `deploy-app.yml`: the send step runs `ssh … | tee "$RUNNER_TEMP/deploy-output.txt"` under `pipefail` and fails
  without the line `result|ok`; the pack step reserves `.env.prod.prev` and `.deploy.lock`.
- Plan review fixes in: 600 s lock wait (3), the folder pattern for the crontab line (4), stub `flock` in tests (5),
  the postgres limit in the header and README (2), the README note on scripts from 0.1.2 or earlier (1).
- Phases 1 and 2 landed in one commit: their tests share `server-files.test.ts`, and phase 2's tests fail without the
  workflow change.

## Checks

- Tests red first: against the old template 21 of the new server tests failed, against the old workflow the three
  phase 2 tests failed; all green after.
- The send step test runs the step's own script with a stub `ssh` under GitHub's default `bash -e`: `result|ok`
  passes, exit 0 without it fails, a failed `ssh` fails with its status.
- shellcheck 0.11 over both rendered variants (with and without a database): clean.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The cron step read the crontab with `crontab -l … \|\| true`: any read error (not only "no crontab") gave an empty table, and `crontab -` then replaced the user's other lines. FIRE has the same pattern. | Fixed: only "no crontab" counts as empty; any other error fails the step (`cannot read the crontab; <tag> is live.`) and leaves the table alone. Test added. |
| 2 | Suggestion | `connect_database` ran before `begin_step postgres`, so a missing `POSTGRES_PASSWORD` was reported as `result|failed|pull|…`. | Fixed: it runs inside the `postgres` step. |
| 3 | Suggestion | Without `flock` on the host the lock step said another run held the lock. | Fixed: a missing `flock` is named (`flock is missing on this host (util-linux).`). |
| 4 | Suggestion | DF-3's end-to-end run puts this script on a throwaway SSH server: that image needs `cron` (or a `crontab`) and `flock`, or the release ends with `result|failed|cron|…`. | Not a gap here: passed to DF-3 through the coordinator. |

No new roadmap gaps.
