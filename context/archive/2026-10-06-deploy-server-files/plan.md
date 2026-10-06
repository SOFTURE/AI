# Plan: deploy-server-files

Input: change.md, research.md. Complexity: medium (a workflow job, the server script template, a new input, a test
that runs both halves together, README).

## Goal

One SSH call per release carries a gzip tar archive instead of the bare `.env.prod`. The deploy job packs the folder
of the compose file, the server script, the app's `deploy.json` and `.env.prod`; `init`'s `deploy.sh` checks the
archive, unpacks it into `releases/<tag>/`, moves `.env.prod` into place, installs the other files next to itself and
then runs the release as before. `deploy.sh` replaces itself by a rename, so the new copy runs from the next release.

**Out of scope:** `deploy.sh` reading the row-count tables from the shipped `deploy.json` (DF-8); running the workflow
against a real SSH server (DF-3); the publish and the caller tag (DP-8); deleting files that a release no longer
ships (the server keeps them; recorded in the README).

## Approach

**Chosen:** archive root = what lands in `/srv/<name>/`: the contents of the compose file's folder, `deploy.sh`,
`deploy.json` (when `deploy-config` is set) and `.env.prod`. New input `server-script` (default
`docker/server/deploy.sh`), validated in `check`, which also refuses a compose file at the repository root (its folder
would be the whole tag) and emits the sparse-checkout patterns (`/<compose folder>/`, `/<server-script>`,
`/<deploy-config>`), all anchored. A new step "Pack the release" builds `release.tar.gz` from a staging folder in
`RUNNER_TEMP` (owner 0, numeric), refusing a symlink or other non-regular entry in the compose folder and the names
the server reserves (`.env.prod`, `deploy.sh`, `deploy.json`, `.deployed-tag`, `backups`, `releases`); "Send" feeds
it to `ssh` on stdin; the cleanup step also removes the archive and the staging folder.

On the server, `deploy.sh`: reads at most 16 MiB of stdin into a temp folder, lists the archive (regular files and
folders only, names in a narrow pattern, no `..` segment) before extracting it into `releases/<tag>/`
(`--no-same-owner`), requires `.env.prod`, `deploy.sh` and `docker-compose.yml` in it, moves `.env.prod` to its place
(0600), copies every other file in place (`cp` keeps the inode a running container's bind mount holds; files 0644,
folders 0755) and replaces `deploy.sh` by `cp` to `deploy.sh.new` and `mv`. When `traefik.yml` changed, Traefik is
restarted after the switch, so new rules apply even if the switch did not recreate it. Release folders beyond the
newest 5 are removed. The rest (pull, database steps, switch, tag) is unchanged.

**Rejected:** a per-release folder as the compose project directory (its bind-mount sources change every release, so
compose recreates Postgres each time); `scp`/`rsync` before the SSH call (a second call, and `restrict` with a forced
command forbids both); a new CLI command that packs the archive (the workflow would need a newer published CLI for a
`tar` call); deleting server files a release does not ship (a typo in the compose folder could remove `backups/`).

## Phase 1: Ship the server files

**Discipline:** test-first (the tests below are written and red before the workflow and the template change).
**Files:** `tools/deploy/tests/server-files.test.ts` (new), `tests/repo/deploy-workflows.test.ts`,
`.github/workflows/deploy-app.yml`, `tools/deploy/templates/docker/server/deploy.sh.tmpl`,
`tools/deploy/src/init/generate.test.ts` (if a text assertion moves), `tools/deploy/README.md`,
`tools/deploy/package.json` (0.1.1) and `package-lock.json`.

1. Test (`server-files.test.ts`): the workflow's pack step, run with bash in a fake checkout made from
   `planInitFiles` (no database), and the generated `deploy.sh`, run with the archive on stdin, a stub `docker` on
   `PATH` and `SSH_ORIGINAL_COMMAND="deploy <tag>"`: files installed and equal to the tag's, `.env.prod` 0600,
   `releases/<tag>/` without `.env.prod`, `.deployed-tag`, the switch called; a second release with changed rules keeps
   `traefik.yml`'s inode, restarts Traefik and gives `deploy.sh` a new inode; refusals: empty stdin, a symlink, a `..`
   member, a missing `.env.prod`, each with nothing installed; the pack step refuses a symlink and a reserved name.
2. Test (`deploy-workflows.test.ts`): `server-script` defaults to `docker/server/deploy.sh`; the deploy job's checkout
   is the check job's anchored patterns; "Send" reads `release.tar.gz`; the cleanup removes it.
3. Workflow and template as above; header comments of both; README (deploy workflow steps, `deploy.sh on the server`,
   inputs, the DF-7 limitation replaced by "files a release no longer ships stay on the server").
4. `@softure-ai/deploy` 0.1.1 (the template is published) and `deploy-cli-version` with it. If DF-5's 0.1.1 lands
   first, both changes share that unpublished version.
5. Gates: typecheck, lint, test, build; actionlint with shellcheck over the workflows; shellcheck over the rendered
   `deploy.sh` (both variants).

## Progress

#### Automated
- [x] Phase 1: ship the server files (tests red before the workflow and template, then green)

#### Manual
- [ ] DP-8 (owner): the first publish of `@softure-ai/deploy` and the `deploy-workflows-v1` tag; until then the
  workflow cannot run. The first setup still copies `deploy.sh` to `/srv/<name>/` once (it is the forced command).
