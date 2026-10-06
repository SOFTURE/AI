# Research: deploy-server-safety

Question: which of FIRE_TRACKER's server-side safety steps the generated `deploy.sh` lacks today, and how each fits
it. Sources: FIRE's `docker/server/gateway.sh` and `docker/server/deploy.sh`, `scripts/deploy-via-gateway.sh` (read
only); this repo's `tools/deploy/templates/docker/server/deploy.sh.tmpl`, `.github/workflows/deploy-app.yml`,
`tools/deploy/tests/server-files.test.ts`, `src/cli/db-commands.ts`, DF-1 research §4.

## 1. FIRE, step by step

- **Gateway** (forced command, installed once): `deploy <tag>` or `status`, nothing else (`read -r -a`, no `eval`).
  `status` prints `stan|tag|…` (`IMAGE_TAG` of `.env.prod`), `stan|kontenery|…` (`compose ps --format
  '{{.Service}}:{{.Status}}'`) and `stan|zdrowie|…` (health of the app container); read only.
- **deploy.sh**: checks the new `.env.prod`, schema guard, counts, `pg_dump` with retention (age 30 days, count 10),
  then saves `docker/prod`, `initdb` and `.env.prod` to a temporary folder, copies the old `.env.prod` to
  `.env.prod.prev`, swaps the files; a failed swap restores them. After `up -d` there is no automatic restore ("the
  migration may have run"); a rollback is a release of the older tag. Traefik: `cmp` of `traefik.yml` before the
  swap, `up -d --force-recreate traefik` when it changed (a bind-mounted file replaced by a new inode is not seen).
  The tag is `IMAGE_TAG` inside `.env.prod`, so a hand `docker compose` uses the live tag. A marked crontab block
  (`# fire-tracker:retencja`) is rewritten by each release: backups older than the limit are deleted daily.
- **Machine lines**: `krok|<name>|…`, `liczniki|…`, `kopia|…`, last `wynik|ok` or `wynik|blad|<step>|<message>`.
  The client (`deploy-via-gateway.sh`) exits 0 only when `wynik|ok` arrived.

## 2. The generated script today (after DF-7 and DF-8)

- Only `deploy <tag>`; exit 2 for anything else.
- The archive is checked, then `.env.prod` and the shipped files are installed next to the script **before** the
  pull, backup, schema guard and row counts. Any of those failing stops the release with the new files installed and
  the old containers running: the gap the item names. Nothing keeps the previous `.env.prod`.
- Traefik: files are installed with `cp` onto the existing file (inode kept, for the bind mount), and a changed
  `traefik.yml` leads to `compose restart traefik` after the switch.
- `TAG` is exported to compose by the script only; the compose file reads `${TAG}`, so a hand `docker compose` on
  the server has no tag.
- Health: `compose up --wait` (healthchecks); kept, as DF-1 decided.
- Backups: `backup --keep=7`, no age limit, and only at a release. No cron. Images of old releases are never removed.
- Output: human lines (`deploy: …`), errors on stderr, exit code only; the workflow trusts the SSH exit status.

## 3. The unknowns of the item

- **Cron lines.** `backup` always dumps, then prunes by count and by `--max-age-days` per prefix. A daily cron that
  runs the same `backup` with the same prefix gives a daily dump and enforces the age limit between releases, with
  no password in the crontab if the cron calls `deploy.sh` itself (it reads `.env.prod`). Images: `docker image
  prune --all` would also remove other apps' unused images on a shared host; removing only this app's image tags
  whose release folder is gone (the newest five stay, so a rollback to them needs no pull) plus dangling images is
  scoped to the app.
- **Result line.** DF-10 (release report) consumes the lines; checking `result|ok` belongs with the lines, so the
  workflow's send step checks it here. DF-10 then only reads them.

## 4. Risks

- A cron run and a release at the same time (backup during a switch, image removal during a pull): serialise both
  with `flock` on a lock file next to the script.
- A restore after the switch would put the old tag's files over a migrated schema: the restore covers failures
  before the switch only, as in FIRE.
- `{{.Tag}}`-style Go templates in the shell template: the template engine only replaces `{{key}}` with a letter
  first (`render-template.ts`), so `{{.Service}}` passes through.
