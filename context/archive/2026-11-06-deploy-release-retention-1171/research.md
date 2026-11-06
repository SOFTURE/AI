---
change_id: deploy-release-retention-1171
---

# Research

## Code (master dbc2281)

- `templates/docker/server/deploy.sh.tmpl`: `RELEASE_KEEP=5` (line 145) prunes `releases/` in the `files` step of a
  deploy (`ls -1t | tail -n +6`), before `load_settings` reads the release's `deploy.json`. `maintain` removes this
  app's (and the worker's) tags whose release folder is gone, then `docker image prune --force` (step `images`).
  Nothing removes `softure-deploy-tools:<cli>[-pgN]` images (`ensure_tools_image` builds one per CLI version) or the
  build cache.
- `load_settings` runs `softure-deploy server-settings`, which writes one file per setting
  (`src/cli/server-settings-command.ts`); without a database the CLI runs only when `deploy.json` has `"hooks"`.
- The forced command accepts `deploy <tag>`, `status`, `maintain [<hook>]` (+ `run`, `report` with a database).
- `src/cli/remote-command.ts`: `run` and `report` reach the forced command over ssh with an argument list.
- Tests: `tests/server-files.test.ts` runs the generated `deploy.sh` with stub `docker`, `npx`, `crontab`, `flock`,
  `date`; `tests/schema.test.ts` guards the committed JSON schema; `tests/remote-cli.test.ts` stubs ssh;
  `tests/e2e-scripts.test.ts` compares the committed `e2e/app` with init's output.

## Docker facts the cleanup relies on

- `docker image ls <repository> --format '{{.Tag}}'` lists only that repository's tags.
- `docker image inspect --format '{{.Id}} {{.Size}}' <ref>` gives the image id and size in bytes.
- `docker container ls --all --quiet` + `docker container inspect --format '{{.Image}}'` give the image ids every
  container (running or stopped) uses; `docker image rm` without `--force` refuses those anyway.
- `docker image prune --force --filter until=24h` and `docker builder prune --force --filter until=24h` remove only
  dangling images and build cache older than the threshold; both print `Total reclaimed space: <size>`.
- `docker info --format '{{.DockerRootDir}}'` and `df -Pk <dir>` (POSIX output, BSD and GNU) give the disk usage;
  `docker system df --format '{{.Type}} {{.Size}} {{.Reclaimable}}'` the per-type summary.

## Options

1. Setting in `deploy.json` read through `server-settings` (validated), cleanup as one shell function shared by
   `maintain` and `cleanup`, the dry run computing the same plan without removing. Chosen.
2. Parse `releases.keep` in bash without the CLI: avoids the CLI on a no-database host, but skips validation. Rejected.
