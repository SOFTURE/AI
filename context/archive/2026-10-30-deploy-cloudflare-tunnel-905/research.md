---
change_id: deploy-cloudflare-tunnel-905
---

# Research: Cloudflare Tunnel mode for init and the shared-host guard

## What exists

- `tools/deploy/src/init/answers.ts`: zod answers; `edge` (issue #516) excludes `cdn` and `acmeEmail`.
- `tools/deploy/src/init/generate.ts`: `TEMPLATE_FILES` includes `traefik.yml` only without `edge`;
  `getSwitchServices` drops `traefik` with `edge`; template values carry `edge`.
- `templates/docker/prod/docker-compose.yml.tmpl` and `templates/docker/server/deploy.sh.tmpl` use `{{^edge}}` to mean
  "the stack runs its own Traefik" (service, volume, rules-changed step).
- `src/testing/shared-host-compose.ts`: `checkSharedHostCompose` always reports `edge-network-missing` when no
  top-level network joins the edge.
- `deploy.json` verify checks HSTS; with no Traefik the app must send it.

## Findings

- `cloudflared tunnel run` reads the token from `TUNNEL_TOKEN`; `--no-autoupdate` is right in a container. The image
  is distroless (no shell, no curl), so a health check is not practical; the deploy's health wait goes through the
  public hostname, so a tunnel that does not connect fails the deploy anyway.
- Current tags on Docker Hub: `2026.10.x`; `2026.10.1` (2026-10-15) is the newest one at least two weeks old.
- Token-run mode writes no config, so `read_only: true` holds.
- Path restrictions and the www redirect are Traefik rules; without Traefik they belong in Cloudflare (public
  hostname path, a redirect rule).

## Options

1. A `tunnel` boolean answer, own sections in the templates, a derived `ownTraefik` value. Chosen: smallest change.
2. A generic `ingress` enum (`traefik` | `edge` | `tunnel`) replacing `edge`. Rejected: breaks the existing answers.
