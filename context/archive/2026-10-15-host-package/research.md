---
change_id: host-package
---

# Research: a provisioning package built on an Ansible collection (issue #524)

## What kind of package this is

The owner's note: "this time not an npm package, but Ansible". The issue's own proposal settles the shape: Ansible
does the server work, wrapped by one CLI that also does what Ansible is awkward at (GitHub through `gh`, Cloudflare
through its API, input validation). Three ways to ship that were weighed:

| Option | Install for the owner | Release path | Verdict |
| --- | --- | --- | --- |
| A. Ansible collection only (`softure.host`, playbooks + roles) | `ansible-galaxy collection install` from git | a new pipeline (tags + Galaxy, as VPS_FOUNDATION does) | No CLI: GitHub and Cloudflare steps would be Ansible `uri` tasks with tokens in vars, and every repo rule here (zod at the boundary, tests in Vitest) is lost |
| B. npm package `@softure-ai/host` in `tools/host/`, playbooks shipped inside, depending on `softure.vps_foundation` through a pinned `requirements.yml` | `npx @softure-ai/host …` (needs `ansible-playbook` on the machine) | the existing tag release (`release.yml`): no new pipeline | **Chosen**: the issue's recommendation, the repository's release, gates and test harness apply unchanged |
| C. Put everything into VPS_FOUNDATION | as A | VPS_FOUNDATION's auto-release | Mixes app-layer concerns (GitHub, Cloudflare Access, the deploy model of `@softure-ai/deploy`) into a server-generic public collection |

So the Ansible part is two layers: **server-generic roles in the collection** (SOFTURE/VPS_FOUNDATION) and **thin
playbooks in this package** that compose them with this package's variables.

## softure.vps_foundation (SOFTURE/VPS_FOUNDATION @ 1.24.0)

- Layout: collection root in `vps_foundation/` (`galaxy.yml`, `meta/runtime.yml` Ansible >= 2.14, `playbooks/`,
  `roles/`). Not on Galaxy: consumers install from git, `source: https://github.com/softure/VPS_FOUNDATION.git#vps_foundation`.
  A pinned install is `name: git+https://github.com/SOFTURE/VPS_FOUNDATION.git#vps_foundation`, `type: git`,
  `version: <tag>`.
- Release: every push to master (`release.yml`) bumps the **minor**, commits `[SKIP CI] bump version`, builds
  `ansible-galaxy collection build`, tags `x.y.0` and makes a GitHub Release with the tarball. No CI before merge,
  no tests: the only checks are what a contributor runs (`--syntax-check`, `--check --diff`).
- Conventions (its CLAUDE.md): English only; defaults prefixed with the role name; `when: <role>_enabled | bool`;
  FQCN everywhere; an `assert` of required variables first; tags on every task; `meta/main.yml` with galaxy_info.
- `vps_bootstrap` = `system_hardening` + `docker_engine`, after a `ssh-keyscan` into the controller's known_hosts.
  `system_hardening` facts that matter here:
  - `vps_app_user` is created **in `sudo`** with NOPASSWD and gets `authorized_keys` written **exclusively** with
    `vps_app_user_ssh_public_key_local` (required unless a Termius key is found; `vps_prompt_for_ssh_key: false`
    stops the interactive prompt).
  - `vps_ssh_allowed_users` (default `[vps_app_user]`) becomes sshd `AllowUsers`: a deploy user not in this list
    cannot log in at all. This package must pass `[adminUser, deployUser]`.
  - `vps_github_actions_ssh_required` defaults to `true` (prompts); this package passes `false`.
  - Updates: `vps_auto_updates_enabled`, `vps_unattended_upgrades_enabled`.
- `docker_engine`: `docker_networks: [{ name }]` creates networks; `docker_users` are added to `docker` and checked
  with `sg docker -c "docker ps"`, so a user listed there must exist before the role runs (the deploy user does not
  yet, so the new `deploy_user` role adds `docker` itself).
- The collection's proxy is Caddy (`caddy` role); nothing runs Traefik.

## The SOFTURE deploy model (`@softure-ai/deploy` 0.4.0) this package serves

