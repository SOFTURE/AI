# Changelog

Newest first. Each version lists what changed for an operator who uses `@softure-ai/host`. When a server has run a
version, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- **Onboarding onto a server that already runs apps** (#1432). `softure-host survey --inventory=<file>` reads the
  server over the admin's SSH and changes nothing: OS and Docker, users with groups and sudo rights, sshd's
  `AllowUsers`/`AllowGroups`, running Traefik containers (compose project, networks, entry points, resolvers), Docker
  networks, `/srv` folders, the origin firewall, and the `edge:` block for an edge that already runs. `app add` first
  runs a preflight and stops before any change, in `--check` too, when a foreign edge runs while `edge.manage` is
  `true`, when `edge.network` does not exist on the server, or when the app's compose file joins another external
  network. When sshd's `AllowUsers` does not name the deploy user, `app add` adds an sshd drop-in that does
  (validated, reloaded); a `DenyUsers`, `DenyGroups` or `AllowGroups` that would still refuse it stops the run with
  the step left. The README has a checklist, "Adding an app to a server that already runs apps".
  - Migrate: nothing. An `app add` that now stops names what to change in the inventory or the app.

- `operator add-key`, `operator remove-key` and `operator list` (#1433): bind the operator's own SSH key to an app's
  `deploy.sh` in the deploy user's `authorized_keys` (`command="/srv/<slug>/deploy.sh",restrict <key>
  <slug>-operator-<label>`), replaced in place by its label, never duplicated, other lines untouched; a key already on
  another line, a private key or a line with options is refused; `--check` prints the line and changes nothing. New
  playbook `ansible/operator.yml`. README: "Running operator commands".
  - Migrate: a line added by hand keeps working; `operator list` shows it when its comment is `<slug>-operator-<label>`.
    To move one under the command, remove it by hand, then run `operator add-key` with the same key.

- `app add` no longer reports `APP_HOST` (or any variable it has just set, or a repository or `production` variable
  that already exists) as still to set by hand (#1434). The line lists only names set nowhere and says each can be a
  `production` secret or, for a value that is not secret, a repository variable.
  - Migrate: nothing.

- `server` prints its next step as `npx --yes @softure-ai/host@<this version> app add --inventory=<file> --app=<slug>`,
  which runs from any folder, instead of the bare `softure-host app add --app=<slug>`; `app add` without
  `docker/server/deploy.sh` says to install `@softure-ai/deploy` in the app and run `npx softure-deploy init` there.
  The README gains "Running the CLI" and pins the version in every example (#1436).
  - Migrate: nothing.

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
