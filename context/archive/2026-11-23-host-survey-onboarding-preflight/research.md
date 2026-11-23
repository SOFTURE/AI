# Research: host-survey-onboarding-preflight

## How it works today

- `tools/host/src/cli/run.ts`: two commands, `server` and `app add`; `--check` maps to Ansible check mode and
  read-only GitHub/Cloudflare calls.
- `app add` (`src/cli/app-add-command.ts`): GitHub Environment first (may create it), then `deploy.sh` from the repo,
  `ansible/app.yml`, host keys over the admin's SSH (`src/ssh/host-keys.ts`, `ssh -o BatchMode=yes`), secrets and
  the variables `APP_HOST` and `EDGE_NETWORK` (#1429), Cloudflare, then the compose file's required names. Nothing
  reads the server's edge, networks or sshd before changing something.
- `ansible/app.yml`: pre_tasks validate vars and run `tasks/deploy-user-preflight.yml` (#1431, read-only probe,
  `check_mode: false`, tagged `always`); then the collection's `deploy_user` role, key line, folder, `deploy.sh`.
- `server.yml` passes `vps_ssh_allowed_users: [admin, deploy]` to the bootstrap; `app.yml` never touches sshd. On a
  server provisioned elsewhere, an `AllowUsers` without the deploy user turns every release away.
- The compose file of `softure-deploy init --edge` joins a top-level external network `${EDGE_NETWORK:-<network>}`;
  `env render` writes the variable into `.env.prod`, so with `app add` setting it, the default no longer matters.

## Measured

- OpenSSH 9.6 (Ubuntu 24.04): `sshd_config` starts with `Include /etc/ssh/sshd_config.d/*.conf`. With `AllowUsers
  root admin` in the main file and `AllowUsers deploy` in a drop-in, `sshd -T -C user=deploy,...` prints three
  `allowusers` lines (deploy, root, admin): AllowUsers directives accumulate, so a drop-in widens the list without
  rewriting the operator's file. `sshd -t` validates the result.
- A drop-in with `AllowUsers` when the server has none would restrict sshd to that user: the drop-in is written only
  when `AllowUsers` is already set.
- sshd's order is DenyUsers, AllowUsers, DenyGroups, AllowGroups; a user must pass every one that is set.
- `docker inspect` gives the compose project label, networks and Traefik's `Args` (`--entrypoints.<n>.address`,
  `--certificatesresolvers.<n>.*`); router labels `*.tls.certresolver` name resolvers too.
- The e2e container runs `/usr/sbin/sshd` without systemd and writes `/run/sshd.pid`: a reload sends `HUP` there when
  no `ssh`/`sshd` unit is active.

## Options

1. All checks in Ansible: the compose file comes from GitHub (CLI side) and Docker facts would need a second play;
   duplicate plumbing. Rejected for the edge checks.
2. CLI probe (one `sh -s` script over the admin SSH, the same one `survey` prints) for edge and network facts; sshd
   detection and fix in `app.yml` (needs root, and must write). Chosen: `survey` and the preflight share one probe,
   and the sshd fix sits where the write happens, in check mode as a planned change.