- `init` writes, per app: the compose project with its own `traefik` service (file provider), `deploy.sh`,
  `.github/workflows/deploy.yml` reading the Environment secrets `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`,
  `DEPLOY_SSH_KEY`, **`DEPLOY_SSH_KNOWN_HOSTS`** (the issue's "DEPLOY_KNOWN_HOSTS" is the adopting app's own name;
  this package follows the template), optional `DEPLOY_ORIGIN_IP`, `DEPLOY_VERIFY_ENV`.
- `deploy.sh` header: `authorized_keys` binds the release key with `command="/srv/<app>/deploy.sh",restrict`.
  Only the first copy is placed by hand; every release installs the next one.
- Database passwords `POSTGRES_PASSWORD`, `SOFTURE_MIGRATOR_PASSWORD`, `SOFTURE_APP_PASSWORD` are `${NAME:?}` in the
  compose file, URL-safe (`openssl rand -hex 32`). A new value on an existing volume locks the app out.
- `init --cdn=cloudflare` writes `cloudflare-only.sh` + `.service` + `.path` (chain `SOFTURE-CLOUDFLARE` from
  `DOCKER-USER`, DROP first then RETURN per range, conntrack original port 80/443, IPv6 via `DOCKER-USER` or
  `INPUT`) and a release hook `cloudflare-ranges.sh` that refreshes `/srv/<app>/cloudflare-ips.txt`. The role
  `cloudflare_origin` ports both, the refresh moving from a release hook to a systemd timer.
- Traefik trusted ranges: `CLOUDFLARE_RANGES` in `tools/deploy/src/init/cloudflare.ts`.
- #516 (open) is the app side: `init --edge` joins an existing edge network by labels. This change only fixes the
  server-side names it should default to (`softure-edge`); it does not touch `tools/deploy/`.

## GitHub and Cloudflare APIs used

- Environment: `PUT /repos/{repo}/environments/production` with
  `deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }`, then
  `POST …/deployment-branch-policies` `{ name: "v*", type: "tag" }` when missing. A `GET` of a missing Environment
  is a 404, so the Environment is created **before** its secrets are listed; a dry run reads nothing under an
  Environment that does not exist.
- Secrets: `gh secret list --env production --repo R --json name`; `gh secret set NAME --env production --repo R`
  reads the value from stdin when `--body` is absent. Variables: `gh variable set NAME --repo R --body V`.
- Raw files: `gh api -H "Accept: application/vnd.github.raw" repos/R/contents/<path>` (for the first `deploy.sh` and
  the compose file's required names).
- Cloudflare v4 (bearer token): `GET /zones?name=` (walk the host's suffixes; the zone carries `account.id`),
  `GET/POST/PATCH /zones/{id}/dns_records` (A/AAAA, `proxied: true`, `ttl: 1`), `GET /zones/{id}/settings/ssl`
  (`strict` = Full (strict); checked, not changed: it is zone-wide), `GET/POST/PUT /accounts/{id}/access/apps` with
  inline `policies` (`decision: allow` + `include: [{ email: { email } }]`; bypass apps `domain: host/path`,
  `decision: bypass` + `include: [{ everyone: {} }]`). Apps this package manages are recognised by name
  (`<app> (softure-host)`); others are never changed or deleted.

## Tooling in this container (for testing)

- `ansible-core` 2.21 with `community.docker` 5.4, `ansible.posix` 2.2, `community.general` 13.5 (pip `ansible`);
  Galaxy is not reachable through the proxy, git is.
- Docker daemon runs; Docker Hub rate-limits, `mirror.gcr.io/library/*` works. No systemd as PID 1, so the
  `cloudflare_origin` units are exercised by syntax and check mode, the firewall script on its own.
- CI runners (ubuntu-latest) have Docker and Python: the new CI job installs `ansible-core` + the collection pin
  and converges the app layer in a throwaway Ubuntu container.

## Release (owner-only steps)

`@softure-ai/host` is new on npm: its first publish needs the `NPM_TOKEN` secret and then a trusted publisher
(scripts/release/README.md §First release of a new package). VPS_FOUNDATION releases itself on merge (its
`GITHUB_TOKEN`), nothing to provide there.
