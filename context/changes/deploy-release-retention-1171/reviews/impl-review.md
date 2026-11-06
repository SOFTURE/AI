---
change_id: deploy-release-retention-1171
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #1171.

- Setting: `releases.keep` int 2..50, default 5, in the zod schema and the committed JSON schema (schema test checks
  bounds, default, refusals); `server-settings` writes `release-keep`; init's `deploy.json` carries it.
- Script: one `clean_up` shared by `maintain` (commit) and `cleanup` (dry run unless `--commit`); the dry run issues
  no `image rm`, prune or `rm` (tested by the docker log and the release folders). Protected: live tag, the TAG of
  `.env.prod.prev`, images of any container (tested). Only `docker image ls` of this app's repositories and
  `softure-deploy-tools` (another repository's image never appears in the log, tested). Disk lines before and after
  (tested). Arguments refused with exit 2 before any docker call (tested).
- Deploy prunes after the settings step with the release's keep, never the previous tag's folder (tested with keep 2).
- bash 3.2: newline lists instead of associative arrays, `df -Pk`, `paste -sd ';' -`, no GNU-only options.
- CLI: `softure-deploy cleanup` validates flags before ssh and sends an empty stdin (tested).
- Gates: typecheck, ESLint on tools/deploy, the package's tests (906 passed, 18 skipped).

Verdict: approved.
