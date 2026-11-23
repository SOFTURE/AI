# @softure-ai/host

Provisions a server that hosts several apps and onboards each app onto it with one command. Ansible does the server
work, on top of the [`softure.vps_foundation`](https://github.com/SOFTURE/VPS_FOUNDATION) collection; the CLI
validates the inventory, runs the playbooks it ships, and does what Ansible is awkward at: GitHub through `gh` and
Cloudflare through its API. Every command is idempotent and takes `--check`, which changes nothing anywhere.

It is the server side of the one-VPS model of [`@softure-ai/deploy`](../deploy/README.md): `deploy` covers
everything from the release on; `host` sets up the server and the app's place on it, once.

A server that already runs other apps (another Traefik, other names): read
[Adding an app to a server that already runs apps](#adding-an-app-to-a-server-that-already-runs-apps) first.

```bash
npx --yes @softure-ai/host@<version> server --inventory=infra/inventory.yml --check
npx --yes @softure-ai/host@<version> server --inventory=infra/inventory.yml --connect-as=root   # first run on a fresh server
npx --yes @softure-ai/host@<version> app add --inventory=infra/inventory.yml --app=notes
npx --yes @softure-ai/host@<version> survey --inventory=infra/inventory.yml                     # read-only: what the server runs
```

## Running the CLI

The bin is `softure-host`. Run it from the operator's machine as the scoped package at a pinned version, from any
folder:

```bash
npx --yes @softure-ai/host@<version> <command> [flags]
```

`npx softure-host …` finds the bin only inside a project that has `@softure-ai/host` installed; anywhere else npm
looks up an unscoped package named `softure-host`, which is not this one. The commands below are written as
`softure-host <command>` for short; the next step `server` prints is the full, pinned form.

## Requirements on the operator's machine

- Node.js 22, `ansible-core` 2.14+ (`ansible-playbook`, `ansible-galaxy`), `ssh`, and `gh` signed in with admin
  rights on the app's repository.
- An SSH login to the server as the admin user (key-based; Ansible cannot type passwords).
- For Cloudflare: `CLOUDFLARE_API_TOKEN` in the environment, scoped to the zone (DNS edit, Zone settings read,
  Access apps and policies edit). Without it the Cloudflare step is skipped with one line.

The CLI installs `ansible/requirements.yml` (the pinned `softure.vps_foundation` tag and its dependencies) into
`~/.cache/softure-host/<version>/collections` before every run, so the pinned release is the one that runs. Nothing
the CLI handles is stored: secrets go to `gh` on stdin, the issued deploy key exists only in memory and in GitHub.

## The inventory

One YAML file per server, on the operator's machine or in a private infrastructure repository, never in an app
repository. Every shared name has a generic default, so no app's name leaks into another app.

```yaml
server:
  host: srv.example.com        # SSH host
  ipv4: 203.0.113.10           # for the Cloudflare DNS record and DEPLOY_ORIGIN_IP
  adminUser: admin             # sudo, used by Ansible (the collection's vps_app_user)
  adminPublicKey: ~/.ssh/id_ed25519.pub   # the key the admin logs in with (see "server" below)
  deployUser: deploy           # no sudo, releases only
edge:
  acmeEmail: ops@example.com
  cdn: cloudflare              # or none
apps:
  - slug: notes
    repo: acme/notes
    host: notes.example.com
    database: true
    access: { enabled: true, bypassPaths: [/api/mcp, /api/oauth/token], emails: [owner@example.com] }
```

| Field | Default | What it is |
| --- | --- | --- |
| `server.port` | `22` | SSH port |
| `server.ipv4`, `server.ipv6` | none | the server's addresses; `ipv4` is required for Cloudflare DNS, `ipv6` adds an AAAA record |
| `server.identityFile` | none | private key for the admin connection, when the SSH agent does not hold it |
| `server.deployUser` | `deploy` | the non-sudo user releases log in as; must differ from `adminUser` |
| `server.timezone` | `UTC` | system time zone |
| `edge.name` | `softure-edge` | the edge's compose project and folder (`/srv/<name>`) |
| `edge.network` | `edge.name` | the Docker network apps join as `external` (`softure-deploy init --edge`, #516) |
| `edge.certResolver` | `letsencrypt` | the ACME resolver apps' routers name |
| `edge.manage` | `true` | `false`: an edge that already exists (under other names) is used as it is, never touched |
| `edge.acmeEmail` | none | required when `edge.manage` |
| `edge.cdn` | `none` | `cloudflare`: trusted proxy ranges, origin firewall, DNS and Access |
| `firewall.manage` | `edge.manage` and `cdn: cloudflare` | install the Cloudflare-only origin firewall |
| `firewall.name` | `softure-cloudflare-only` | script and systemd units |
| `firewall.rangesFile` | `/srv/<edge.name>/cloudflare-ips.txt` | the ranges the firewall reads, refreshed daily by a timer |
| `apps[].database` | `false` | generate `POSTGRES_PASSWORD`, `SOFTURE_MIGRATOR_PASSWORD`, `SOFTURE_APP_PASSWORD` when missing |
| `apps[].access` | disabled | Cloudflare Access for the whole host (`emails`), plus one bypass per path |

**The deploy user never has sudo.** The inventory refuses `deployUser` equal to `adminUser`, and both playbooks
first read the deploy user on the server and stop, before any change and in `--check` too, when it is in `sudo`,
`wheel` or `admin` or has a sudoers entry: the collection's `deploy_user` role locks its password, which would take
password `sudo` from an admin account (#1431). On a first onboarding, where the deploy user does not exist yet,
`app add --check` reports the user, its `authorized_keys` and the key line as planned changes.

An edge another app already runs (say a network `first-app-edge` with the resolver `le`): set `edge.network`,
`edge.certResolver` and `edge.manage: false`, and `app add` onboards new apps onto it. Moving the edge out of that
app is that app's own change.

## `softure-host server`

```bash
softure-host server --inventory=<file> [--check] [--connect-as=<user>]
```

Runs `ansible/server.yml`: `softure.vps_foundation.vps_bootstrap` (admin user with sudo, SSH hardening without root
or passwords, UFW on 22/80/443, fail2ban, unattended upgrades, Docker with the compose plugin and the edge network),
then the collection's shared-edge roles:

- `deploy_user`: the deploy user, in `docker`, never in `sudo`.
- `traefik_edge` (when `edge.manage`): Traefik in its own compose project, label routing with
  `exposedByDefault=false`, HTTP → HTTPS, the ACME resolver, Cloudflare's ranges as trusted proxies behind Cloudflare.
- `cloudflare_origin` (when `firewall.manage`): only Cloudflare reaches ports 80/443 (`DOCKER-USER`, since UFW does
  not filter published container ports), ranges refreshed by a systemd timer.

`server.adminPublicKey` becomes the admin user's **only** authorized key (the collection writes it exclusively): it
must be the key you log in with, or the run locks you out. sshd's `AllowUsers` gets the admin and the deploy user.
On a fresh server, `--connect-as=root` (or `ubuntu`) logs in as the provider's first user; after the first run, log
in as the admin user. The bootstrap adds the server's host key to your `known_hosts` on first contact.

## `softure-host app add`

```bash
softure-host app add --inventory=<file> --app=<slug> [--check] [--rotate-key]
```

In order:

0. **Preflight**, before any change and in `--check` too (issue #1432). Over your admin SSH connection the CLI runs
   the read-only probe of `survey`, reads the app's `docker/prod/docker-compose.yml`, and stops, listing every
   problem, when:
   - a Traefik that is not the inventory's own edge (compose project `edge.name`) runs while `edge.manage` is `true`;
   - the inventory's `edge.network` does not exist on the server (the message lists the networks that do);
   - the compose file joins external networks of which none is `edge.network`: a literal name, or a variable's
     default. `${EDGE_NETWORK:-…}` passes, since `app add` sets `EDGE_NETWORK` (step 4).

   When the admin cannot read Docker (not installed, no `docker` group, no passwordless sudo) the edge checks are
   skipped with one line.
1. **GitHub Environment.** `production` is created with the deployment policy "`v*` tags" **before** anything reads
   its secrets (a dry run against a repository without it reads nothing under it).
2. **Server** (`ansible/app.yml`, as the admin user): `/srv/<slug>` owned by the deploy user, the first copy of the
   app's `docker/server/deploy.sh` from its default branch (never overwritten: releases replace it), and the
   release key line `command="/srv/<slug>/deploy.sh",restrict <key> <slug>-release` in the deploy user's
   `authorized_keys`, added or replaced in place, never duplicated, other apps' lines untouched. When sshd's
   `AllowUsers` is set without the deploy user (a server `server` never provisioned), the playbook adds
   `/etc/ssh/sshd_config.d/60-softure-host-<deployUser>.conf` with `AllowUsers <deployUser>` (AllowUsers lines add
   up, so nobody else loses access), checks it with `sshd -t` and `sshd -T`, and reloads sshd; a drop-in sshd
   refuses is removed again. A `DenyUsers`, `DenyGroups` or `AllowGroups` that would still turn the deploy user away
   stops the run before any change and names the step left to you: those lists decide who else may log in.
3. **Host keys.** Read over your own admin SSH connection (checked against your `known_hosts`, not a blind
   `ssh-keyscan`); their fingerprints are printed.
4. **GitHub secrets** (Environment `production`): `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KNOWN_HOSTS`,
   `DEPLOY_SSH_KEY` when issued, `DEPLOY_ORIGIN_IP` behind Cloudflare, the three database passwords only when
   missing (a new password locks the app out of an existing volume); the repository variables `APP_HOST` and
   `EDGE_NETWORK` (the inventory's `edge.network`, which a compose file from `softure-deploy init --edge` joins at
   deploy time; issue #1429).
5. **Cloudflare** (with `edge.cdn: cloudflare` and `CLOUDFLARE_API_TOKEN`): a proxied A (and AAAA) record, a check
   that the zone's TLS mode is Full (strict) (reported, not changed: it is zone-wide), and the Access applications
   `<slug> (softure-host)` for the host's `emails` and `<slug> bypass <path> (softure-host)` per bypass path,
   created or updated by name. Applications it did not create are never touched, and none is deleted: one the
   inventory no longer lists is reported.
6. **What is left**: the names the app's `docker/prod/docker-compose.yml` requires that are set nowhere yet (the app's
   own secrets, such as mail API keys), then the next step: run the app's release workflow. A name counts as set when
   it is a `production` secret, a repository or `production` variable, or one `app add` has just written (such as
   `APP_HOST`), since the release renders `.env.prod` from secrets and variables alike (issue #1434).

A deploy key is issued (ed25519, made in memory) when the Environment has no `DEPLOY_SSH_KEY`, or with
`--rotate-key`. Otherwise the server's line stays as it is; when the server has no line while GitHub holds a key,
the run stops and asks for `--rotate-key`.

The app must already have run `softure-deploy init` (it needs `docker/server/deploy.sh`): in the app,
`npm install --save-dev @softure-ai/deploy`, then `npx softure-deploy init …`.

## `softure-host survey`

```bash
softure-host survey --inventory=<file>
```

Logs in as the admin user and prints what an inventory for the server needs, changing nothing: the OS and Docker
versions, whether the admin has passwordless sudo, the users with their groups and sudo rights, sshd's
`AllowUsers`/`AllowGroups` (and `DenyUsers`/`DenyGroups`, with drop-ins, from `sshd -T`), running Traefik containers
with their compose project, networks, entry points and certificate resolvers, the Docker networks, the folders under
`/srv`, and whether the Cloudflare-only firewall is installed. When an edge that is not the inventory's own runs, it
ends with the `edge:` block to paste:

```yaml
edge:
  manage: false
  network: first-app-edge
  certResolver: le
```

Only the server's connection (`server.host`, `port`, `adminUser`, `identityFile`, `deployUser`) is needed; `apps` may
be empty. Root-only reads go through `sudo -n`; without passwordless sudo they are reported as partial.

## Adding an app to a server that already runs apps

On a server other apps already use, with an edge `softure-host` did not set up:

1. Run `softure-host survey --inventory=<file>` with only the `server:` block filled in.
2. Set `edge.manage: false` and the `edge.network` and `edge.certResolver` the survey found (paste its `edge:`
   block). Leave `firewall.manage` off unless the firewall is yours to manage.
3. **Never run `softure-host server` on such a server.** It rewrites the SSH hardening, sshd's `AllowUsers` and the
   admin's authorized keys for everyone; `app add` does what onboarding needs (the deploy user, its sshd access, the
   app folder).
4. Use a dedicated deploy user without sudo (`server.deployUser`, default `deploy`), never the admin or a user the
   other apps share; both commands refuse a deploy user with sudo rights.
5. `softure-host app add --inventory=<file> --app=<slug> --check`: the preflight reports any contradiction between
   the inventory, the server and the app's compose file, and Ansible's check mode lists the changes.
6. `softure-host app add --inventory=<file> --app=<slug>`.
7. The first release from the app's own pipeline.

## What stays manual

- Buying the server and the domain; the first SSH key on the server.
- Credentials only the owner holds: the admin SSH login, `gh` with admin rights, the Cloudflare token.
- The app's own secrets (listed by `app add`, never invented).
- Releases: the app's own pipeline. Removing an app (`app remove`) and backups off the server are later work.

## Tests

`npm test` covers the inventory, the Ansible command lines and variables, the key format, the GitHub and Cloudflare
calls and both commands with fakes. `e2e/converge.sh` (CI job `host-ansible`) converges `ansible/app.yml` against an
Ubuntu container twice and logs in with the issued key through the forced command. That container's sshd starts
with `AllowUsers root`, as on a server `server` never provisioned, so the test also proves the AllowUsers drop-in,
the `AllowGroups` refusal, and that `survey` (the CLI over SSH) changes nothing.
