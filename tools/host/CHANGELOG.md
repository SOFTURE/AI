# Changelog

Newest first. Each version lists what changed for an operator who uses `@softure-ai/host`. When a server has run a
version, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- First version (#524): `softure-host server` converges a shared app server on top of `softure.vps_foundation`
  1.25.0 (bootstrap, deploy user, Traefik edge `softure-edge`, Cloudflare-only origin firewall);
  `softure-host app add` onboards one app (GitHub Environment `production` with the `v*` tag policy, app folder,
  first `deploy.sh`, forced-command release key, deploy secrets, database passwords only when missing, Cloudflare
  DNS, TLS check and Access). Both take `--check`.
