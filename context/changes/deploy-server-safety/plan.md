# Plan: deploy-server-safety

Input: change.md, research.md. Complexity: medium (one shell template grows by about a third; one workflow step;
tests drive the rendered script with stub `docker`, `npx` and `crontab`).

## Goal

The generated `deploy.sh`:

1. answers `status` read only: `status|tag|…`, `status|env-tag|…`, `status|containers|…`, `status|health|…`;
2. saves every file the release is about to install (and `.env.prod`) before installing it; any failure **before the
   switch** puts them back (rules by `cp`, keeping the bind mount's inode; `deploy.sh` by rename) and removes files
   and folders the release created; at the switch the previous `.env.prod` becomes `.env.prod.prev` (0600);
3. writes `TAG=<tag>` into the installed `.env.prod`;
4. recreates Traefik (`up --detach --wait --force-recreate traefik`) after the switch when `traefik.yml` changed;
5. installs, after a successful release, a marked crontab line (`# softure-deploy:<name>`) that runs
   `SSH_ORIGINAL_COMMAND=maintain <dir>/deploy.sh` daily; `maintain` takes a backup with the release's prefix,
   `--keep` and `--max-age-days` (database apps) and removes this app's images whose release folder is gone, plus
   dangling images; the release's own backup gets `--max-age-days` too (`BACKUP_MAX_AGE_DAYS=30`, FIRE's privacy
   bound);
6. prints `step|<name>|ok[|detail]` per step and ends every `deploy` and `maintain` run with `result|ok` or
   `result|failed|<step>|<message>`, unexpected exits included (EXIT trap);
7. serialises `deploy` and `maintain` with `flock` on `.deploy.lock` (waits up to 10 minutes, below the deploy job's 15).

`deploy-app.yml`'s send step fails unless the server's output holds the line `result|ok`, and the pack step reserves
`.env.prod.prev` and `.deploy.lock`; the script refuses an archive that carries a reserved name.

**Out of scope:** the release report that reads the lines (DF-10); restoring after the switch (a rollback stays a
redeploy of the older tag); FIRE's app-specific steps (`konta-wyslij`, blog sync, `auth_attempts` cleanup); a version
bump (0.1.3 is unpublished).

## Approach

**Chosen:** keep one script (no gateway split: DF-7 already ships the script with each release). Failure handling
moves into the EXIT trap: `fail` records the step and message and exits; the trap restores while `restore_armed` is
set, prints the result line and cleans up. `begin_step <name>` sets `current_step`, and each step prints its own
`step|<name>|ok` right after it succeeds, so a crash between them still names the step it was in.

**Rejected:** restoring after the switch (stale files over a migrated schema, FIRE's own reasoning); `docker image
prune --all` (other apps on a shared host); the password in a crontab line calling the CLI directly (the cron calls
the script, which reads `.env.prod`); machine lines on stderr (the workflow reads stdout; humans read both).

## Phase 1: deploy.sh safety steps

**Discipline:** test-first.
**Files:** `tools/deploy/tests/server-files.test.ts`, `tools/deploy/templates/docker/server/deploy.sh.tmpl`,
`tools/deploy/src/init/generate.test.ts` (only if a content assertion moves), `tools/deploy/README.md`.

1. Tests (stub `docker` gains `FAIL_ON=<word>` to fail a chosen call and answers `ps` and `inspect`; a stub
   `crontab` keeps its table in a file; a stub `npx` can fail on a chosen command):
   - a release prints `step|…|ok` lines and ends with `result|ok`; `.env.prod` ends with `TAG=<tag>`; the crontab
     holds exactly one marked line calling `SSH_ORIGINAL_COMMAND=maintain <dir>/deploy.sh`, kept once over two
     releases, a foreign line kept;
   - a second release keeps the first `.env.prod` as `.env.prod.prev` (0600);
   - a pull that fails after the install restores `.env.prod`, `docker-compose.yml`, `traefik.yml` (same inode),
     `deploy.json` and `deploy.sh`, removes a file the failed release added, prints `result|failed|pull|…`, leaves
     `.deployed-tag` and `.env.prod.prev` untouched; with a database, a schema guard refusal does the same;
   - a failing switch prints `result|failed|switch|…` and restores nothing;
   - a changed `traefik.yml` recreates Traefik (`up --detach --wait --force-recreate traefik`), an unchanged one
     does not;
   - `status` prints the four lines and never writes (server folder unchanged); before the first release it prints
     `none`;
   - `maintain` without a database removes image tags without a release folder and prunes dangling images; with a
     database it runs `backup` with `--max-age-days=30` first; it ends with `result|ok`;
   - an archive holding `.env.prod.prev` is refused; an unknown command exits 2 with `result|failed|command|…`.
2. Template as in the goal; header comment lists the commands, steps, lines and the cron.
3. README: the server commands, the restore rule, the lines, the cron and what the host needs (`cron`, `flock`).
4. Gates: typecheck, lint, test, build; shellcheck over both rendered variants (if it can be installed).

## Phase 2: the workflow checks the result line

**Discipline:** test-first.
**Files:** `.github/workflows/deploy-app.yml`, `tests/repo/deploy-workflows.test.ts` or
`tools/deploy/tests/server-files.test.ts`.

1. Test: the pack step refuses `docker/prod/.env.prod.prev`; the send step's script ends by checking `result|ok` in
   the captured output (asserted on the step text, the SSH call itself is DF-3's e2e).
2. Send step: `ssh … < release.tar.gz | tee "$RUNNER_TEMP/deploy-output.txt"`, then `grep -qx 'result|ok'` or an
   `::error::` naming the missing line; reserved names gain `.env.prod.prev` and `.deploy.lock`.

## Progress

#### Automated
- [ ] Phase 1: deploy.sh safety steps
- [ ] Phase 2: the workflow checks the result line

#### Manual
- [ ] Owner: the release of `@softure-ai/deploy` 0.1.3 (with DF-7, DF-8); an app takes the new script with
  `init --force` for `docker/server/deploy.sh` (or by hand) and its next release installs it; the host needs `cron`
  and `flock` (both in Ubuntu's base image).
