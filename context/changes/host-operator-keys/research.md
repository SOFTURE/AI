# Research: host-operator-keys

## What exists

- `tools/host/ansible/app.yml` runs `softure.vps_foundation.deploy_user` (collection 1.25.0) with
  `deploy_user_apps: [{name, key}]`. The role writes `command="<root>/<name>/deploy.sh",restrict <type> <body>
  <name>-release` with `lineinfile`, `regexp: '\s<name>-release$'`: one line per app, replaced in place, other lines
  never touched. The key's own comment is dropped.
- The role's key pattern: `^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+|sk-ssh-ed25519@openssh.com) [A-Za-z0-9+/=]+( [^\n]*)?$`.
  `server-command.ts` holds the same pattern for `server.adminPublicKey`.
- The deploy user's home is the role default `/home/<deployUser>`; `.ssh` 0700, `authorized_keys` 0600, owned by the
  deploy user.
- The admin user has `NOPASSWD:ALL` sudo (`system_hardening`, `users.yml`), which is how Ansible becomes root without
  a prompt; `readHostKeys` already runs one command over the admin's SSH connection with `BatchMode=yes`.
- `deploy.sh` (deploy template) accepts `deploy <tag>`, `status`, `maintain [<hook>]`, `cleanup [--keep=<n>]
  [--commit]`, and with a database `run <script> [arguments]` and `report [arguments]`. The deploy README's
  "Ops scripts and reports" step 3 tells the operator to bind their key by hand.
- `e2e/converge.sh` converges `app.yml` in an Ubuntu container over the docker connection and logs in through sshd.

## Options

- Reuse the role with a second `deploy_user_apps` entry: impossible, the role derives the comment `<name>-release`
  and the forced command from `name`, so an operator line would need a fake app name and would collide.
- A small playbook of our own with `lineinfile` (chosen): same mechanics as the role (atomic write, owner and mode,
  check mode with diff), matched by the operator comment.
- Editing over a raw SSH session with sed: no check mode, easy to get wrong. Used only for the read-only `list`.

## Collisions

- Labels are `[a-z0-9]{1,32}` without dashes and not `release`: the comment `<slug>-operator-<label>` then splits
  uniquely at its last `-operator-`, never ends in `-release` (the role's regexp), and two apps never share a comment.
- sshd uses the first line whose key matches, so the same key on two lines makes one of them dead or wrong. The
  playbook refuses a key whose body is on any line other than the one it owns (release key, another app's line,
  another label, a line added by hand).
