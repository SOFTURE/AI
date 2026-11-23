# Research: host-deploy-user-preflight

## How it works today

- `tools/host/src/inventory/schema.ts`: `server.adminUser` and `server.deployUser` (default `deploy`) are independent
  user names; nothing compares them.
- `tools/host/ansible/app.yml` (`softure-host app add`): a variable assert, then the collection role
  `softure.vps_foundation.deploy_user`, then the key-line check, the app folder and the first `deploy.sh`.
- `tools/host/ansible/server.yml` (`softure-host server`): imports `softure.vps_foundation.vps_bootstrap` (hardening,
  UFW, Docker...), then the roles `deploy_user`, `traefik_edge`, `cloudflare_origin`.
- The collection role (`vps_foundation/roles/deploy_user/tasks/main.yml`, 1.25.0, read from the tag): creates the
  user with `password_lock: true` **before** its task "Refuse a deploy user with sudo rights" (`id -nG`, only
  `sudo`/`admin`), and that task has `when: ... not ansible_check_mode`. So a sudo user's password is locked by a run
  that then fails, and `--check` never sees the conflict. Its sudoers files are never read.
- `--check` maps to `ansible-playbook --check --diff` (`src/ansible/commands.ts`). The CLI passes a placeholder key in
  check mode (`app-add-command.ts`), so the role's "Write the release key line" runs.

## Measured check-mode behaviour (ansible-core, local connection, user absent)

- `file` (directory, owner = missing user) and `copy` (`force: false`, owner = missing user): report `changed`, no
  failure.
- `lineinfile` on a missing `authorized_keys`: fails ("Destination ... does not exist", rc 257). This is the only
  task that breaks a first-onboarding dry run (the role's key line); `app.yml`'s grep is already skipped in check
  mode when a key is passed.
- A user that exists without `~/.ssh/authorized_keys` fails the same way.

## Constraints and options

- The collection lives in another repository (SOFTURE/VPS_FOUNDATION), outside this session's scope; the guard must
  sit in this package's playbooks, before the role runs. That is enough for every `softure-host` run.
- `server.yml`'s bootstrap changes the server before the role: the check must be a separate first play.
- `tags: always` keeps the preflight in any tag-limited run; `check_mode: false` on a read-only `command` makes it
  read real state in `--check`.
- Probing without `sudo` installed (the e2e image has none): `getent passwd`, `id -nG`, `grep` over `/etc/sudoers`
  and `/etc/sudoers.d/*` for the user and for `%<group>` of each group it is in.

## Tests and e2e

- Unit: `src/inventory/inventory.test.ts` (schema messages), `src/cli/cli.test.ts` (fake runner, records calls).
- e2e: `e2e/converge.sh` (CI job "host playbooks converge", ubuntu:24.04 container via `community.docker`). Not
  runnable in this container (no Docker daemon, Galaxy blocked): the playbook logic is verified locally with a local
  connection against this container; the e2e runs in CI.
