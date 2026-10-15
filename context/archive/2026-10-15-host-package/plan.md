# Plan: host-package

Input: change.md, research.md. Complexity: large (two repositories, four phases).

## Goal

`npx @softure-ai/host server --inventory=<file>` converges a shared app server and `npx @softure-ai/host app add
--inventory=<file> --app=<slug>` onboards one app onto it; both are idempotent and take `--check` (changes nothing
anywhere). Shared names default to `softure-edge`, `softure-cloudflare-only`, `deploy`.

**Out of scope:** `app remove`; multi-server inventories; backups; `softure-deploy init --edge` (#516); renaming an
existing edge (the inventory points at it with `edge.manage: false`); releasing anything.

## Decisions (auto)

- Shape: npm package with a CLI and the playbooks inside (research §What kind of package this is, option B).
- `DEPLOY_SSH_KNOWN_HOSTS`, not `DEPLOY_KNOWN_HOSTS`: the name `softure-deploy init`'s workflow reads.
- The app comes from the inventory (`--app=<slug>` picks it); no `--repo/--host` flags, so one file is the truth.
- Deploy key: generated when the Environment has no `DEPLOY_SSH_KEY` or with `--rotate-key`; otherwise the server's
  line is kept as it is (the playbook refuses when the app has no line at all, pointing at `--rotate-key`).
- Host key: read over the admin SSH connection (`ssh -o BatchMode=yes admin@host cat /etc/ssh/ssh_host_*_key.pub`),
  which the owner's own known_hosts already trusts; never a blind keyscan.
- TLS mode is checked and reported, not changed (zone-wide setting).
- Cloudflare runs only with `edge.cdn: cloudflare` and `CLOUDFLARE_API_TOKEN` set; otherwise one line says it was
  left to the owner. DNS needs `server.ipv4` (and `server.ipv6` for AAAA).
- The compose file's required names the Environment lacks are listed (regex on `${NAME:?}`, the rule the compose
  header states), not generated.

## Phase 1: roles in SOFTURE/VPS_FOUNDATION (PR there; merge releases 1.25.0)

- `roles/deploy_user`: non-sudo user in `docker`, `deploy_user_apps: [{ name, key?, state? }]`, one line per app
  `command="/srv/<app>/deploy.sh",restrict <key> <app>-release` added or replaced by its comment, never duplicated,
  others untouched; `state: absent` removes it.
- `roles/traefik_edge`: compose project `softure-edge` in `/srv/softure-edge` on network `softure-edge`; `web` →
  `websecure`, Docker provider `exposedByDefault=false`, trusted IPs, ACME resolver (HTTP-01; DNS-01 with a
  Cloudflare token), ping health check, access log without client addresses.
- `roles/cloudflare_origin`: the firewall script, `.service` + `.path`, and a refresh script with its `.timer`;
  ranges file seeded from the role's list when absent.
- README table, CHANGELOG, galaxy description. Verified with `--syntax-check`, `ansible-lint` and a converge of
  `deploy_user` + `traefik_edge` against containers (twice: the second run changes nothing).

Done when: the PR is open with the converge evidence.

## Phase 2: package skeleton and inventory

- `tools/host/` from `templates/package/` shape: `package.json` (`@softure-ai/host` 0.1.0, bin `softure-host`,
  files `dist`, `src`, `ansible`, `CHANGELOG.md`), tsconfigs, README, CHANGELOG `Unreleased`.
- `src/inventory/`: zod schema + `loadInventory` (YAML → unknown → schema), defaults per the issue's naming table.
- Tests: defaults, an existing edge (`manage: false`), refused slug, unknown app.

Done when: typecheck, lint and `tests/repo/packages.test.ts` are green.

## Phase 3: playbooks and the CLI

- `ansible/requirements.yml` (pin 1.25.0), `ansible/server.yml`, `ansible/app.yml`.
- `src/ansible/`: the `ansible-galaxy` and `ansible-playbook` argument lists (extra vars as one JSON argument,
  `--check --diff`), collections cached per package version.
- `src/github/`, `src/cloudflare/`, `src/ssh/` (key pair, host keys, fingerprint), `src/cli/` (`server`, `app add`,
  `help`), every external call behind a small runner interface so tests need no network.
- Tests: exact argument lists; Environment before secrets; passwords only when missing; values on stdin only;
  dry run writes nothing; Cloudflare DNS create/patch/unchanged, Access reconcile never touching foreign apps.

Done when: `npm run typecheck && npm run lint && npm test && npm run build` green.

## Phase 4: CI converge and docs

- `tools/host/e2e/converge.sh` + job `host-ansible` in `ci.yml`: install `ansible-core` and the pinned collection,
  syntax-check both playbooks, converge `app.yml` against an Ubuntu container twice (idempotent), assert one key line.
- Root README package line; package README (commands, inventory, what stays manual, first release note).

Done when: the job passes locally against a container and the PR's CI is green.

## Progress

- [x] Phase 1: roles in SOFTURE/VPS_FOUNDATION
- [x] Phase 2: package skeleton and inventory
- [x] Phase 3: playbooks and the CLI
- [x] Phase 4: CI converge and docs
