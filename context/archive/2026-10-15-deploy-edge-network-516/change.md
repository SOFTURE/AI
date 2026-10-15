---
change_id: deploy-edge-network-516
title: "deploy: init --edge for an app that joins an existing Traefik edge network (issue #516)"
status: archived
roadmap_item: null
issue: 516
branch: claude/project-thread-l7uzli
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

Close [issue #516](https://github.com/SOFTURE/AI/issues/516): an adopting app that runs as a second compose project on
a server whose Traefik belongs to another app's stack can use the files `softure-deploy init` writes without editing
them by hand, and an app behind an outer sign-in (Cloudflare Access) can keep the deploy action's health wait.

## Context

deploy is at 0.4.0 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Constraints

- Without `--edge` every generated file stays byte-identical, except the one-word worker fix below.
- The action's new inputs are optional; without them the health wait is the same 200 check.
- Shell stays bash 3.2 / BSD-safe (AGENTS.md).

## Notes

- Framing: skipped. The issue names the gaps and the proposed shape.

## Decisions (auto)

- `--edge=<network>` takes a Docker network name (`^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$`). In that mode init writes no
  Traefik service, no `traefik.yml` and no `letsencrypt` volume; the app service joins the external network (top-level
  `networks.edge` with `name: <network>`, `external: true`) and `default`, and is published with labels.
- The labels assume the edge Traefik's entry point `websecure` and certificate resolver `letsencrypt`, the names init's
  own Traefik uses; the edge Traefik must also run the Docker provider (README). Router, middleware and service names are
  prefixed with the app's `name`. The `www` redirect and the security headers become label middlewares.
- With `--edge` and a database, init warns that Postgres on `127.0.0.1:5432` may clash with the first app's.
- `--edge` with `--cdn` or `--acme-email` is refused: both belong to the stack that owns the edge Traefik.
- `deploy.sh` gets the switch's services from init (`traefik app`, or `app` with `--edge`), and with `--edge` neither
  the `traefik` step nor the rules-changed check.
- The switch also names `worker` when the app has one: `compose up … traefik app` never started the `worker` service
  (not a dependency of `app`), so a release left the old worker running. Same line, one word; fixed here.
- The action gets two optional inputs for the health wait: `health-status` (the status that counts as up, default
  `200`) and `health-headers` (request header lines `Name: value`, masked, for a service token such as
  `CF-Access-Client-Id` / `CF-Access-Client-Secret`). They live on the action only: an app behind an access proxy
  deploys from its own environment job (the action), and `deploy-app.yml`'s release JSON stays as it is.
