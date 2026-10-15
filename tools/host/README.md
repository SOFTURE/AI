# @softure-ai/host

Provisions a server that hosts several apps and onboards each app onto it with one command. Ansible does the server
work, on top of the [`softure.vps_foundation`](https://github.com/SOFTURE/VPS_FOUNDATION) collection; the CLI
validates the inventory, runs the playbooks it ships, and does what Ansible is awkward at: GitHub through `gh` and
Cloudflare through its API. Every command is idempotent and takes `--check`, which changes nothing anywhere.

It is the server side of the one-VPS model of [`@softure-ai/deploy`](../deploy/README.md): `deploy` covers
everything from the release on; `host` sets up the server and the app's place on it, once.

```bash
npx @softure-ai/host server --inventory=infra/inventory.yml --check
npx @softure-ai/host server --inventory=infra/inventory.yml --connect-as=root   # first run on a fresh server
npx @softure-ai/host app add --inventory=infra/inventory.yml --app=notes
```

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
| `server.deployUser` | `deploy` | the non-sudo user releases log in as |
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

1. **GitHub Environment.** `production` is created with the deployment policy "`v*` tags" **before** anything reads
   its secrets (a dry run against a repository without it reads nothing under it).
2. **Server** (`ansible/app.yml`, as the admin user): `/srv/<slug>` owned by the deploy user, the first copy of the
   app's `docker/server/deploy.sh` from its default branch (never overwritten: releases replace it), and the
   release key line `command="/srv/<slug>/deploy.sh",restrict <key> <slug>-release` in the deploy user's
   `authorized_keys`, added or replaced in place, never duplicated, other apps' lines untouched.
3. **Host keys.** Read over your own admin SSH connection (checked against your `known_hosts`, not a blind
   `ssh-keyscan`); their fingerprints are printed.
4. **GitHub secrets** (Environment `production`): `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KNOWN_HOSTS`,
   `DEPLOY_SSH_KEY` when issued, `DEPLOY_ORIGIN_IP` behind Cloudflare, the three database passwords only when
   missing (a new password locks the app out of an existing volume); the repository variable `APP_HOST`.
5. **Cloudflare** (with `edge.cdn: cloudflare` and `CLOUDFLARE_API_TOKEN`): a proxied A (and AAAA) record, a check
   that the zone's TLS mode is Full (strict) (reported, not changed: it is zone-wide), and the Access applications
   `<slug> (softure-host)` for the host's `emails` and `<slug> bypass <path> (softure-host)` per bypass path,
   created or updated by name. Applications it did not create are never touched, and none is deleted: one the
   inventory no longer lists is reported.
6. **What is left**: the names the app's `docker/prod/docker-compose.yml` requires that the Environment still lacks
   (the app's own secrets, such as mail API keys), then the next step: run the app's release workflow.

A deploy key is issued (ed25519, made in memory) when the Environment has no `DEPLOY_SSH_KEY`, or with
`--rotate-key`. Otherwise the server's line stays as it is; when the server has no line while GitHub holds a key,
the run stops and asks for `--rotate-key`.

The app must already have run `softure-deploy init` (it needs `docker/server/deploy.sh`).

## What stays manual

- Buying the server and the domain; the first SSH key on the server.
- Credentials only the owner holds: the admin SSH login, `gh` with admin rights, the Cloudflare token.
- The app's own secrets (listed by `app add`, never invented).
- Releases: the app's own pipeline. Removing an app (`app remove`) and backups off the server are later work.

## Tests

`npm test` covers the inventory, the Ansible command lines and variables, the key format, the GitHub and Cloudflare
calls and both commands with fakes. `e2e/converge.sh` (CI job `host-ansible`) converges `ansible/app.yml` against an
Ubuntu container twice and logs in with the issued key through the forced command.
