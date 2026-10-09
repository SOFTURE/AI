# Research: deploy-init-cloudflare-hooks

Sources: issue #310, `tools/deploy` (init templates, `deploy.sh` hooks, `env render`, `verify --origin`),
`.github/workflows/deploy-app.yml`.

## Findings

- **Release contents.** A release ships the tag's `docker/prod/` (subfolders included) next to `deploy.sh` in
  `/srv/<name>/`, installed 0644, plus `deploy.sh` and `deploy.json`. `docker/server/` other than `deploy.sh` is
  never shipped, so files root installs by hand belong there, as `deploy.sh`'s first copy does.
- **Hooks** (`deploy.json` `hooks`) run in the app folder as the deploy user with TAG, IMAGE and PREVIOUS_TAG;
  `run: ["bash", "hooks/<file>.sh"]` is the documented form. Names are unique across the three points.
- **Privilege.** The deploy user cannot run iptables. A systemd `.path` unit watching the ranges file lets root
  re-apply the rules when the hook rewrites the file, without sudo for the deploy user. The script root runs must
  not live in the app folder (the deploy user rewrites it every release).
- **Docker and the firewall.** Published ports skip INPUT (DNAT to FORWARD); `DOCKER-USER` is the chain Docker
  leaves to the admin. `--ctorigdstport` matches the published port before DNAT. Without Docker's ip6tables, IPv6
  reaches `docker-proxy` through INPUT, so IPv6 falls back to INPUT when `DOCKER-USER` is missing there.
- **Cloudflare ranges** are published at `https://www.cloudflare.com/ips-v4` and `/ips-v6` (no trailing newline).
  HTTP-01 challenges pass through Cloudflare (it exempts `/.well-known/acme-challenge/` from "Always Use HTTPS").
- **Traefik** takes `entrypoints.<name>.forwardedHeaders.trustedIPs` in static config only (the compose command);
  `proxyProtocol` is for Cloudflare Spectrum, not the HTTP proxy.
- **esbuild.** `server-only`'s main entry throws outside the `react-server` condition, so a bundle run by plain Node
  needs it aliased to an empty module. ESM output wraps `require` calls of CJS dependencies in a shim that throws
  "Dynamic require of … is not supported" unless a `require` exists: the `createRequire` banner provides it.
- **env render** has no length check; `deploy-app.yml` builds its arguments itself, so a flag alone would not reach
  apps that deploy through it.
