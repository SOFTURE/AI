---
change_id: deploy-init-cloudflare-hooks
title: "deploy init: Cloudflare origin lock, ESM bundle flags in the Dockerfile, hook helpers (issue #310)"
status: archived
roadmap_item: null
issue: 310
branch: claude/project-thread-pq2hdd
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Three generic pieces an adopting app wrote next to `softure-deploy init` move into the package:

1. `init --cdn=cloudflare` locks the origin to Cloudflare: a root-run firewall script with its systemd units
   (iptables `DOCKER-USER` rules letting only Cloudflare's ranges reach 80 and 443), a hook that refreshes the
   ranges after every release and in the daily maintain run, and Traefik's `forwardedHeaders.trustedIPs` from the
   same list. The direct-IP probe already exists (`verify --origin`, `DEPLOY_ORIGIN_IP`).
2. The generated `Dockerfile` bundles `migrate.mjs` and the ops scripts so that a `server-only` import and a CJS
   dependency inside the ESM bundle work: `--alias:server-only=<empty module>` and a `createRequire` banner.
3. `init` writes `docker/prod/hooks/lib.sh` (`fail`, `compose`, `env_value`, `require_min_length`), and
   `env render --min-length NAME=N` refuses a secret shorter than N (with a `secret-min-lengths` input of
   `deploy-app.yml` that passes it).

## Context

Issue [#310](https://github.com/SOFTURE/AI/issues/310). The app's own versions: ~110 lines of firewall script and
unit, ~60 lines of range refresh, ~27 lines of helpers per hook, and two esbuild errors every new app hits.

## Constraints

- English only. Shell stays within bash 3.2 and flags both BSD and GNU tools accept (tests run on macOS too).
- No root step runs from the deploy user: the firewall script is installed by root once, outside the app folder,
  and only reads the ranges file the hook writes.
- One unreleased deploy version shared with #308 and #309 (0.1.8); the second to merge folds into its section.

## Notes

- Framing: skipped; the issue names the three gaps and a proposal for each.
- Archived 2026-10-09.
