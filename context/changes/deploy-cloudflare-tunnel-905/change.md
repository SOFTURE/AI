---
change_id: deploy-cloudflare-tunnel-905
title: "deploy: a Cloudflare Tunnel mode for an app whose origin must not be reachable through the shared edge proxy (issue #905)"
status: in_progress
roadmap_item: null
issue: 905
branch: claude/project-thread-f7b9yc
created: 2026-10-30
updated: 2026-10-30
---

## Intent

Close [issue #905](https://github.com/SOFTURE/AI/issues/905): an app behind Cloudflare that is published through a
shared host's Traefik admits any Cloudflare customer that sends the right `Host`. A Cloudflare Tunnel (`cloudflared` in
the app's own compose project, remotely managed by a token) closes that gap without touching the shared proxy.

- `softure-deploy init --tunnel` writes a compose file with a hardened, pinned `cloudflared` service on its own egress
  network, the app with `traefik.enable=false` and `depends_on` the tunnel, no Traefik and no rules file.
- `checkSharedHostCompose(..., { ingress: "tunnel" })` asserts the opposite of the edge rules: nothing joins the edge
  network and no service carries Traefik routing labels.
- The README documents the tunnel steps and the security headers the app now sends itself.

## Context

Labels: `pkg: deploy`. No release in this change: the coordinator closes the wave with one batch release.

## Constraints

- Opt-in: without `--tunnel` and without `ingress`, every generated file and every guard result stays as it was.
- Shell steps stay within bash 3.2 and BSD/GNU-neutral flags (AGENTS.md).

## Notes

- Framing: skipped. The issue names the problem and the four gaps.
