# Changelog

Newest first. Each version lists what changed for an operator who uses `@softure-ai/host`. When a server has run a
version, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- A deploy user with sudo rights is refused before anything changes (#1431). The inventory refuses
  `server.deployUser` equal to `server.adminUser`; `server` and `app add` first read the deploy user on the server and
  stop, in a real run and in `--check` alike, when it is in `sudo`, `wheel` or `admin` or has a sudoers entry, so the
  collection's role never locks the password of an admin account. `app add --check` on a first onboarding, where the
  deploy user does not exist yet, passes and reports the user, its `authorized_keys` and the key line as planned
  changes instead of failing on the missing file.
  - Migrate: an inventory with `deployUser` equal to `adminUser` must name a separate deploy user (default `deploy`).

- `app add` sets the repository variable `EDGE_NETWORK` to the inventory's `edge.network` next to `APP_HOST` (#1429).
  A compose file from `softure-deploy init --edge` (`@softure-ai/deploy` from the next release) joins that network at
  deploy time, so an app generated for another network name deploys to this server without editing its compose file.
  - Migrate: nothing; re-run `softure-host app add` to set the variable for an app added before.

## 0.1.3

- Each Cloudflare API call gets 30 s (#1286), `CLOUDFLARE_TIMEOUT_MS`, the third argument of `createCloudflareApi`;
  a call that never returns fails the command instead of hanging it.
  - Migrate: nothing.

## 0.1.2

- **Dependencies:** `zod` ^4.6.7 (was ^4.6.5), so a fresh install takes the fixed zod release.

## 0.1.1

- No change for an operator: the code and playbooks are those of 0.1.0. This is the first version published through
  the package's npm trusted publisher (OIDC, `release.yml`) with no token; 0.1.0 needed `NPM_TOKEN` as a new package.

## 0.1.0

- First version (#524): `softure-host server` converges a shared app server on top of `softure.vps_foundation`
  1.25.0 (bootstrap, deploy user, Traefik edge `softure-edge`, Cloudflare-only origin firewall);
  `softure-host app add` onboards one app (GitHub Environment `production` with the `v*` tag policy, app folder,
  first `deploy.sh`, forced-command release key, deploy secrets, database passwords only when missing, Cloudflare
  DNS, TLS check and Access). Both take `--check`.
