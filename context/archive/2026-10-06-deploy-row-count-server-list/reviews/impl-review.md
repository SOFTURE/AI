# Implementation review: deploy-row-count-server-list

Reviewed: commit `86d79e7` against plan.md (phase 1) and the plan review's accepted fixes. Verdict: **approve**, no
open findings.

## Against the plan

- `deploy.sh.tmpl`: `ROW_COUNT_TABLES` is gone; `release_config="$release_dir/deploy.json"`; a `node -e` check exits
  0 (non-empty list) or 3 (no file, no key), anything else stops the release before the switch with "cannot read the
  row-count tables of the release's deploy.json."; `row-counts --config="$release_config"` with `--out` before and
  `--compare` after the switch; the first-release skip is unchanged. Matches the plan.
- `deploy.json.tmpl` and `generate.ts`: `database.rowCountTables` before `verify`, only with a database and a list.
- Plan review fix 1 (README: by hand when `init` keeps `deploy.json`) and fix 2 (first release with tables calls no
  `row-counts`, asserted in the first database test) are in.
- Phase 2 (gap DF-9) recorded in the roadmap, its lanes and order, the backlog README and its entry.

## Checks

- Tests were red before the templates changed (6 failing: the order assertion, the `release_config` and
  `rowCountTables` assertions, three of the five server-side database cases), green after.
- Gates: `npm run typecheck`, `npm run lint`, `npm test` (3627 passed after the two repository-test fixes in the
  docs, see below), `npm run build`. shellcheck 0.11 over both rendered `deploy.sh` variants: clean.
- The server tests run the real workflow pack step and the rendered script with stub `docker` and `npx`: the second
  release passes `--config=<srv>/releases/v2/deploy.json`, a release without `deploy.json` ignores the older copy
  next to the script, and an unparsable file stops before `compose up … traefik app`.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | Without Node on the host the check fails with "cannot read the row-count tables…" after bash's "node: command not found". Node is already required (the backup step before it runs through `npx`), so the release never reaches the check without it. | Kept as is. |
| 2 | Suggestion | A `deploy.json` whose list is present but invalid passes the `node` check and fails in `row-counts` ("counting rows failed; nothing was restarted") with the schema issue printed by the CLI. | Kept: the CLI's message names the issue; one validator, not two. |

During the full run two repository tests failed on this change's own docs (a relative link in `backlog-input.md`
one level too deep after the move, and the roadmap row's stage not updated with the block's); both fixed before
the archive commit.
