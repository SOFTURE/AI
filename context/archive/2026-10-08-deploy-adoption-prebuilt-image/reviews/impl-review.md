# Implementation review: deploy-adoption-prebuilt-image

Reviewed: the branch diff against plan.md, change.md and issue #246.
Verdict: **approve after fixes** (all applied before the commit).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | `run_hooks` reads the hook records from the settings file on stdin, and each hook inherited that stdin: a hook that reads stdin (`compose exec -T`, a script with `cat`) swallowed the records after it, so the later hooks of that point never ran and the step still passed. | Fixed: every hook runs with `/dev/null` as stdin. A test with a draining hook followed by another one was red before the fix. |
| 2 | Warning | The CHANGELOG first said an older `deploy.sh` ignores the new keys; the 0.1.4 CLI parses `deploy.json` with strict objects and refuses them (`row-counts --config`, `verify`). | Fixed: the entry says to move `deploy.sh` and `deploy-cli-version` to this version together. |
| 3 | Warning | The README and source comments named the adopting app; the repository's wording rule wants it neutral. | Fixed: the parity section is rewritten for "an adopting app", comments and fixtures neutral. Links to the archived research keep its existing folder name. |
| 4 | Check | `prebuilt-image`: by digest only, same repository as `image`, refused with `e2e`; the re-tag fails when the tag then names another digest; checkout and build are skipped, login and buildx stay (imagetools needs both). | No change. |
| 5 | Check | Shell portability: no associative arrays, `mapfile`, `${var,,}` or GNU-only flags in `deploy.sh` or the workflow steps; `read -d ''` and `[[ =~ ]]` are bash 3.2. | No change. |
| 6 | Check | Drift from plan: `--only-hook` became one `scheduled-<name>` settings file per scheduled hook (simpler for the shell); the cron line uses `fail` instead of `echo`/`exit`. | No change. |
| 7 | Check | Security: hook names and cron schedules are pattern-checked in the schema and again in `deploy.sh` before reaching a crontab line; `maintain <hook>` validates the name before any lookup; the journal path is absolute without `..`. | No change. |

Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (results in plan.md Progress).
