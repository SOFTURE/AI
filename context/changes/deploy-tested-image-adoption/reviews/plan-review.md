# Plan review: deploy-tested-image-adoption

Reviewed plan.md against change.md, issue #246 and the code it names (`deploy.sh.tmpl`, `deploy-app.yml`,
`schema-guard.ts`, `backup.ts`, `row-counts.ts`, drizzle-orm's `migrator.js`). Verdict: **approve with fixes**; the
four fixes below are applied to plan.md.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `--counts-file` trusted the JSON's keys: a psql run against a stale SQL file (another table list) would compare the wrong tables. | Fixed: the file must hold exactly the tables of the list (`--tables`/`deploy.json`), else exit 1 naming the difference. |
| 2 | Warning | In exec mode the helper image (a host without Node) must reach the dump and the psql output: `$work` is mounted, but a dump in `/tmp` and a backup folder on another file system would make the move a copy. | Fixed: deploy.sh writes the dump as a hidden file inside `backups/` (mounted, same file system); `--from-file` renames it and falls back to copy-and-remove only across file systems. |
| 3 | Suggestion | Hooks reach the stack through `COMPOSE_FILE`/`COMPOSE_ENV_FILES`; the latter needs Docker Compose 2.24 or newer. | Fixed: documented in the README with the variables a hook gets; the hook may also pass `--env-file .env.prod --file docker-compose.yml` itself. |
| 4 | Suggestion | A hook's own `step|`/`result|` lines on stdout would land in the release report and could fake `result|ok`. | Already in the plan (hook stdout goes to stderr); a test pins it. |
| 5 | Note | drizzle's hash is the sha256 of the whole file; refusing on a hash difference would block an app that edited a comment in an applied migration (a documented practice for a hand-fixed `USING` clause). | Kept as the plan says: a note line, not a refusal. |
| 6 | Note | `imagetools create` with a digest of another repository would need a token for both packages. | Kept: the input must name the same image; the check job refuses another. |

Lessons: none of `context/foundation/lessons.md` is touched beyond the bash 3.2 rule (AGENTS.md), which the plan's
constraints carry.
